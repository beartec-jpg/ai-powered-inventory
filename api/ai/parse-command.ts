import { VercelRequest, VercelResponse } from '@vercel/node';
import { OpenAI } from 'openai';
import { 
  successResponse, 
  badRequestResponse, 
  internalServerErrorResponse,
  setCorsHeaders,
  validateCommandResponse 
} from '../lib/utils';

// Initialize OpenAI client configured for xAI (Grok)
const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

// Action types for inventory operations
type InventoryAction = 
  | 'ADJUST_STOCK' 
  | 'TRANSFER_STOCK' 
  | 'CREATE_PRODUCT' 
  | 'QUERY_INVENTORY'
  | 'UPDATE_PRODUCT';

interface ParseCommandResponse {
  action: InventoryAction;
  parameters: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  clarificationNeeded?: string;
  model?: string;
  latency?: number;
}

// Constants for confidence levels and timeouts
const HIGH_CONFIDENCE = 0.9;
const MEDIUM_CONFIDENCE = 0.6;
const LOW_CONFIDENCE_THRESHOLD = 0.7;
const GROK_3_MINI_TIMEOUT = 15000;
const GROK_3_TIMEOUT = 30000;

// Define tool schemas for inventory operations
const inventoryTools = [
  {
    type: 'function' as const,
    function: {
      name: 'adjust_stock',
      description: 'Adjust stock quantity for a product in a warehouse (add or remove stock)',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'The ID or SKU of the product',
          },
          warehouseId: {
            type: 'string',
            description: 'The ID or name of the warehouse',
          },
          quantity: {
            type: 'number',
            description: 'The quantity to adjust (positive to add, negative to remove)',
          },
          reason: {
            type: 'string',
            description: 'The reason for adjustment (e.g., "received", "damaged", "sold", "returned")',
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the adjustment',
          },
        },
        required: ['productId', 'warehouseId', 'quantity', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'transfer_stock',
      description: 'Transfer stock from one warehouse to another',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'The ID or SKU of the product to transfer',
          },
          fromWarehouseId: {
            type: 'string',
            description: 'The source warehouse ID or name',
          },
          toWarehouseId: {
            type: 'string',
            description: 'The destination warehouse ID or name',
          },
          quantity: {
            type: 'number',
            description: 'The quantity to transfer (must be positive)',
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the transfer',
          },
        },
        required: ['productId', 'fromWarehouseId', 'toWarehouseId', 'quantity'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_product',
      description: 'Create a new product in the inventory system',
      parameters: {
        type: 'object',
        properties: {
          sku: {
            type: 'string',
            description: 'The unique SKU for the product',
          },
          name: {
            type: 'string',
            description: 'The product name',
          },
          description: {
            type: 'string',
            description: 'Optional product description',
          },
          category: {
            type: 'string',
            description: 'The product category',
          },
          unitPrice: {
            type: 'number',
            description: 'The unit price of the product',
          },
          unit: {
            type: 'string',
            description: 'The unit of measurement (e.g., "piece", "kg", "liter")',
          },
        },
        required: ['sku', 'name', 'category', 'unitPrice'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_product',
      description: 'Update an existing product in the inventory system',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'The ID or SKU of the product to update',
          },
          name: {
            type: 'string',
            description: 'Updated product name',
          },
          description: {
            type: 'string',
            description: 'Updated product description',
          },
          category: {
            type: 'string',
            description: 'Updated product category',
          },
          unitPrice: {
            type: 'number',
            description: 'Updated unit price',
          },
          unit: {
            type: 'string',
            description: 'Updated unit of measurement',
          },
          active: {
            type: 'boolean',
            description: 'Whether the product is active',
          },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_inventory',
      description: 'Query inventory information (stock levels, product details, low stock items, etc.)',
      parameters: {
        type: 'object',
        properties: {
          queryType: {
            type: 'string',
            enum: ['stock_level', 'product_info', 'low_stock', 'warehouse_stock', 'product_list'],
            description: 'The type of query to perform',
          },
          productId: {
            type: 'string',
            description: 'Product ID or SKU for specific product queries',
          },
          warehouseId: {
            type: 'string',
            description: 'Warehouse ID for warehouse-specific queries',
          },
          category: {
            type: 'string',
            description: 'Filter by category',
          },
          search: {
            type: 'string',
            description: 'Search term for product search',
          },
        },
        required: ['queryType'],
      },
    },
  },
];

/**
 * Try to parse a command using a specific model with function calling
 */
async function tryParseCommand(
  command: string,
  context: Record<string, unknown> | undefined,
  modelName: string,
  timeout: number = 30000
): Promise<ParseCommandResponse> {
  const contextStr = context ? `\n\nAdditional context: ${JSON.stringify(context)}` : '';
  
  const systemPrompt = `You are an expert inventory management assistant. Parse natural language commands into structured function calls.
  
Guidelines:
- Understand intent from natural language (e.g., "add 50 units" means adjust_stock with positive quantity)
- Infer reasonable defaults when information is implied
- Use function calling to structure the response
- If critical information is missing, use query_inventory to indicate a clarification is needed
- Be confident in your interpretation when the command is clear
- Set confidence lower (<0.7) when information is ambiguous`;

  const userPrompt = `Parse this inventory command: "${command}"${contextStr}`;

  // Create completion with timeout
  const completionPromise = openai.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    tools: inventoryTools,
    tool_choice: 'auto',
    temperature: 0.2,
    max_tokens: 500,
  });

  // Add timeout handling with cleanup
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
  });

  try {
    const completion = await Promise.race([
      completionPromise,
      timeoutPromise,
    ]) as OpenAI.Chat.Completions.ChatCompletion;
    
    // Clear timeout on success
    clearTimeout(timeoutId!);
    
    const message = completion.choices[0]?.message;

    if (!message) {
      throw new Error('No response from AI model');
    }

    // Check if tool was called
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

      // Map function names to action types
      const actionMap: Record<string, InventoryAction> = {
        'adjust_stock': 'ADJUST_STOCK',
        'transfer_stock': 'TRANSFER_STOCK',
        'create_product': 'CREATE_PRODUCT',
        'update_product': 'UPDATE_PRODUCT',
        'query_inventory': 'QUERY_INVENTORY',
      };

      const action = actionMap[functionName] || 'QUERY_INVENTORY';

      // Calculate confidence based on completeness of parameters
      const tool = inventoryTools.find(t => t.function.name === functionName);
      const requiredParams = tool?.function.parameters.required || [];
      const providedParams = Object.keys(functionArgs);
      const hasAllRequired = requiredParams.every(p => providedParams.includes(p));
      const confidence = hasAllRequired ? HIGH_CONFIDENCE : MEDIUM_CONFIDENCE;

      // Generate reasoning
      const reasoning = `Interpreted command as ${action}: ${JSON.stringify(functionArgs)}`;

      return {
        action,
        parameters: functionArgs,
        confidence,
        reasoning,
      };
    }

    // Fallback: parse from content if no function call
    const content = message.content || '';
    
    // Try to extract JSON from content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || 'QUERY_INVENTORY',
        parameters: parsed.parameters || {},
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || parsed.interpretation || 'Parsed from text response',
        clarificationNeeded: parsed.clarificationNeeded,
      };
    }

    // If no structured response, return low confidence query
    return {
      action: 'QUERY_INVENTORY',
      parameters: { query: command },
      confidence: 0.3,
      reasoning: 'Could not parse command into structured format',
      clarificationNeeded: 'Could you please rephrase your request?',
    };
  } catch (error) {
    // Clear timeout on error
    clearTimeout(timeoutId!);
    throw error;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: 'Only POST requests are allowed',
    });
  }

  const { command, context } = req.body;

  if (!command || typeof command !== 'string') {
    return badRequestResponse(res, 'Command is required and must be a string');
  }

  if (!process.env.XAI_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message: 'XAI API key is not configured',
    });
  }

  try {
    // Try grok-3-mini first (fast, cheap, 131k context)
    const startTime = Date.now();
    let result: ParseCommandResponse;
    let latency: number;
    let model: string;

    try {
      result = await tryParseCommand(command, context, 'grok-3-mini', GROK_3_MINI_TIMEOUT);
      latency = Date.now() - startTime;
      model = 'grok-3-mini';
      
      console.log(`grok-3-mini parsed command with confidence: ${result.confidence}`);
    } catch (primaryError) {
      console.error('grok-3-mini failed:', primaryError);
      
      // Fallback to grok-3 (powerful reasoning, slower)
      console.log('Falling back to grok-3...');
      const fallbackStartTime = Date.now();
      
      try {
        result = await tryParseCommand(command, context, 'grok-3', GROK_3_TIMEOUT);
        latency = Date.now() - fallbackStartTime;
        model = 'grok-3';
        
        console.log(`grok-3 parsed command with confidence: ${result.confidence}`);
      } catch (fallbackError) {
        console.error('grok-3 also failed:', fallbackError);
        throw new Error('Both primary and fallback models failed to parse command');
      }
    }

    // If confidence is low from grok-3-mini, try grok-3 for better reasoning
    if (model === 'grok-3-mini' && result.confidence < LOW_CONFIDENCE_THRESHOLD) {
      console.log(
        `Low confidence (${result.confidence}) from grok-3-mini, trying grok-3 for better reasoning...`
      );
      
      const fallbackStartTime = Date.now();
      try {
        const fallbackResult = await tryParseCommand(command, context, 'grok-3', GROK_3_TIMEOUT);
        const fallbackLatency = Date.now() - fallbackStartTime;

        // Use grok-3 result if it has higher confidence
        if (fallbackResult.confidence > result.confidence) {
          result = fallbackResult;
          latency = fallbackLatency;
          model = 'grok-3';
          console.log(`grok-3 provided better confidence: ${result.confidence}`);
        }
      } catch (fallbackError) {
        console.error('Fallback to grok-3 failed:', fallbackError);
        // Continue with grok-3-mini result
      }
    }

    // Validate the response structure
    const validatedResult = validateCommandResponse(result);

    return successResponse(res, {
      ...validatedResult,
      model,
      latency,
    });
  } catch (error) {
    console.error('Error parsing command:', error);
    
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to parse command'
    );
  }
}
