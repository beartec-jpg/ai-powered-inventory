/**
 * Action Registry - Comprehensive definitions for all supported actions
 */

import type { ActionDefinition, ActionType } from './types';

export const ACTION_REGISTRY: ActionDefinition[] = [
  // ===== STOCK MANAGEMENT =====
  {
    name: 'ADD_STOCK',
    category: 'STOCK_MANAGEMENT',
    description: 'Add stock to inventory at a location. Used when receiving, adding, or putting items into stock.',
    keywords: ['add', 'receive', 'received', 'put', 'into', 'got', 'to', 'stock', 'warehouse', 'van', 'rack', 'bin'],
    parameters: [
      { name: 'item', type: 'string', required: true, description: 'Item name or part number', examples: ['M10 nuts', 'LMV37', 'cable 0.75mm'] },
      { name: 'partNumber', type: 'string', required: false, description: 'Part number if different from item', examples: ['M10-NUTS', 'LMV37.100'] },
      { name: 'quantity', type: 'number', required: true, description: 'Quantity to add', examples: ['5', '10', '100'] },
      { name: 'location', type: 'string', required: true, description: 'Location where stock is added', examples: ['warehouse', 'van', 'rack 1 bin6'] },
      { name: 'supplier', type: 'string', required: false, description: 'Supplier name', examples: ['Acme Corp', 'ABC Industries'] },
      { name: 'notes', type: 'string', required: false, description: 'Additional notes' },
    ],
    examples: [
      { input: 'Add 5 M10 nuts to rack 1 bin6', expectedParams: { item: 'M10 nuts', quantity: 5, location: 'rack 1 bin6' } },
      { input: 'Received 20 bearings into warehouse', expectedParams: { item: 'bearings', quantity: 20, location: 'warehouse' } },
      { input: 'Put 10 LMV37 into van', expectedParams: { item: 'LMV37', quantity: 10, location: 'van' } },
    ],
  },
  {
    name: 'REMOVE_STOCK',
    category: 'STOCK_MANAGEMENT',
    description: 'Remove stock from inventory. Used when using, taking, or consuming items.',
    keywords: ['remove', 'use', 'used', 'take', 'took', 'from', 'consume'],
    parameters: [
      { name: 'item', type: 'string', required: true, description: 'Item name or part number' },
      { name: 'partNumber', type: 'string', required: false, description: 'Part number if different' },
      { name: 'quantity', type: 'number', required: true, description: 'Quantity to remove' },
      { name: 'location', type: 'string', required: true, description: 'Location to remove from' },
      { name: 'reason', type: 'string', required: false, description: 'Reason for removal', examples: ['job', 'installation', 'damaged'] },
      { name: 'jobNumber', type: 'string', required: false, description: 'Related job number' },
    ],
    examples: [
      { input: 'Used 2 filters from van', expectedParams: { item: 'filters', quantity: 2, location: 'van' } },
      { input: 'Remove 5 bearings from warehouse', expectedParams: { item: 'bearings', quantity: 5, location: 'warehouse' } },
      { input: 'Take 3 sensors from rack 5', expectedParams: { item: 'sensors', quantity: 3, location: 'rack 5' } },
    ],
  },
  {
    name: 'TRANSFER_STOCK',
    category: 'STOCK_MANAGEMENT',
    description: 'Transfer stock between locations.',
    keywords: ['move', 'transfer', 'from', 'to'],
    parameters: [
      { name: 'item', type: 'string', required: true, description: 'Item name or part number' },
      { name: 'partNumber', type: 'string', required: false, description: 'Part number' },
      { name: 'quantity', type: 'number', required: true, description: 'Quantity to transfer' },
      { name: 'fromLocation', type: 'string', required: true, description: 'Source location' },
      { name: 'toLocation', type: 'string', required: true, description: 'Destination location' },
      { name: 'notes', type: 'string', required: false, description: 'Transfer notes' },
    ],
    examples: [
      { input: 'Move 10 bolts from warehouse to van', expectedParams: { item: 'bolts', quantity: 10, fromLocation: 'warehouse', toLocation: 'van' } },
      { input: 'Transfer 5 filters from rack 1 to van 2', expectedParams: { item: 'filters', quantity: 5, fromLocation: 'rack 1', toLocation: 'van 2' } },
    ],
  },
  {
    name: 'COUNT_STOCK',
    category: 'STOCK_MANAGEMENT',
    description: 'Verify or count actual stock quantity. Used for stock takes and audits.',
    keywords: ['count', 'got', 'have', 'verify', 'check', 'audit'],
    parameters: [
      { name: 'item', type: 'string', required: true, description: 'Item name or part number' },
      { name: 'partNumber', type: 'string', required: false, description: 'Part number' },
      { name: 'quantity', type: 'number', required: true, description: 'Counted quantity' },
      { name: 'countedQuantity', type: 'number', required: false, description: 'Alias for quantity' },
      { name: 'location', type: 'string', required: true, description: 'Location where counting happened' },
      { name: 'notes', type: 'string', required: false, description: 'Count notes' },
    ],
    examples: [
      { input: "I've got 50 bearings on shelf A", expectedParams: { item: 'bearings', quantity: 50, location: 'shelf A' } },
      { input: 'Count 25 filters in warehouse', expectedParams: { item: 'filters', quantity: 25, location: 'warehouse' } },
    ],
  },
  {
    name: 'SEARCH_STOCK',
    category: 'STOCK_MANAGEMENT',
    description: 'Search for items currently in stock with quantity > 0.',
    keywords: ['what', 'search', 'find', 'show', 'list', 'stock', 'have', 'got'],
    parameters: [
      { name: 'search', type: 'string', required: true, description: 'Search term' },
      { name: 'item', type: 'string', required: false, description: 'Alias for search' },
      { name: 'location', type: 'string', required: false, description: 'Filter by location' },
    ],
    examples: [
      { input: 'What bearings do we have?', expectedParams: { search: 'bearings' } },
      { input: 'Search stock for filters', expectedParams: { search: 'filters' } },
      { input: 'Show me bolts in warehouse', expectedParams: { search: 'bolts', location: 'warehouse' } },
    ],
  },
  {
    name: 'LOW_STOCK_REPORT',
    category: 'STOCK_MANAGEMENT',
    description: 'Get items with stock below minimum quantity.',
    keywords: ['low', 'stock', 'report', 'below', 'minimum', 'reorder'],
    parameters: [
      { name: 'location', type: 'string', required: false, description: 'Filter by location' },
    ],
    examples: [
      { input: 'Show low stock items', expectedParams: {} },
      { input: 'Low stock report for warehouse', expectedParams: { location: 'warehouse' } },
    ],
  },

  // ===== CATALOGUE MANAGEMENT =====
  {
    name: 'ADD_PRODUCT',
    category: 'CATALOGUE_MANAGEMENT',
    description: 'Add a new product to the catalogue. Creates a catalogue entry with pricing.',
    keywords: ['add', 'new', 'item', 'product', 'catalogue', 'catalog', 'create', 'cost', 'price', 'markup'],
    parameters: [
      { name: 'partNumber', type: 'string', required: true, description: 'Part number/SKU' },
      { name: 'name', type: 'string', required: true, description: 'Product name' },
      { name: 'description', type: 'string', required: false, description: 'Product description' },
      { name: 'manufacturer', type: 'string', required: false, description: 'Manufacturer name' },
      { name: 'category', type: 'string', required: false, description: 'Product category' },
      { name: 'unitCost', type: 'number', required: false, description: 'Cost price per unit' },
      { name: 'markup', type: 'number', required: false, description: 'Markup percentage' },
      { name: 'sellPrice', type: 'number', required: false, description: 'Selling price' },
      { name: 'minQuantity', type: 'number', required: false, description: 'Minimum stock level' },
      { name: 'preferredSupplierName', type: 'string', required: false, description: 'Preferred supplier' },
    ],
    examples: [
      { 
        input: 'Add new item cable 0.75mm cost 25 markup 35%', 
        expectedParams: { partNumber: 'cable', name: 'cable 0.75mm', unitCost: 25, markup: 35 } 
      },
      { 
        input: 'Create product Siemens LMV37.100 cost 450 markup 40%', 
        expectedParams: { partNumber: 'LMV37.100', name: 'Siemens LMV37.100', unitCost: 450, markup: 40 } 
      },
    ],
  },
  {
    name: 'UPDATE_PRODUCT',
    category: 'CATALOGUE_MANAGEMENT',
    description: 'Update an existing catalogue item.',
    keywords: ['update', 'change', 'modify', 'product', 'item', 'price', 'cost'],
    parameters: [
      { name: 'partNumber', type: 'string', required: true, description: 'Part number to update' },
      { name: 'name', type: 'string', required: false, description: 'Updated name' },
      { name: 'unitCost', type: 'number', required: false, description: 'Updated cost' },
      { name: 'markup', type: 'number', required: false, description: 'Updated markup' },
      { name: 'sellPrice', type: 'number', required: false, description: 'Updated sell price' },
      { name: 'minQuantity', type: 'number', required: false, description: 'Updated minimum quantity' },
    ],
    examples: [
      { input: 'Update LMV37 cost to 500', expectedParams: { partNumber: 'LMV37', unitCost: 500 } },
    ],
  },
  {
    name: 'SEARCH_CATALOGUE',
    category: 'CATALOGUE_MANAGEMENT',
    description: 'Search the product catalogue.',
    keywords: ['search', 'find', 'catalogue', 'catalog', 'product', 'item'],
    parameters: [
      { name: 'search', type: 'string', required: true, description: 'Search term' },
      { name: 'category', type: 'string', required: false, description: 'Filter by category' },
      { name: 'manufacturer', type: 'string', required: false, description: 'Filter by manufacturer' },
    ],
    examples: [
      { input: 'Search catalogue for cables', expectedParams: { search: 'cables' } },
      { input: 'Find Siemens products', expectedParams: { search: 'Siemens' } },
    ],
  },

  // ===== CUSTOMER MANAGEMENT =====
  {
    name: 'ADD_CUSTOMER',
    category: 'CUSTOMER_MANAGEMENT',
    description: 'Create a new customer.',
    keywords: ['new', 'add', 'create', 'customer', 'client'],
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Customer name' },
      { name: 'type', type: 'string', required: false, description: 'Customer type: commercial, residential, or industrial' },
      { name: 'contactName', type: 'string', required: false, description: 'Primary contact name' },
      { name: 'email', type: 'string', required: false, description: 'Email address' },
      { name: 'phone', type: 'string', required: false, description: 'Phone number' },
    ],
    examples: [
      { input: 'New customer ABC Heating', expectedParams: { name: 'ABC Heating' } },
      { input: 'Add customer XYZ Industries', expectedParams: { name: 'XYZ Industries' } },
    ],
  },
  {
    name: 'UPDATE_CUSTOMER',
    category: 'CUSTOMER_MANAGEMENT',
    description: 'Update customer information.',
    keywords: ['update', 'change', 'modify', 'customer'],
    parameters: [
      { name: 'customerName', type: 'string', required: true, description: 'Customer name' },
      { name: 'contactName', type: 'string', required: false, description: 'Updated contact name' },
      { name: 'email', type: 'string', required: false, description: 'Updated email' },
      { name: 'phone', type: 'string', required: false, description: 'Updated phone' },
    ],
    examples: [
      { input: 'Update ABC Heating contact to John Smith', expectedParams: { customerName: 'ABC Heating', contactName: 'John Smith' } },
    ],
  },
  {
    name: 'ADD_SITE',
    category: 'CUSTOMER_MANAGEMENT',
    description: 'Add a site address to a customer.',
    keywords: ['add', 'new', 'site', 'address', 'location', 'for'],
    parameters: [
      { name: 'customerName', type: 'string', required: true, description: 'Customer name' },
      { name: 'siteName', type: 'string', required: true, description: 'Site name' },
      { name: 'address', type: 'string', required: true, description: 'Site address' },
      { name: 'postcode', type: 'string', required: false, description: 'Postcode' },
    ],
    examples: [
      { input: 'Add site Main Office for ABC Heating at 123 High St', expectedParams: { customerName: 'ABC Heating', siteName: 'Main Office', address: '123 High St' } },
    ],
  },
  {
    name: 'SEARCH_CUSTOMERS',
    category: 'CUSTOMER_MANAGEMENT',
    description: 'Search for customers.',
    keywords: ['search', 'find', 'list', 'customer', 'client'],
    parameters: [
      { name: 'search', type: 'string', required: true, description: 'Search term' },
    ],
    examples: [
      { input: 'Find customer ABC', expectedParams: { search: 'ABC' } },
    ],
  },

  // ===== JOB MANAGEMENT =====
  {
    name: 'CREATE_JOB',
    category: 'JOB_MANAGEMENT',
    description: 'Create a new work order or job.',
    keywords: ['new', 'create', 'job', 'work order', 'for', 'repair', 'service', 'installation'],
    parameters: [
      { name: 'customerName', type: 'string', required: true, description: 'Customer name' },
      { name: 'type', type: 'string', required: false, description: 'Job type: service, repair, installation, maintenance' },
      { name: 'description', type: 'string', required: false, description: 'Job description' },
      { name: 'equipmentName', type: 'string', required: false, description: 'Equipment name' },
      { name: 'priority', type: 'string', required: false, description: 'Priority: low, normal, high, emergency' },
    ],
    examples: [
      { input: 'New job for ABC Heating - boiler repair', expectedParams: { customerName: 'ABC Heating', description: 'boiler repair', type: 'repair' } },
      { input: 'Create service job for XYZ Ltd', expectedParams: { customerName: 'XYZ Ltd', type: 'service' } },
    ],
  },
  {
    name: 'UPDATE_JOB',
    category: 'JOB_MANAGEMENT',
    description: 'Update job details.',
    keywords: ['update', 'change', 'job'],
    parameters: [
      { name: 'jobNumber', type: 'string', required: true, description: 'Job number' },
      { name: 'status', type: 'string', required: false, description: 'Job status' },
      { name: 'notes', type: 'string', required: false, description: 'Job notes' },
    ],
    examples: [
      { input: 'Update job 1234 status to completed', expectedParams: { jobNumber: '1234', status: 'completed' } },
    ],
  },
  {
    name: 'COMPLETE_JOB',
    category: 'JOB_MANAGEMENT',
    description: 'Mark a job as completed.',
    keywords: ['complete', 'finish', 'done', 'job'],
    parameters: [
      { name: 'jobNumber', type: 'string', required: true, description: 'Job number' },
      { name: 'workCarriedOut', type: 'string', required: false, description: 'Work description' },
      { name: 'notes', type: 'string', required: false, description: 'Completion notes' },
    ],
    examples: [
      { input: 'Complete job 1234', expectedParams: { jobNumber: '1234' } },
    ],
  },
  {
    name: 'ADD_PARTS_TO_JOB',
    category: 'JOB_MANAGEMENT',
    description: 'Add parts used on a job.',
    keywords: ['add', 'parts', 'to', 'job', 'used'],
    parameters: [
      { name: 'jobNumber', type: 'string', required: true, description: 'Job number' },
      { name: 'partNumber', type: 'string', required: true, description: 'Part number' },
      { name: 'quantity', type: 'number', required: true, description: 'Quantity used' },
    ],
    examples: [
      { input: 'Add 2 filters to job 1234', expectedParams: { jobNumber: '1234', partNumber: 'filters', quantity: 2 } },
    ],
  },
  {
    name: 'SEARCH_JOBS',
    category: 'JOB_MANAGEMENT',
    description: 'Search for jobs.',
    keywords: ['search', 'find', 'list', 'jobs', 'work orders'],
    parameters: [
      { name: 'customerName', type: 'string', required: false, description: 'Filter by customer' },
      { name: 'status', type: 'string', required: false, description: 'Filter by status' },
    ],
    examples: [
      { input: 'Show jobs for ABC Heating', expectedParams: { customerName: 'ABC Heating' } },
      { input: 'List completed jobs', expectedParams: { status: 'completed' } },
    ],
  },

  // ===== SUPPLIER MANAGEMENT =====
  {
    name: 'ADD_SUPPLIER',
    category: 'SUPPLIER_MANAGEMENT',
    description: 'Create a new supplier.',
    keywords: ['new', 'add', 'create', 'supplier', 'vendor'],
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Supplier name' },
      { name: 'contactName', type: 'string', required: false, description: 'Contact person' },
      { name: 'email', type: 'string', required: false, description: 'Email address' },
      { name: 'phone', type: 'string', required: false, description: 'Phone number' },
    ],
    examples: [
      { input: 'New supplier Acme Corp', expectedParams: { name: 'Acme Corp' } },
    ],
  },
  {
    name: 'CREATE_ORDER',
    category: 'SUPPLIER_MANAGEMENT',
    description: 'Create a purchase order.',
    keywords: ['create', 'new', 'order', 'purchase', 'from'],
    parameters: [
      { name: 'supplierName', type: 'string', required: true, description: 'Supplier name' },
      { name: 'items', type: 'array', required: true, description: 'Items to order' },
    ],
    examples: [
      { input: 'Create order from Acme Corp', expectedParams: { supplierName: 'Acme Corp' } },
    ],
  },
  {
    name: 'RECEIVE_ORDER',
    category: 'SUPPLIER_MANAGEMENT',
    description: 'Mark a purchase order as received.',
    keywords: ['receive', 'received', 'order', 'purchase'],
    parameters: [
      { name: 'poNumber', type: 'string', required: true, description: 'Purchase order number' },
    ],
    examples: [
      { input: 'Receive order PO-1234', expectedParams: { poNumber: 'PO-1234' } },
    ],
  },

  // ===== EQUIPMENT MANAGEMENT =====
  {
    name: 'ADD_EQUIPMENT',
    category: 'EQUIPMENT_MANAGEMENT',
    description: 'Add equipment/asset at a customer site.',
    keywords: ['add', 'new', 'equipment', 'asset', 'boiler', 'chiller', 'pump'],
    parameters: [
      { name: 'customerName', type: 'string', required: true, description: 'Customer name' },
      { name: 'equipmentName', type: 'string', required: true, description: 'Equipment identifier' },
      { name: 'type', type: 'string', required: true, description: 'Equipment type' },
      { name: 'manufacturer', type: 'string', required: false, description: 'Manufacturer' },
      { name: 'model', type: 'string', required: false, description: 'Model number' },
      { name: 'serialNumber', type: 'string', required: false, description: 'Serial number' },
    ],
    examples: [
      { input: 'Add boiler Main Boiler for ABC Heating', expectedParams: { customerName: 'ABC Heating', equipmentName: 'Main Boiler', type: 'boiler' } },
    ],
  },
  {
    name: 'UPDATE_EQUIPMENT',
    category: 'EQUIPMENT_MANAGEMENT',
    description: 'Update equipment details.',
    keywords: ['update', 'change', 'equipment'],
    parameters: [
      { name: 'customerName', type: 'string', required: true, description: 'Customer name' },
      { name: 'equipmentName', type: 'string', required: true, description: 'Equipment name' },
      { name: 'notes', type: 'string', required: false, description: 'Technical notes' },
    ],
    examples: [
      { input: 'Update Main Boiler for ABC Heating', expectedParams: { customerName: 'ABC Heating', equipmentName: 'Main Boiler' } },
    ],
  },
  {
    name: 'INSTALL_PART',
    category: 'EQUIPMENT_MANAGEMENT',
    description: 'Install a part on customer equipment.',
    keywords: ['install', 'fit', 'replace', 'on', 'equipment'],
    parameters: [
      { name: 'partNumber', type: 'string', required: true, description: 'Part number' },
      { name: 'quantity', type: 'number', required: true, description: 'Quantity' },
      { name: 'customerName', type: 'string', required: true, description: 'Customer name' },
      { name: 'equipmentName', type: 'string', required: true, description: 'Equipment name' },
      { name: 'location', type: 'string', required: false, description: 'Stock location' },
    ],
    examples: [
      { input: 'Install filter on Main Boiler for ABC Heating', expectedParams: { partNumber: 'filter', customerName: 'ABC Heating', equipmentName: 'Main Boiler' } },
    ],
  },
  {
    name: 'SEARCH_EQUIPMENT',
    category: 'EQUIPMENT_MANAGEMENT',
    description: 'Search for equipment.',
    keywords: ['search', 'find', 'list', 'equipment'],
    parameters: [
      { name: 'customerName', type: 'string', required: false, description: 'Filter by customer' },
      { name: 'type', type: 'string', required: false, description: 'Filter by type' },
    ],
    examples: [
      { input: 'Show equipment for ABC Heating', expectedParams: { customerName: 'ABC Heating' } },
    ],
  },
];

// Helper function to find action by name
export function findAction(name: ActionType): ActionDefinition | undefined {
  return ACTION_REGISTRY.find(action => action.name === name);
}

// Helper function to get all actions in a category
export function getActionsByCategory(category: string): ActionDefinition[] {
  return ACTION_REGISTRY.filter(action => action.category === category);
}

// Map of action name aliases (for backward compatibility)
// Note: ADJUST_STOCK intentionally defaults to ADD_STOCK as the most common case
// If users need to decrease, they should use REMOVE_STOCK explicitly
export const ACTION_ALIASES: Record<string, ActionType> = {
  'RECEIVE_STOCK': 'ADD_STOCK',
  'USE_STOCK': 'REMOVE_STOCK',
  'STOCK_COUNT': 'COUNT_STOCK',
  'CREATE_CATALOGUE_ITEM': 'ADD_PRODUCT',
  'UPDATE_CATALOGUE_ITEM': 'UPDATE_PRODUCT',
  'CREATE_CUSTOMER': 'ADD_CUSTOMER',
  'ADD_SITE_ADDRESS': 'ADD_SITE',
  'CREATE_EQUIPMENT': 'ADD_EQUIPMENT',
  'INSTALL_FROM_STOCK': 'INSTALL_PART',
  'INSTALL_DIRECT_ORDER': 'INSTALL_PART',
  'ADD_PART_TO_JOB': 'ADD_PARTS_TO_JOB',
  'LIST_JOBS': 'SEARCH_JOBS',
  'LIST_EQUIPMENT': 'SEARCH_EQUIPMENT',
  'CREATE_SUPPLIER': 'ADD_SUPPLIER',
  'CREATE_PURCHASE_ORDER': 'CREATE_ORDER',
  'RECEIVE_PURCHASE_ORDER': 'RECEIVE_ORDER',
  'CREATE_PRODUCT': 'ADD_PRODUCT',
  'ADJUST_STOCK': 'ADD_STOCK', // Assumes positive adjustment; use REMOVE_STOCK for negative
};

// Normalize action name (handle aliases)
export function normalizeActionName(action: string): ActionType {
  const upper = action.toUpperCase() as ActionType;
  return ACTION_ALIASES[upper] || upper;
}
