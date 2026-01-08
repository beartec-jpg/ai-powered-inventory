import { VercelRequest, VercelResponse } from '@vercel/node';
import { OpenAI } from 'openai';
import { 
  successResponse, 
  badRequestResponse, 
  internalServerErrorResponse,
  setCorsHeaders 
} from '../lib/utils';

// Initialize OpenAI client configured for xAI (Grok)
const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

interface ParseCommandResponse {
  action: string;
  parameters: Record<string, unknown>;
  confidence: number;
  interpretation: string;
  clarificationNeeded?: string;
  model?: string;
  latency?: number;
}

/**
 * Try to parse a command using a specific model
 */
async function tryParseCommand(
  command: string,
  context: Record<string, unknown> | undefined,
  modelName: string
): Promise<ParseCommandResponse> {
  const contextStr = context ? `\nContext: ${JSON.stringify(context)}` : '';
  const prompt = `Parse this inventory command and extract the action and parameters: "${command}"${contextStr}

Respond in JSON format like this: 
{
  "action": "action_name", 
  "parameters": {"key": "value"},
  "confidence": 0.95,
  "interpretation": "Brief explanation of what will be done",
  "clarificationNeeded": "Optional question if unclear"
}

Possible actions: add_item, remove_item, move_item, update_quantity, create_location, stock_check, create_job, create_customer, query, list_items

Be smart about understanding intent. Set confidence between 0 and 1 based on how certain you are about the interpretation.
If you need clarification, set confidence < 0.7 and provide a clarificationNeeded question.`;

  const completion = await openai.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const responseText = completion.choices[0]?.message?.content || '';
  
  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse JSON from AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    action: parsed.action || 'unknown',
    parameters: parsed.parameters || {},
    confidence: parsed.confidence || 0.5,
    interpretation: parsed.interpretation || 'Unable to interpret command',
    clarificationNeeded: parsed.clarificationNeeded,
  };
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
    // Try grok-2-latest first (fast, cheap)
    const startTime = Date.now();
    let result = await tryParseCommand(command, context, 'grok-2-latest');
    let latency = Date.now() - startTime;
    let model = 'grok-2-latest';

    // Fallback to grok-beta if confidence is low
    if (result.confidence < 0.75) {
      console.log(
        `Low confidence (${result.confidence}) from grok-2-latest, trying grok-beta...`
      );
      
      const fallbackStartTime = Date.now();
      try {
        const fallbackResult = await tryParseCommand(command, context, 'grok-beta');
        const fallbackLatency = Date.now() - fallbackStartTime;

        // Use fallback result if it has higher confidence
        if (fallbackResult.confidence > result.confidence) {
          result = fallbackResult;
          latency = fallbackLatency;
          model = 'grok-beta';
        }
      } catch (fallbackError) {
        console.error('Fallback to grok-beta failed:', fallbackError);
        // Continue with original result
      }
    }

    return successResponse(res, {
      ...result,
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
