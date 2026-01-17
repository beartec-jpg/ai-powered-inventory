/**
 * Stage 1: Intent Classification API
 * Simple focused task - just identify WHAT the user wants to do
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import {
  successResponse,
  badRequestResponse,
  internalServerErrorResponse,
  setCorsHeaders,
} from '../lib/utils.js';
import { callGrokJSON, isGrokConfigured } from '../lib/grok.js';

// List of all supported actions
const ACTIONS = [
  'ADD_STOCK',
  'REMOVE_STOCK',
  'TRANSFER_STOCK',
  'COUNT_STOCK',
  'SEARCH_STOCK',
  'LOW_STOCK_REPORT',
  'ADD_PRODUCT',
  'UPDATE_PRODUCT',
  'SEARCH_CATALOGUE',
  'ADD_CUSTOMER',
  'UPDATE_CUSTOMER',
  'ADD_SITE',
  'SEARCH_CUSTOMERS',
  'ADD_EQUIPMENT',
  'UPDATE_EQUIPMENT',
  'INSTALL_PART',
  'SEARCH_EQUIPMENT',
  'CREATE_JOB',
  'UPDATE_JOB',
  'COMPLETE_JOB',
  'ADD_PARTS_TO_JOB',
  'SEARCH_JOBS',
  'ADD_SUPPLIER',
  'CREATE_ORDER',
  'RECEIVE_ORDER',
  'QUERY_INVENTORY',
];

// Configuration for secondary input validation
const SECONDARY_INPUT_CONFIG = {
  // Pattern to match valid location formats
  locationPattern: /^(rack\s+\d+|bin\s+\d+|shelf\s+[a-z]\d+|warehouse|van\s*\d*|storage)$/i,
  // Confidence level for validated secondary inputs
  secondaryInputConfidence: 0.9,
};

interface ClassificationResponse {
  action: string;
  confidence: number;
  reasoning?: string;
}

/**
 * Core classification logic (can be called directly or via HTTP)
 */
export async function classifyIntentCore(
  command: string,
  context?: string | { pendingAction?: string; missingFields?: string[]; [key: string]: unknown }
): Promise<ClassificationResponse> {
  if (!isGrokConfigured()) {
    throw new Error('AI service is not configured');
  }

  // Handle context as either string or object with pendingAction/missingFields
  let contextInfo = '';
  let pendingAction: string | undefined;
  let missingFields: string[] | undefined;
  
  if (typeof context === 'string') {
    contextInfo = `\n\nRecent context:\n${context}`;
  } else if (context && typeof context === 'object') {
    pendingAction = context.pendingAction;
    missingFields = context.missingFields;
    if (pendingAction || missingFields) {
      contextInfo = `\n\nPending Action Context:\n- Action: ${pendingAction || 'N/A'}\n- Missing Fields: ${missingFields?.join(', ') || 'none'}`;
    }
  }

  const systemPrompt = `You are an expert at classifying user commands for a Field Service & Inventory Management system.

Your ONLY job is to identify the action type from the user's command. Return ONLY a JSON object with:
- action: one of the supported actions (see list below)
- confidence: a number between 0 and 1
- reasoning: brief explanation

SUPPORTED ACTIONS:
${ACTIONS.map((a) => `- ${a}`).join('\n')}

ACTION GUIDELINES:
- ADD_STOCK: Adding, receiving, putting items into stock at a location
- REMOVE_STOCK: Using, taking, consuming items from stock
- TRANSFER_STOCK: Moving items between locations
- COUNT_STOCK: Physical stock count, verifying quantities
- SEARCH_STOCK: Searching for items currently in stock
- LOW_STOCK_REPORT: Report of items below minimum levels
- ADD_PRODUCT: Adding new products to catalogue (with pricing)
- UPDATE_PRODUCT: Updating product details/pricing
- SEARCH_CATALOGUE: Searching all products (stocked or not)
- ADD_CUSTOMER: Creating new customer
- ADD_SITE: Adding site address to customer
- ADD_EQUIPMENT: Adding equipment/asset at customer site
- INSTALL_PART: Installing part on equipment
- CREATE_JOB: Creating work order/job
- COMPLETE_JOB: Marking job as complete
- ADD_PARTS_TO_JOB: Adding parts used on job
- ADD_SUPPLIER: Creating supplier
- CREATE_ORDER: Creating purchase order
- QUERY_INVENTORY: General query or unclear intent

CRITICAL: HANDLING SECONDARY INPUT (Missing Parameter Responses)
When a pending action context is provided with missing fields, the user's input should be interpreted as providing those missing parameters, NOT as a new command:
- If pendingAction is ADD_STOCK and location is missing, inputs like "rack 1", "bin 5", "shelf A1" should be classified as ADD_STOCK (continuing the pending action)
- If pendingAction is REMOVE_STOCK and location is missing, similar location inputs should be classified as REMOVE_STOCK
- Only classify as a new action if the input clearly indicates a completely different intent
- Location formats typically match: "rack N", "bin N", "shelf XN", "warehouse", "van N"

EXAMPLES:
"Add 5 M10 nuts to rack 1 bin6" → ADD_STOCK (confidence: 0.95)
"Used 2 filters from van" → REMOVE_STOCK (confidence: 0.95)
"Move 10 bolts from warehouse to van" → TRANSFER_STOCK (confidence: 0.95)
"I've got 50 bearings on shelf A" → COUNT_STOCK (confidence: 0.9)
"What bearings do we have?" → SEARCH_STOCK (confidence: 0.9)
"Add new item cable cost 25" → ADD_PRODUCT (confidence: 0.9)
"New customer ABC Heating" → ADD_CUSTOMER (confidence: 0.95)
"New job for ABC Heating" → CREATE_JOB (confidence: 0.95)

Be confident when the intent is clear. Return lower confidence (<0.7) only when truly ambiguous.`;

  const userPrompt = `Classify this command: "${command}"${contextInfo}`;

  console.log(`[Classify Intent] Command: "${command}"`);

  const result = await callGrokJSON<ClassificationResponse>(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      model: 'grok-3-mini',
      temperature: 0.1,
      maxTokens: 200,
      timeout: 10000,
    }
  );

  console.log(
    `[Classify Intent] Result: ${result.action} (confidence: ${result.confidence})`
  );

  // Post-processing: Handle secondary input for pending actions
  // TODO: This currently only handles 'location' field. Future enhancement could make this
  // more generic to handle other fields (quantity, item, etc.) with similar patterns.
  if (pendingAction && missingFields && missingFields.length > 0) {
    const commandLower = command.trim().toLowerCase();
    
    // If we have a pending action and the input looks like it's providing a missing parameter
    // (e.g., just a location string), ensure we classify as the pending action
    if (missingFields.includes('location') && SECONDARY_INPUT_CONFIG.locationPattern.test(commandLower)) {
      console.log(`[Classify Intent] Secondary input detected: providing location for ${pendingAction}`);
      result.action = pendingAction;
      result.confidence = SECONDARY_INPUT_CONFIG.secondaryInputConfidence;
      result.reasoning = `Secondary input providing missing location for ${pendingAction}`;
    }
  }

  // Validate action is in supported list
  if (!ACTIONS.includes(result.action)) {
    console.warn(
      `[Classify Intent] Unknown action: ${result.action}, defaulting to QUERY_INVENTORY`
    );
    result.action = 'QUERY_INVENTORY';
    result.confidence = 0.3;
  }

  return result;
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

  try {
    const result = await classifyIntentCore(command, context);
    return successResponse(res, result);
  } catch (error) {
    console.error('[Classify Intent] Error:', error);

    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to classify intent'
    );
  }
}
