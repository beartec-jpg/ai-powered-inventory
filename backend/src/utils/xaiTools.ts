// Tool definitions for xAI Grok function calling
import { GrokTool } from '../types/chat';

export const inventoryTools: GrokTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_stock',
      description: 'Check real-time stock levels for a product in a specific warehouse or across all warehouses',
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'The unique identifier of the product',
          },
          warehouse_id: {
            type: 'string',
            description: 'Optional warehouse ID to check stock in a specific warehouse',
          },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_product',
      description: 'Find products by name, SKU, or category. Returns matching products with their details',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query - can be product name, SKU, or partial match',
          },
          category: {
            type: 'string',
            description: 'Optional filter by product category',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transfer_stock',
      description: 'Execute an inter-warehouse stock transfer with validation. Moves inventory from one warehouse to another',
      parameters: {
        type: 'object',
        properties: {
          from_warehouse_id: {
            type: 'string',
            description: 'Source warehouse ID',
          },
          to_warehouse_id: {
            type: 'string',
            description: 'Destination warehouse ID',
          },
          product_id: {
            type: 'string',
            description: 'Product ID to transfer',
          },
          quantity: {
            type: 'number',
            description: 'Quantity to transfer (must be positive)',
          },
          reason: {
            type: 'string',
            description: 'Reason for the transfer (e.g., "restock", "customer order", "rebalancing")',
          },
        },
        required: ['from_warehouse_id', 'to_warehouse_id', 'product_id', 'quantity', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjust_stock',
      description: 'Manual stock adjustment for inventory corrections, damage, loss, or found items',
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'Product ID to adjust',
          },
          warehouse_id: {
            type: 'string',
            description: 'Warehouse where adjustment occurs',
          },
          quantity_change: {
            type: 'number',
            description: 'Quantity change (positive for additions, negative for reductions)',
          },
          reason: {
            type: 'string',
            description: 'Reason for adjustment (e.g., "damage", "found", "correction", "loss")',
          },
        },
        required: ['product_id', 'warehouse_id', 'quantity_change', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_parts_list',
      description: 'Create and save a parts list for a job with customer information',
      parameters: {
        type: 'object',
        properties: {
          job_number: {
            type: 'string',
            description: 'Job or order number',
          },
          items: {
            type: 'array',
            description: 'Array of items with product_id and quantity',
            items: {
              type: 'object',
              properties: {
                product_id: {
                  type: 'string',
                },
                quantity: {
                  type: 'number',
                },
              },
              required: ['product_id', 'quantity'],
            },
          },
          customer_name: {
            type: 'string',
            description: 'Customer name for the job',
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the parts list',
          },
        },
        required: ['job_number', 'items', 'customer_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_low_stock_items',
      description: 'Get all items across warehouses that are below their reorder threshold',
      parameters: {
        type: 'object',
        properties: {
          threshold: {
            type: 'number',
            description: 'Optional custom threshold (defaults to product reorder level)',
          },
          warehouse_id: {
            type: 'string',
            description: 'Optional filter by specific warehouse',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'warehouse_inventory_report',
      description: 'Get comprehensive inventory snapshot for a warehouse including all products, quantities, and values',
      parameters: {
        type: 'object',
        properties: {
          warehouse_id: {
            type: 'string',
            description: 'Warehouse ID for the report',
          },
        },
        required: ['warehouse_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'supplier_availability',
      description: 'Check supplier information and lead times for a product',
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'Product ID to check supplier info',
          },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_details',
      description: 'Get full product information including description, pricing, category, and current stock levels',
      parameters: {
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'Product ID to retrieve details',
          },
        },
        required: ['product_id'],
      },
    },
  },
];

export function getToolByName(name: string): GrokTool | undefined {
  return inventoryTools.find(tool => tool.function.name === name);
}

export function getAllToolNames(): string[] {
  return inventoryTools.map(tool => tool.function.name);
}
