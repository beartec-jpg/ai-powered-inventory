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

interface ClassificationResponse {
  action: string;
  confidence: number;
  reasoning?: string;
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

  if (!isGrokConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message: 'AI service is not configured',
    });
  }

  try {
    const contextInfo = context ? `\n\nRecent context:\n${context}` : '';

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

    // Validate action is in supported list
    if (!ACTIONS.includes(result.action)) {
      console.warn(
        `[Classify Intent] Unknown action: ${result.action}, defaulting to QUERY_INVENTORY`
      );
      result.action = 'QUERY_INVENTORY';
      result.confidence = 0.3;
    }

    return successResponse(res, result);
  } catch (error) {
    console.error('[Classify Intent] Error:', error);

    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to classify intent'
    );
  }
}
