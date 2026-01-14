import { VercelRequest, VercelResponse } from '@vercel/node';
// NOTE: Removed openai SDK import to avoid peer dependency conflicts with zod versions.
// Using fetch-based Grok client instead.
import { 
  successResponse, 
  badRequestResponse, 
  internalServerErrorResponse,
  setCorsHeaders,
  validateCommandResponse 
} from '../lib/utils.js';
import { classifyIntentCore } from './classify-intent.js';
import { extractParametersCore } from './extract-params.js';

// Action types for inventory operations
type InventoryAction = 
  // Catalogue Management
  | 'CREATE_CATALOGUE_ITEM'
  | 'UPDATE_CATALOGUE_ITEM'
  | 'SEARCH_CATALOGUE'
  // Stock Management
  | 'RECEIVE_STOCK'
  | 'PUT_AWAY_STOCK'
  | 'USE_STOCK'
  | 'TRANSFER_STOCK'
  | 'STOCK_COUNT'
  | 'SEARCH_STOCK'
  | 'LOW_STOCK_REPORT'
  | 'SET_MIN_STOCK'
  // Customer & Equipment
  | 'CREATE_CUSTOMER'
  | 'ADD_SITE_ADDRESS'
  | 'CREATE_EQUIPMENT'
  | 'UPDATE_EQUIPMENT'
  | 'LIST_EQUIPMENT'
  // Parts Installation
  | 'INSTALL_FROM_STOCK'
  | 'INSTALL_DIRECT_ORDER'
  | 'QUERY_EQUIPMENT_PARTS'
  | 'QUERY_CUSTOMER_PARTS'
  // Jobs
  | 'CREATE_JOB'
  | 'SCHEDULE_JOB'
  | 'START_JOB'
  | 'COMPLETE_JOB'
  | 'ADD_PART_TO_JOB'
  | 'LIST_JOBS'
  // Suppliers & Orders
  | 'CREATE_SUPPLIER'
  | 'CREATE_PURCHASE_ORDER'
  | 'RECEIVE_PURCHASE_ORDER'
  // Legacy
  | 'ADJUST_STOCK' 
  | 'CREATE_PRODUCT' 
  | 'UPDATE_PRODUCT'
  | 'QUERY_INVENTORY';

interface ParseCommandResponse {
  action: InventoryAction;
  parameters: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  clarificationNeeded?: string;
  model?: string;
  latency?: number;
  // Debug info
  debug?: {
    stage1: {
      action: string;
      confidence: number;
      reasoning?: string;
    };
    stage2: {
      parameters: Record<string, unknown>;
      missingRequired: string[];
      confidence: number;
    };
    usedFallback: boolean;
    fallbackReason?: string;
    rawCommand: string;
  };
}

// Constants for confidence levels and timeouts
const HIGH_CONFIDENCE = 0.9;
const MEDIUM_CONFIDENCE = 0.6;
const DEFAULT_CONFIDENCE = 0.5;
const LOW_CONFIDENCE_THRESHOLD = 0.7;
const GROK_3_MINI_TIMEOUT = 15000;
const GROK_3_TIMEOUT = 30000;

// Define tool schemas for inventory operations
const inventoryTools = [
  // ===== CATALOGUE MANAGEMENT =====
  {
    type: 'function' as const,
    function: {
      name: 'create_catalogue_item',
      description: 'Add a new product to the catalogue. USE THIS when user says "Add new item", "Add to catalogue", "Create product", or provides product details with cost/pricing info. This creates a catalogue entry (not necessarily in stock).',
      parameters: {
        type: 'object',
        properties: {
          partNumber: {
            type: 'string',
            description: 'The unique part number/SKU for the product',
          },
          name: {
            type: 'string',
            description: 'The product name',
          },
          description: {
            type: 'string',
            description: 'Product description',
          },
          manufacturer: {
            type: 'string',
            description: 'Manufacturer name - ONLY extract if command says "by [name]", "made by [name]", "manufactured by [name]", or "manufacturer: [name]". Do NOT extract from "from [name]" which refers to supplier.',
          },
          category: {
            type: 'string',
            description: 'Product category (e.g., "cables", "sensors", "valves")',
          },
          subcategory: {
            type: 'string',
            description: 'Product subcategory',
          },
          unitCost: {
            type: 'number',
            description: 'Cost price per unit',
          },
          markup: {
            type: 'number',
            description: 'Markup percentage (e.g., 35 for 35%)',
          },
          sellPrice: {
            type: 'number',
            description: 'Selling price (if not using markup calculation)',
          },
          isStocked: {
            type: 'boolean',
            description: 'Whether this item is normally kept in stock',
          },
          minQuantity: {
            type: 'number',
            description: 'Minimum stock level / reorder point',
          },
          preferredSupplierName: {
            type: 'string',
            description: 'Preferred supplier name - Extract from "from [name]", "supplied by [name]", "supplier: [name]", or "bought from [name]". This is where you source/purchase the item, NOT who manufactures it.',
          },
          attributes: {
            type: 'object',
            description: 'Flexible attributes like size, color, voltage (e.g., {"color": "black", "size": "0.75mm"})',
          },
        },
        required: ['partNumber', 'name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_catalogue_item',
      description: 'Update an existing catalogue item (pricing, details, etc.)',
      parameters: {
        type: 'object',
        properties: {
          partNumber: {
            type: 'string',
            description: 'The part number of the item to update',
          },
          name: {
            type: 'string',
            description: 'Updated product name',
          },
          unitCost: {
            type: 'number',
            description: 'Updated cost price',
          },
          markup: {
            type: 'number',
            description: 'Updated markup percentage',
          },
          sellPrice: {
            type: 'number',
            description: 'Updated selling price',
          },
          minQuantity: {
            type: 'number',
            description: 'Updated minimum stock level',
          },
          isStocked: {
            type: 'boolean',
            description: 'Whether this item should be stocked',
          },
          active: {
            type: 'boolean',
            description: 'Whether the product is active',
          },
        },
        required: ['partNumber'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_catalogue',
      description: 'Search for products in the catalogue (both stocked and non-stocked items)',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term (searches part number, name, description, manufacturer)',
          },
          category: {
            type: 'string',
            description: 'Filter by category',
          },
          manufacturer: {
            type: 'string',
            description: 'Filter by manufacturer',
          },
        },
        required: ['search'],
      },
    },
  },
  
  // ===== STOCK MANAGEMENT =====
  {
    type: 'function' as const,
    function: {
      name: 'receive_stock',
      description: 'Add stock from a delivery/receipt. Increases stock quantity at a location.',
      parameters: {
        type: 'object',
        properties: {
          partNumber: {
            type: 'string',
            description: 'The part number of the item received',
          },
          quantity: {
            type: 'number',
            description: 'The quantity received (must be positive)',
          },
          location: {
            type: 'string',
            description: 'The location where stock is received (e.g., "Warehouse", "Van 1")',
          },
          supplierName: {
            type: 'string',
            description: 'The supplier name',
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the receipt',
          },
        },
        required: ['partNumber', 'quantity', 'location'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'put_away_stock',
      description: 'Set or change the location of stock (e.g., move from receiving to specific bin)',
      parameters: {
        type: 'object',
        properties: {
          partNumber: {
            type: 'string',
            description: 'The part number',
          },
          fromLocation: {
            type: 'string',
            description: 'Current location',
          },
          toLocation: {
            type: 'string',
            description: 'New location (e.g., "Rack 12 Bin 2")',
          },
          quantity: {
            type: 'number',
            description: 'Quantity to move (optional, defaults to all)',
          },
        },
        required: ['partNumber', 'fromLocation', 'toLocation'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'use_stock',
      description: 'Decrease stock quantity (for jobs, installations, etc.)',
      parameters: {
        type: 'object',
        properties: {
          partNumber: {
            type: 'string',
            description: 'The part number',
          },
          quantity: {
            type: 'number',
            description: 'The quantity to use (must be positive)',
          },
          location: {
            type: 'string',
            description: 'The location where stock is taken from',
          },
          reason: {
            type: 'string',
            description: 'Reason for using stock (e.g., "job", "installation", "damaged")',
          },
          jobNumber: {
            type: 'string',
            description: 'Related job number if applicable',
          },
        },
        required: ['partNumber', 'quantity', 'location', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'transfer_stock',
      description: 'Transfer stock between locations',
      parameters: {
        type: 'object',
        properties: {
          partNumber: {
            type: 'string',
            description: 'The part number to transfer',
          },
          fromLocation: {
            type: 'string',
            description: 'Source location',
          },
          toLocation: {
            type: 'string',
            description: 'Destination location',
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
        required: ['partNumber', 'fromLocation', 'toLocation', 'quantity'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'stock_count',
      description: 'Verify/count stock quantity and compare to expected. Updates stock level if different.',
      parameters: {
        type: 'object',
        properties: {
          partNumber: {
            type: 'string',
            description: 'The part number being counted',
          },
          location: {
            type: 'string',
            description: 'The location where counting is happening',
          },
          countedQuantity: {
            type: 'number',
            description: 'The actual quantity counted',
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the count',
          },
        },
        required: ['partNumber', 'location', 'countedQuantity'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_stock',
      description: 'Search for items currently IN STOCK (quantity > 0)',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search term for part number or name',
          },
          location: {
            type: 'string',
            description: 'Filter by location',
          },
        },
        required: ['search'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'low_stock_report',
      description: 'Get items with stock below minimum quantity',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'Optional filter by location',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_min_stock',
      description: 'Set the minimum stock level / reorder point for an item',
      parameters: {
        type: 'object',
        properties: {
          partNumber: {
            type: 'string',
            description: 'The part number',
          },
          minQuantity: {
            type: 'number',
            description: 'The minimum stock level',
          },
          reorderQuantity: {
            type: 'number',
            description: 'Optional standard reorder quantity',
          },
        },
        required: ['partNumber', 'minQuantity'],
      },
    },
  },
  
  // ===== CUSTOMER & EQUIPMENT =====
  {
    type: 'function' as const,
    function: {
      name: 'create_customer',
      description: 'Create a new customer',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Customer name',
          },
          type: {
            type: 'string',
            enum: ['commercial', 'residential', 'industrial'],
            description: 'Customer type',
          },
          contactName: {
            type: 'string',
            description: 'Primary contact name',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
          phone: {
            type: 'string',
            description: 'Phone number',
          },
          billingAddress: {
            type: 'string',
            description: 'Billing address',
          },
        },
        required: ['name', 'type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_site_address',
      description: 'Add a site address to a customer',
      parameters: {
        type: 'object',
        properties: {
          customerName: {
            type: 'string',
            description: 'Customer name',
          },
          siteName: {
            type: 'string',
            description: 'Site name (e.g., "Main Office", "Factory 2")',
          },
          address: {
            type: 'string',
            description: 'Full site address',
          },
          postcode: {
            type: 'string',
            description: 'Postcode',
          },
          accessNotes: {
            type: 'string',
            description: 'Access instructions',
          },
        },
        required: ['customerName', 'siteName', 'address'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_equipment',
      description: 'Add equipment/asset at a customer site',
      parameters: {
        type: 'object',
        properties: {
          customerName: {
            type: 'string',
            description: 'Customer name',
          },
          equipmentName: {
            type: 'string',
            description: 'Equipment name/identifier (e.g., "Main Boiler", "Chiller Unit 1")',
          },
          type: {
            type: 'string',
            description: 'Equipment type (e.g., "boiler", "chiller", "pump")',
          },
          manufacturer: {
            type: 'string',
            description: 'Manufacturer',
          },
          model: {
            type: 'string',
            description: 'Model number',
          },
          serialNumber: {
            type: 'string',
            description: 'Serial number',
          },
          location: {
            type: 'string',
            description: 'Location at site',
          },
        },
        required: ['customerName', 'equipmentName', 'type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_equipment',
      description: 'Update equipment details',
      parameters: {
        type: 'object',
        properties: {
          customerName: {
            type: 'string',
            description: 'Customer name',
          },
          equipmentName: {
            type: 'string',
            description: 'Equipment name',
          },
          lastServiceDate: {
            type: 'number',
            description: 'Last service date (timestamp)',
          },
          nextServiceDue: {
            type: 'number',
            description: 'Next service due date (timestamp)',
          },
          technicalNotes: {
            type: 'string',
            description: 'Technical notes',
          },
        },
        required: ['customerName', 'equipmentName'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_equipment',
      description: 'List equipment for a customer',
      parameters: {
        type: 'object',
        properties: {
          customerName: {
            type: 'string',
            description: 'Customer name',
          },
        },
        required: ['customerName'],
      },
    },
  },
  
  // ===== PARTS INSTALLATION =====
  {
    type: 'function' as const,
    function: {
      name: 'install_from_stock',
      description: 'Install a part from stock onto customer equipment (decrements stock)',
      parameters: {
        type: 'object',
        properties: {
          partNumber: {
            type: 'string',
            description: 'Part number to install',
          },
          quantity: {
            type: 'number',
            description: 'Quantity to install',
          },
          customerName: {
            type: 'string',
            description: 'Customer name',
          },
          equipmentName: {
            type: 'string',
            description: 'Equipment name',
          },
          location: {
            type: 'string',
            description: 'Stock location to take from (e.g., "Van 1")',
          },
          jobNumber: {
            type: 'string',
            description: 'Related job number',
          },
        },
        required: ['partNumber', 'quantity', 'customerName', 'equipmentName', 'location'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'install_direct_order',
      description: 'Record a part installed that was ordered direct (no stock change)',
      parameters: {
        type: 'object',
        properties: {
          partNumber: {
            type: 'string',
            description: 'Part number',
          },
          name: {
            type: 'string',
            description: 'Part name',
          },
          quantity: {
            type: 'number',
            description: 'Quantity installed',
          },
          customerName: {
            type: 'string',
            description: 'Customer name',
          },
          equipmentName: {
            type: 'string',
            description: 'Equipment name',
          },
          supplierName: {
            type: 'string',
            description: 'Supplier name',
          },
          unitCost: {
            type: 'number',
            description: 'Cost per unit',
          },
          sellPrice: {
            type: 'number',
            description: 'Sell price per unit',
          },
        },
        required: ['partNumber', 'name', 'quantity', 'customerName', 'equipmentName', 'supplierName'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_equipment_parts',
      description: 'Get all parts installed on specific equipment',
      parameters: {
        type: 'object',
        properties: {
          customerName: {
            type: 'string',
            description: 'Customer name',
          },
          equipmentName: {
            type: 'string',
            description: 'Equipment name',
          },
        },
        required: ['customerName', 'equipmentName'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_customer_parts',
      description: 'Get all parts installed for a customer (across all equipment)',
      parameters: {
        type: 'object',
        properties: {
          customerName: {
            type: 'string',
            description: 'Customer name',
          },
        },
        required: ['customerName'],
      },
    },
  },
  
  // ===== JOBS =====
  {
    type: 'function' as const,
    function: {
      name: 'create_job',
      description: 'Create a new work order/job',
      parameters: {
        type: 'object',
        properties: {
          customerName: {
            type: 'string',
            description: 'Customer name',
          },
          type: {
            type: 'string',
            enum: ['service', 'repair', 'installation', 'maintenance', 'quote', 'inspection'],
            description: 'Job type',
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'emergency'],
            description: 'Job priority',
          },
          equipmentName: {
            type: 'string',
            description: 'Equipment name (if job is for specific equipment)',
          },
          description: {
            type: 'string',
            description: 'Job description',
          },
          reportedFault: {
            type: 'string',
            description: 'Reported fault/issue',
          },
        },
        required: ['customerName', 'type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'schedule_job',
      description: 'Schedule a job for a specific date/time',
      parameters: {
        type: 'object',
        properties: {
          jobNumber: {
            type: 'string',
            description: 'Job number',
          },
          scheduledDate: {
            type: 'number',
            description: 'Scheduled date (timestamp)',
          },
          assignedEngineerName: {
            type: 'string',
            description: 'Engineer name',
          },
        },
        required: ['jobNumber', 'scheduledDate'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'start_job',
      description: 'Mark a job as started/in progress',
      parameters: {
        type: 'object',
        properties: {
          jobNumber: {
            type: 'string',
            description: 'Job number',
          },
        },
        required: ['jobNumber'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'complete_job',
      description: 'Mark a job as completed with notes',
      parameters: {
        type: 'object',
        properties: {
          jobNumber: {
            type: 'string',
            description: 'Job number',
          },
          workCarriedOut: {
            type: 'string',
            description: 'Work carried out description',
          },
          findings: {
            type: 'string',
            description: 'Findings/observations',
          },
          recommendations: {
            type: 'string',
            description: 'Recommendations',
          },
        },
        required: ['jobNumber', 'workCarriedOut'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_part_to_job',
      description: 'Add a part usage record to a job',
      parameters: {
        type: 'object',
        properties: {
          jobNumber: {
            type: 'string',
            description: 'Job number',
          },
          partNumber: {
            type: 'string',
            description: 'Part number',
          },
          quantity: {
            type: 'number',
            description: 'Quantity used',
          },
          source: {
            type: 'string',
            enum: ['stock', 'direct_order', 'customer_supplied'],
            description: 'Source of the part',
          },
        },
        required: ['jobNumber', 'partNumber', 'quantity', 'source'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_jobs',
      description: 'List jobs with optional filters',
      parameters: {
        type: 'object',
        properties: {
          customerName: {
            type: 'string',
            description: 'Filter by customer',
          },
          status: {
            type: 'string',
            enum: ['quote', 'scheduled', 'dispatched', 'in_progress', 'on_hold', 'completed', 'invoiced', 'cancelled'],
            description: 'Filter by status',
          },
          assignedEngineerName: {
            type: 'string',
            description: 'Filter by assigned engineer',
          },
        },
        required: [],
      },
    },
  },
  
  // ===== SUPPLIERS & ORDERS =====
  {
    type: 'function' as const,
    function: {
      name: 'create_supplier',
      description: 'Create a new supplier',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Supplier name',
          },
          contactName: {
            type: 'string',
            description: 'Contact person name',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
          phone: {
            type: 'string',
            description: 'Phone number',
          },
          accountNumber: {
            type: 'string',
            description: 'Account number with supplier',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_purchase_order',
      description: 'Create a purchase order to a supplier',
      parameters: {
        type: 'object',
        properties: {
          supplierName: {
            type: 'string',
            description: 'Supplier name',
          },
          items: {
            type: 'array',
            description: 'Array of items to order',
            items: {
              type: 'object',
              properties: {
                partNumber: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                quantity: {
                  type: 'number',
                },
                unitCost: {
                  type: 'number',
                },
              },
            },
          },
          jobNumber: {
            type: 'string',
            description: 'Related job number (if ordering for a specific job)',
          },
        },
        required: ['supplierName', 'items'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'receive_purchase_order',
      description: 'Mark a purchase order as received',
      parameters: {
        type: 'object',
        properties: {
          poNumber: {
            type: 'string',
            description: 'Purchase order number',
          },
        },
        required: ['poNumber'],
      },
    },
  },
];

/**
 * Try to parse a command using a specific model with function calling
 * NOTE: Uses fetch API instead of openai SDK to avoid peer dependency conflicts
 */
async function tryParseCommand(
  command: string,
  context: Record<string, unknown> | undefined,
  modelName: string,
  timeout: number = 30000
): Promise<ParseCommandResponse> {
  const contextStr = context ? `\n\nAdditional context: ${JSON.stringify(context)}` : '';
  
  const systemPrompt = `You are an expert Field Service & Inventory Management assistant. Parse natural language commands into structured function calls.

This is a dual-purpose system:
- CATALOGUE: All products you sell/use (whether stocked or not)
- STOCK: Physical inventory at specific locations

CRITICAL COMMAND PATTERNS - RECOGNIZE THESE FIRST:
1. "Add new item [name] cost [price] markup [%]" → create_catalogue_item
2. "Add [name] to catalogue" → create_catalogue_item
3. "Create product [name] cost [price]" → create_catalogue_item
4. "New part [name] cost [price] markup [%]" → create_catalogue_item
5. "Received [qty] [item] into [location]" → receive_stock
6. "I've got [qty] [item] at [location]" → stock_count
7. "Find [item]" or "Search [item]" → search_catalogue
8. "What [items] in stock" → search_stock
9. "Install [item] on [equipment]" → install_from_stock or install_direct_order
10. "Used [qty] [item] from [location]" → use_stock

Key Concepts:
- "Received 10 LMV37 into warehouse" → receive_stock (increases stock)
- "Add new item cable 0.75mm cost 25 markup 35%" → create_catalogue_item (creates catalogue entry)
- "Add Siemens LMV37.100 burner controller cost 450 markup 40%" → create_catalogue_item
- "Find 0.75 cables" → search_catalogue (searches all products)
- "What cables in stock?" → search_stock (only items with quantity > 0)
- "Install LMV4 on ABC's boiler" → install_from_stock or install_direct_order
- "I've got 5 LMV37 on rack12" → stock_count (verify/update quantity)
- "Used 2 sensors on job 1234" → use_stock + add_part_to_job

CRITICAL: SUPPLIER VS MANUFACTURER DISTINCTION:
- "from [company]" or "supplied by [company]" or "bought from [company]" → preferredSupplierName (this is where you buy/source the item)
- "by [company]" or "made by [company]" or "manufactured by [company]" or "manufacturer: [company]" → manufacturer (this is who makes the item)
- These are DIFFERENT fields - do NOT confuse supplier with manufacturer!
- Example: "Siemens LMV37 from Comtherm cost £423" → partNumber: "Siemens LMV37", preferredSupplierName: "Comtherm" (NOT manufacturer)
- Example: "LMV37 made by Siemens cost £423" → partNumber: "LMV37", manufacturer: "Siemens"
- Example: "Siemens LMV37 by Siemens from Comtherm" → manufacturer: "Siemens", preferredSupplierName: "Comtherm"

Guidelines:
- ALWAYS use create_catalogue_item when user says "Add new item", "Add to catalogue", "Create product", or "New part" with pricing info
- Distinguish between catalogue operations (products) and stock operations (physical inventory)
- For stock operations, location is critical
- For installations, determine if from stock or direct order
- Support customer equipment tracking and job management
- Infer reasonable defaults when information is implied
- Be confident when the command is clear
- Set confidence lower (<0.7) when information is ambiguous or clarification needed
- Do NOT default to QUERY_INVENTORY unless the command is truly ambiguous
- ALWAYS distinguish supplier from manufacturer based on the keywords used`;

  const userPrompt = `Parse this inventory command: "${command}"${contextStr}`;

  // Prepare fetch request
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set');
  }

  const baseURL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
  const url = `${baseURL}/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
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
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok API error (${response.status}): ${errorText}`);
    }

    const completion = await response.json();
    
    const message = completion.choices[0]?.message;

    if (!message) {
      throw new Error('No response from AI model');
    }

    // Check if tool was called
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const functionName = toolCall.function.name;
      
      let functionArgs: Record<string, unknown>;
      try {
        functionArgs = JSON.parse(toolCall.function.arguments || '{}');
      } catch (parseError) {
        console.error('Failed to parse function arguments:', parseError);
        functionArgs = {};
      }

      // Map function names to action types
      const actionMap: Record<string, InventoryAction> = {
        // Catalogue Management
        'create_catalogue_item': 'CREATE_CATALOGUE_ITEM',
        'update_catalogue_item': 'UPDATE_CATALOGUE_ITEM',
        'search_catalogue': 'SEARCH_CATALOGUE',
        // Stock Management
        'receive_stock': 'RECEIVE_STOCK',
        'put_away_stock': 'PUT_AWAY_STOCK',
        'use_stock': 'USE_STOCK',
        'transfer_stock': 'TRANSFER_STOCK',
        'stock_count': 'STOCK_COUNT',
        'search_stock': 'SEARCH_STOCK',
        'low_stock_report': 'LOW_STOCK_REPORT',
        'set_min_stock': 'SET_MIN_STOCK',
        // Customer & Equipment
        'create_customer': 'CREATE_CUSTOMER',
        'add_site_address': 'ADD_SITE_ADDRESS',
        'create_equipment': 'CREATE_EQUIPMENT',
        'update_equipment': 'UPDATE_EQUIPMENT',
        'list_equipment': 'LIST_EQUIPMENT',
        // Parts Installation
        'install_from_stock': 'INSTALL_FROM_STOCK',
        'install_direct_order': 'INSTALL_DIRECT_ORDER',
        'query_equipment_parts': 'QUERY_EQUIPMENT_PARTS',
        'query_customer_parts': 'QUERY_CUSTOMER_PARTS',
        // Jobs
        'create_job': 'CREATE_JOB',
        'schedule_job': 'SCHEDULE_JOB',
        'start_job': 'START_JOB',
        'complete_job': 'COMPLETE_JOB',
        'add_part_to_job': 'ADD_PART_TO_JOB',
        'list_jobs': 'LIST_JOBS',
        // Suppliers & Orders
        'create_supplier': 'CREATE_SUPPLIER',
        'create_purchase_order': 'CREATE_PURCHASE_ORDER',
        'receive_purchase_order': 'RECEIVE_PURCHASE_ORDER',
        // Legacy
        'adjust_stock': 'ADJUST_STOCK',
        'create_product': 'CREATE_PRODUCT',
        'update_product': 'UPDATE_PRODUCT',
        'query_inventory': 'QUERY_INVENTORY',
      };

      const action = actionMap[functionName] || 'QUERY_INVENTORY';

      // Calculate confidence based on completeness of parameters
      const tool = inventoryTools.find(t => t.function.name === functionName);
      const requiredParams = tool?.function.parameters.required || [];
      const providedParams = Object.keys(functionArgs);
      
      // Check that all required parameters are present and have valid values
      const hasAllRequired = requiredParams.every(p => 
        providedParams.includes(p) && 
        functionArgs[p] !== null && 
        functionArgs[p] !== undefined && 
        functionArgs[p] !== ''
      );
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
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          action: parsed.action || 'QUERY_INVENTORY',
          parameters: parsed.parameters || {},
          confidence: parsed.confidence || DEFAULT_CONFIDENCE,
          reasoning: parsed.reasoning || parsed.interpretation || 'Parsed from text response',
          clarificationNeeded: parsed.clarificationNeeded,
        };
      } catch (parseError) {
        // JSON parsing failed, fall through to low confidence query
        console.error('Failed to parse JSON from content:', parseError);
      }
    }

    // If no structured response, return low confidence query
    return {
      action: 'QUERY_INVENTORY',
      parameters: { 
        queryType: 'product_list',
        search: command 
      },
      confidence: 0.3,
      reasoning: 'Could not parse command into structured format',
      clarificationNeeded: 'Could you please rephrase your request?',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
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
    const startTime = Date.now();
    console.log(`[AI Command] Parsing: "${command}"`);

    // NEW TWO-STAGE APPROACH
    // Direct function calls instead of HTTP requests
    
    // Stage 1: Classify Intent
    const classification = await classifyIntentCore(command, context);
    const { action, confidence: classifyConfidence, reasoning: classifyReasoning } = classification;

    console.log(`[AI Command] Stage 1 - Classified as: ${action} (confidence: ${classifyConfidence})`);
    console.log(`[AI Command] Stage 1 - Reasoning: ${classifyReasoning}`);

    // Stage 2: Extract Parameters
    const extraction = await extractParametersCore(command, action, context);
    const { parameters, missingRequired, confidence: extractConfidence } = extraction;

    console.log(`[AI Command] Stage 2 - Extracted params:`, parameters);
    console.log(`[AI Command] Stage 2 - Missing required: ${missingRequired?.join(', ') || 'none'}`);
    console.log(`[AI Command] Stage 2 - Confidence: ${extractConfidence}`);

    // Calculate overall confidence
    const overallConfidence = Math.min(classifyConfidence, extractConfidence);
    const latency = Date.now() - startTime;

    // Build result with debug info
    const result: ParseCommandResponse = {
      action: action as InventoryAction,
      parameters,
      confidence: overallConfidence,
      reasoning: `Two-stage parsing: ${action} with ${Object.keys(parameters).length} parameters`,
      model: 'grok-3-mini',
      latency,
      debug: {
        stage1: {
          action,
          confidence: classifyConfidence,
          reasoning: classifyReasoning,
        },
        stage2: {
          parameters,
          missingRequired: missingRequired || [],
          confidence: extractConfidence,
        },
        usedFallback: false,
        rawCommand: command,
      },
    };

    if (missingRequired && missingRequired.length > 0) {
      result.clarificationNeeded = `Missing required: ${missingRequired.join(', ')}`;
    }

    console.log(`[AI Command] Final result - Action: ${action}, Confidence: ${overallConfidence}, Latency: ${latency}ms`);

    // Validate the response structure
    const validatedResult = validateCommandResponse(result);

    return successResponse(res, validatedResult);
  } catch (error) {
    console.error('Error parsing command:', error);
    
    // Try legacy parsing as final fallback
    try {
      console.log('[AI Command] Two-stage parsing failed, falling back to legacy parsing');
      return await handleLegacyParsing(command, context, res);
    } catch (legacyError) {
      return internalServerErrorResponse(
        res,
        error instanceof Error ? error.message : 'Failed to parse command'
      );
    }
  }
}

/**
 * Legacy parsing method (kept for backward compatibility and as fallback)
 */
async function handleLegacyParsing(
  command: string,
  context: Record<string, unknown> | undefined,
  res: VercelResponse
): Promise<VercelResponse> {
  const startTime = Date.now();
  let result: ParseCommandResponse;
  let latency: number;
  let model: string;

  console.log(`[AI Command] Using legacy parsing for: "${command}"`);

  try {
    result = await tryParseCommand(command, context, 'grok-3-mini', GROK_3_MINI_TIMEOUT);
    latency = Date.now() - startTime;
    model = 'grok-3-mini';
    
    console.log(`[AI Command] grok-3-mini result: action=${result.action}, confidence=${result.confidence}`);
  } catch (primaryError) {
    console.error('grok-3-mini failed:', primaryError);
    
    // Fallback to grok-3 (powerful reasoning, slower)
    console.log('[AI Command] Falling back to grok-3...');
    const fallbackStartTime = Date.now();
    
    try {
      result = await tryParseCommand(command, context, 'grok-3', GROK_3_TIMEOUT);
      latency = Date.now() - fallbackStartTime;
      model = 'grok-3';
      
      console.log(`[AI Command] grok-3 result: action=${result.action}, confidence=${result.confidence}`);
    } catch (fallbackError) {
      console.error('grok-3 also failed:', fallbackError);
      throw new Error('Both primary and fallback models failed to parse command');
    }
  }

  // If confidence is low from grok-3-mini, try grok-3 for better reasoning
  if (model === 'grok-3-mini' && result.confidence < LOW_CONFIDENCE_THRESHOLD) {
    console.log(
      `[AI Command] Low confidence (${result.confidence}) from grok-3-mini, trying grok-3 for better reasoning...`
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
        console.log(`[AI Command] grok-3 provided better confidence: ${result.confidence}`);
      }
    } catch (fallbackError) {
      console.error('Fallback to grok-3 failed:', fallbackError);
      // Continue with grok-3-mini result
    }
  }

  // Add debug info to legacy parsing result
  result.debug = {
    stage1: {
      action: result.action,
      confidence: result.confidence,
      reasoning: result.reasoning,
    },
    stage2: {
      parameters: result.parameters,
      missingRequired: [],
      confidence: result.confidence,
    },
    usedFallback: true,
    fallbackReason: 'Two-stage parsing failed, used legacy function calling approach',
    rawCommand: command,
  };

  // Validate the response structure
  const validatedResult = validateCommandResponse(result);

  return successResponse(res, {
    ...validatedResult,
    model,
    latency,
  });
}
