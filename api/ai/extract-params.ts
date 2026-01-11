/**
 * Stage 2: Parameter Extraction API
 * Once we know the action, extract ONLY the relevant parameters
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import {
  successResponse,
  badRequestResponse,
  internalServerErrorResponse,
  setCorsHeaders,
} from '../lib/utils.js';
import { callGrokJSON, isGrokConfigured } from '../lib/grok.js';

interface ExtractionResponse {
  parameters: Record<string, unknown>;
  missingRequired: string[];
  confidence: number;
}

// Parameter definitions for each action
const ACTION_PARAMS: Record<
  string,
  {
    required: string[];
    optional: string[];
    description: string;
    examples: string[];
  }
> = {
  ADD_STOCK: {
    required: ['item', 'quantity', 'location'],
    optional: ['partNumber', 'supplier', 'notes'],
    description:
      'Adding stock to inventory. Extract item name, quantity (number), and location.',
    examples: [
      '"Add 5 M10 nuts to rack 1 bin6" → { item: "M10 nuts", quantity: 5, location: "rack 1 bin6" }',
      '"Received 20 bearings into warehouse" → { item: "bearings", quantity: 20, location: "warehouse" }',
    ],
  },
  REMOVE_STOCK: {
    required: ['item', 'quantity', 'location'],
    optional: ['partNumber', 'reason', 'jobNumber'],
    description:
      'Removing stock from inventory. Extract item, quantity, location, and optional reason.',
    examples: [
      '"Used 2 filters from van" → { item: "filters", quantity: 2, location: "van", reason: "usage" }',
      '"Take 5 bearings from warehouse" → { item: "bearings", quantity: 5, location: "warehouse" }',
    ],
  },
  TRANSFER_STOCK: {
    required: ['item', 'quantity', 'fromLocation', 'toLocation'],
    optional: ['partNumber', 'notes'],
    description: 'Moving stock between locations. Extract from and to locations.',
    examples: [
      '"Move 10 bolts from warehouse to van" → { item: "bolts", quantity: 10, fromLocation: "warehouse", toLocation: "van" }',
    ],
  },
  COUNT_STOCK: {
    required: ['item', 'quantity', 'location'],
    optional: ['partNumber', 'notes', 'countedQuantity'],
    description:
      'Physical stock count. Extract item, counted quantity, and location. Note: quantity and countedQuantity are the same value.',
    examples: [
      '"I\'ve got 50 bearings on shelf A" → { item: "bearings", quantity: 50, countedQuantity: 50, location: "shelf A" }',
    ],
  },
  SEARCH_STOCK: {
    required: ['search'],
    optional: ['location'],
    description: 'Searching current stock. Extract search term.',
    examples: [
      '"What bearings do we have?" → { search: "bearings" }',
      '"Show bolts in warehouse" → { search: "bolts", location: "warehouse" }',
    ],
  },
  LOW_STOCK_REPORT: {
    required: [],
    optional: ['location'],
    description: 'Low stock report. Optionally filter by location.',
    examples: [
      '"Show low stock" → {}',
      '"Low stock in warehouse" → { location: "warehouse" }',
    ],
  },
  ADD_PRODUCT: {
    required: ['partNumber', 'name'],
    optional: [
      'description',
      'manufacturer',
      'category',
      'unitCost',
      'markup',
      'sellPrice',
      'minQuantity',
      'preferredSupplierName',
    ],
    description:
      'Adding product to catalogue. Extract part number, name, cost, markup percentage.',
    examples: [
      '"Add new item cable 0.75mm cost 25 markup 35%" → { partNumber: "cable", name: "cable 0.75mm", unitCost: 25, markup: 35 }',
      '"Create product LMV37 cost 450 markup 40%" → { partNumber: "LMV37", name: "LMV37", unitCost: 450, markup: 40 }',
    ],
  },
  UPDATE_PRODUCT: {
    required: ['partNumber'],
    optional: ['name', 'unitCost', 'markup', 'sellPrice', 'minQuantity'],
    description: 'Updating product details. Extract part number and fields to update.',
    examples: ['"Update LMV37 cost to 500" → { partNumber: "LMV37", unitCost: 500 }'],
  },
  SEARCH_CATALOGUE: {
    required: ['search'],
    optional: ['category', 'manufacturer'],
    description: 'Searching catalogue. Extract search term.',
    examples: ['"Find cables" → { search: "cables" }'],
  },
  ADD_CUSTOMER: {
    required: ['name'],
    optional: ['type', 'contactName', 'email', 'phone'],
    description: 'Creating customer. Extract customer name and optional details.',
    examples: [
      '"New customer ABC Heating" → { name: "ABC Heating" }',
      '"Add customer XYZ Ltd type commercial" → { name: "XYZ Ltd", type: "commercial" }',
    ],
  },
  UPDATE_CUSTOMER: {
    required: ['customerName'],
    optional: ['contactName', 'email', 'phone'],
    description: 'Updating customer. Extract customer name and fields to update.',
    examples: [
      '"Update ABC Heating contact to John" → { customerName: "ABC Heating", contactName: "John" }',
    ],
  },
  ADD_SITE: {
    required: ['customerName', 'siteName', 'address'],
    optional: ['postcode'],
    description: 'Adding site to customer. Extract customer, site name, address.',
    examples: [
      '"Add site Office for ABC at 123 High St" → { customerName: "ABC", siteName: "Office", address: "123 High St" }',
    ],
  },
  SEARCH_CUSTOMERS: {
    required: ['search'],
    optional: [],
    description: 'Searching customers. Extract search term.',
    examples: ['"Find customer ABC" → { search: "ABC" }'],
  },
  ADD_EQUIPMENT: {
    required: ['customerName', 'equipmentName', 'type'],
    optional: ['manufacturer', 'model', 'serialNumber'],
    description: 'Adding equipment at customer site. Extract customer, equipment name, type.',
    examples: [
      '"Add boiler Main Boiler for ABC" → { customerName: "ABC", equipmentName: "Main Boiler", type: "boiler" }',
    ],
  },
  UPDATE_EQUIPMENT: {
    required: ['customerName', 'equipmentName'],
    optional: ['notes'],
    description: 'Updating equipment. Extract customer and equipment name.',
    examples: [
      '"Update Main Boiler for ABC" → { customerName: "ABC", equipmentName: "Main Boiler" }',
    ],
  },
  INSTALL_PART: {
    required: ['partNumber', 'quantity', 'customerName', 'equipmentName'],
    optional: ['location'],
    description:
      'Installing part on equipment. Extract part, quantity, customer, equipment. Location is where stock is taken from.',
    examples: [
      '"Install 2 filters on Main Boiler for ABC" → { partNumber: "filter", quantity: 2, customerName: "ABC", equipmentName: "Main Boiler" }',
      '"Install filter on Main Boiler for ABC" → { partNumber: "filter", quantity: 1, customerName: "ABC", equipmentName: "Main Boiler" }',
    ],
  },
  SEARCH_EQUIPMENT: {
    required: [],
    optional: ['customerName', 'type'],
    description: 'Searching equipment. Optionally filter by customer or type.',
    examples: ['"Show equipment for ABC" → { customerName: "ABC" }'],
  },
  CREATE_JOB: {
    required: ['customerName'],
    optional: ['type', 'description', 'equipmentName', 'priority'],
    description:
      'Creating job. Extract customer name and optional type, description. Type can be: service, repair, installation, maintenance.',
    examples: [
      '"New job for ABC - boiler repair" → { customerName: "ABC", description: "boiler repair", type: "repair" }',
      '"Create service job for XYZ" → { customerName: "XYZ", type: "service" }',
    ],
  },
  UPDATE_JOB: {
    required: ['jobNumber'],
    optional: ['status', 'notes'],
    description: 'Updating job. Extract job number and fields to update.',
    examples: ['"Update job 1234 status to completed" → { jobNumber: "1234", status: "completed" }'],
  },
  COMPLETE_JOB: {
    required: ['jobNumber'],
    optional: ['workCarriedOut', 'notes'],
    description: 'Completing job. Extract job number.',
    examples: ['"Complete job 1234" → { jobNumber: "1234" }'],
  },
  ADD_PARTS_TO_JOB: {
    required: ['jobNumber', 'partNumber', 'quantity'],
    optional: [],
    description: 'Adding parts to job. Extract job number, part number, quantity.',
    examples: ['"Add 2 filters to job 1234" → { jobNumber: "1234", partNumber: "filters", quantity: 2 }'],
  },
  SEARCH_JOBS: {
    required: [],
    optional: ['customerName', 'status'],
    description: 'Searching jobs. Optionally filter by customer or status.',
    examples: [
      '"Show jobs for ABC" → { customerName: "ABC" }',
      '"List completed jobs" → { status: "completed" }',
    ],
  },
  ADD_SUPPLIER: {
    required: ['name'],
    optional: ['contactName', 'email', 'phone'],
    description: 'Creating supplier. Extract supplier name.',
    examples: ['"New supplier Acme Corp" → { name: "Acme Corp" }'],
  },
  CREATE_ORDER: {
    required: ['supplierName'],
    optional: ['items'],
    description: 'Creating purchase order. Extract supplier name.',
    examples: ['"Create order from Acme" → { supplierName: "Acme" }'],
  },
  RECEIVE_ORDER: {
    required: ['poNumber'],
    optional: [],
    description: 'Receiving order. Extract PO number.',
    examples: ['"Receive order PO-1234" → { poNumber: "PO-1234" }'],
  },
  QUERY_INVENTORY: {
    required: [],
    optional: ['search', 'queryType'],
    description: 'General query. Extract any search terms.',
    examples: ['"What do we have?" → { search: "" }'],
  },
};

/**
 * Core extraction logic (can be called directly or via HTTP)
 */
export async function extractParametersCore(
  command: string,
  action: string,
  context?: string
): Promise<ExtractionResponse> {
  if (!isGrokConfigured()) {
    throw new Error('AI service is not configured');
  }

  // Get parameter definition for this action
  const paramDef = ACTION_PARAMS[action];
  if (!paramDef) {
    console.warn(`[Extract Params] Unknown action: ${action}`);
    return {
      parameters: {},
      missingRequired: [],
      confidence: 0.5,
    };
  }

  const contextInfo = context ? `\n\nRecent context:\n${context}` : '';

  const systemPrompt = `You are an expert at extracting parameters from user commands for a ${action} action.

ACTION: ${action}
DESCRIPTION: ${paramDef.description}

REQUIRED PARAMETERS: ${paramDef.required.length > 0 ? paramDef.required.join(', ') : 'none'}
OPTIONAL PARAMETERS: ${paramDef.optional.length > 0 ? paramDef.optional.join(', ') : 'none'}

EXAMPLES:
${paramDef.examples.join('\n')}

Your job is to extract these parameters from the user's command. Return ONLY a JSON object with:
- parameters: object with extracted parameter values (use correct types: numbers for quantities, strings for names)
- missingRequired: array of required parameter names that are missing
- confidence: number between 0 and 1 indicating extraction confidence

IMPORTANT:
- Extract exact values from the command
- For quantities, extract as numbers (not strings)
- For item names, preserve the exact phrasing
- For locations, preserve the exact location identifier
- If a required parameter is clearly stated, include it
- If a required parameter is not mentioned, add its name to missingRequired
- Be confident (>0.8) when parameters are clearly stated`;

  const userPrompt = `Extract parameters for ${action} from: "${command}"${contextInfo}`;

  console.log(`[Extract Params] Action: ${action}, Command: "${command}"`);

  const result = await callGrokJSON<ExtractionResponse>(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      model: 'grok-3-mini',
      temperature: 0.1,
      maxTokens: 300,
      timeout: 10000,
    }
  );

  console.log(
    `[Extract Params] Result:`,
    result.parameters,
    `Missing: ${result.missingRequired?.join(', ') || 'none'}`
  );

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

  const { command, action, context } = req.body;

  if (!command || typeof command !== 'string') {
    return badRequestResponse(res, 'Command is required and must be a string');
  }

  if (!action || typeof action !== 'string') {
    return badRequestResponse(res, 'Action is required and must be a string');
  }

  try {
    const result = await extractParametersCore(command, action, context);
    return successResponse(res, result);
  } catch (error) {
    console.error('[Extract Params] Error:', error);

    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'Failed to extract parameters'
    );
  }
}
