/**
 * Multi-step conversational flow definitions
 * Handles complex flows that require collecting multiple pieces of information
 */

import type { Supplier } from './types'

/**
 * Normalize parameter names to canonical schema
 * This ensures consistency across different input methods (AI extraction, user input, etc.)
 */
export function normalizeParameters(params: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...params };

  // Normalize part number variations
  if (params.item && !params.partNumber) {
    normalized.partNumber = params.item;
  }
  if (params.part && !params.partNumber) {
    normalized.partNumber = params.part;
  }
  if (params.sku && !params.partNumber) {
    normalized.partNumber = params.sku;
  }

  // Normalize supplier variations
  if (params.supplier && !params.preferredSupplierName) {
    normalized.preferredSupplierName = params.supplier;
  }
  if (params.supplierName && !params.preferredSupplierName) {
    normalized.preferredSupplierName = params.supplierName;
  }

  // Normalize cost variations
  if (params.cost && !params.unitCost) {
    normalized.unitCost = params.cost;
  }
  if (params.price && !params.unitCost) {
    normalized.unitCost = params.price;
  }

  // Normalize location variations
  if (params.loc && !params.location) {
    normalized.location = params.loc;
  }
  if (params.warehouse && !params.location) {
    normalized.location = params.warehouse;
  }

  // Normalize quantity variations
  if (params.qty && !params.quantity) {
    normalized.quantity = params.qty;
  }
  if (params.amount && !params.quantity) {
    normalized.quantity = params.amount;
  }

  // Normalize manufacturer variations
  if (params.mfg && !params.manufacturer) {
    normalized.manufacturer = params.mfg;
  }
  if (params.make && !params.manufacturer) {
    normalized.manufacturer = params.make;
  }

  return normalized;
}

export interface FlowStep {
  field: string
  prompt: (itemName: string) => string
  optional: boolean
  validator?: (value: unknown) => { valid: boolean; error?: string }
  skipText?: string
}

export interface MultiStepFlow {
  id: string
  steps: FlowStep[]
}

/**
 * Sub-flow for collecting supplier details
 */
export const SUPPLIER_DETAILS_SUB_FLOW: FlowStep[] = [
  {
    field: 'address',
    prompt: (supplierName) => `(Supplier Details 1/4) What is the address for "${supplierName}"? (Enter address or type 'skip')`,
    optional: true,
    skipText: 'No address provided'
  },
  {
    field: 'email',
    prompt: (supplierName) => `(Supplier Details 2/4) What is the email for "${supplierName}"? (Enter email or type 'skip')`,
    optional: true,
    skipText: 'No email provided'
  },
  {
    field: 'website',
    prompt: (supplierName) => `(Supplier Details 3/4) What is the website for "${supplierName}"? (Enter website or type 'skip')`,
    optional: true,
    skipText: 'No website provided'
  },
  {
    field: 'phone',
    prompt: (supplierName) => `(Supplier Details 4/4) What is the phone number for "${supplierName}"? (Enter phone or type 'skip')`,
    optional: true,
    skipText: 'No phone provided'
  }
]

/**
 * Check if a supplier name should skip validation
 * Returns true if supplier exists OR if no supplier name provided
 * This allows the flow to continue without prompting for supplier details
 */
export function supplierExists(supplierName: string, suppliers: Supplier[]): boolean {
  // If no supplier name provided, skip validation
  if (!supplierName || !supplierName.trim()) return true
  
  const normalizedName = supplierName.toLowerCase().trim()
  return suppliers.some(s => s.name.toLowerCase().trim() === normalizedName)
}

/**
 * Flow for creating a catalogue item with complete details
 * Used by both CREATE_CATALOGUE_ITEM_AND_ADD_STOCK and CREATE_CATALOGUE_ITEM_WITH_DETAILS
 */
export const CREATE_CATALOGUE_ITEM_FLOW: MultiStepFlow = {
  id: 'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK',
  steps: [
    {
      field: 'unitCost',
      prompt: (itemName) => `(Step 1/6) What is the supplier/cost price for "${itemName}"? (Enter price or type 'skip' to leave blank)`,
      optional: true,
      validator: (value) => {
        const str = String(value).toLowerCase().trim()
        if (str === 'skip' || str === '') return { valid: true }
        const num = parseFloat(str)
        if (isNaN(num) || num < 0) {
          return { valid: false, error: 'Please enter a valid positive number or "skip"' }
        }
        return { valid: true }
      },
      skipText: 'No cost price set'
    },
    {
      field: 'markup',
      prompt: (itemName) => `(Step 2/6) What markup percentage should be applied? (e.g., 35 for 35%, or type 'skip')`,
      optional: true,
      validator: (value) => {
        const str = String(value).toLowerCase().trim()
        if (str === 'skip' || str === '') return { valid: true }
        const num = parseFloat(str)
        if (isNaN(num) || num < 0) {
          return { valid: false, error: 'Please enter a valid positive number or "skip"' }
        }
        return { valid: true }
      },
      skipText: 'No markup set'
    },
    {
      field: 'preferredSupplierName',
      prompt: (itemName) => `(Step 3/6) Who is the preferred supplier? (Enter name or type 'skip')`,
      optional: true,
      skipText: 'No preferred supplier set'
    },
    {
      field: 'manufacturer',
      prompt: (itemName) => `(Step 4/6) Who is the manufacturer? (Enter name or type 'skip')`,
      optional: true,
      skipText: 'No manufacturer set'
    },
    {
      field: 'category',
      prompt: (itemName) => `(Step 5/6) What category does this item belong to? (e.g., 'Electrical', 'Plumbing', or type 'skip')`,
      optional: true,
      skipText: 'No category set'
    },
    {
      field: 'minQuantity',
      prompt: (itemName) => `(Step 6/6) What is the minimum stock level for reorder alerts? (Enter number or type 'skip')`,
      optional: true,
      validator: (value) => {
        const str = String(value).toLowerCase().trim()
        if (str === 'skip' || str === '') return { valid: true }
        const num = parseInt(str)
        if (isNaN(num) || num < 0) {
          return { valid: false, error: 'Please enter a valid positive number or "skip"' }
        }
        return { valid: true }
      },
      skipText: 'No minimum stock level set'
    }
  ]
}

/**
 * Flow for creating a catalogue item with details (without adding stock)
 * Same as CREATE_CATALOGUE_ITEM_AND_ADD_STOCK but without quantity/location steps
 */
export const CREATE_CATALOGUE_ITEM_WITH_DETAILS_FLOW: MultiStepFlow = {
  id: 'CREATE_CATALOGUE_ITEM_WITH_DETAILS',
  steps: CREATE_CATALOGUE_ITEM_FLOW.steps // Reuse the same steps
}

/**
 * Process user input for a flow step
 * Returns parsed value or null if skipped
 */
export function processStepInput(step: FlowStep, userInput: string): {
  value: unknown
  skipped: boolean
  error?: string
} {
  const input = userInput.toLowerCase().trim()
  
  // Check if user is skipping
  if (input === 'skip' || input === '') {
    return { value: null, skipped: true }
  }
  
  // Validate if validator exists
  if (step.validator) {
    const validation = step.validator(userInput)
    if (!validation.valid) {
      return { value: null, skipped: false, error: validation.error }
    }
  }
  
  // Parse based on field type
  if (step.field === 'unitCost' || step.field === 'markup') {
    return { value: parseFloat(userInput), skipped: false }
  }
  
  if (step.field === 'minQuantity') {
    return { value: parseInt(userInput), skipped: false }
  }
  
  // Default: return as string
  return { value: userInput, skipped: false }
}

/**
 * Flow for receiving stock
 */
export const RECEIVE_STOCK_FLOW: MultiStepFlow = {
  id: 'RECEIVE_STOCK',
  steps: [
    {
      field: 'quantity',
      prompt: (itemName) => `(Step 1/3) How many units of "${itemName}" did you receive?`,
      optional: false,
      validator: (value) => {
        const num = parseFloat(String(value))
        if (isNaN(num) || num <= 0) {
          return { valid: false, error: 'Please enter a valid positive number' }
        }
        return { valid: true }
      }
    },
    {
      field: 'location',
      prompt: (itemName) => `(Step 2/3) Where did you receive "${itemName}"? (e.g., Warehouse, Van 1)`,
      optional: false
    },
    {
      field: 'supplierName',
      prompt: (itemName) => `(Step 3/3) Which supplier provided this? (Enter supplier name or type 'skip')`,
      optional: true,
      skipText: 'No supplier specified'
    }
  ]
}

/**
 * Flow for removing stock (USE_STOCK)
 */
export const REMOVE_STOCK_FLOW: MultiStepFlow = {
  id: 'USE_STOCK',
  steps: [
    {
      field: 'quantity',
      prompt: (itemName) => `(Step 1/3) How many units of "${itemName}" are you removing?`,
      optional: false,
      validator: (value) => {
        const num = parseFloat(String(value))
        if (isNaN(num) || num <= 0) {
          return { valid: false, error: 'Please enter a valid positive number' }
        }
        return { valid: true }
      }
    },
    {
      field: 'location',
      prompt: (itemName) => `(Step 2/3) From which location? (e.g., Warehouse, Van 1)`,
      optional: false
    },
    {
      field: 'reason',
      prompt: (itemName) => `(Step 3/3) What is the reason for removing stock? (e.g., job, installation, damaged, or type 'skip')`,
      optional: true,
      skipText: 'No reason specified'
    }
  ]
}

/**
 * Flow for transferring stock
 */
export const TRANSFER_STOCK_FLOW: MultiStepFlow = {
  id: 'TRANSFER_STOCK',
  steps: [
    {
      field: 'quantity',
      prompt: (itemName) => `(Step 1/4) How many units of "${itemName}" are you transferring?`,
      optional: false,
      validator: (value) => {
        const num = parseFloat(String(value))
        if (isNaN(num) || num <= 0) {
          return { valid: false, error: 'Please enter a valid positive number' }
        }
        return { valid: true }
      }
    },
    {
      field: 'fromLocation',
      prompt: (itemName) => `(Step 2/4) From which location?`,
      optional: false
    },
    {
      field: 'toLocation',
      prompt: (itemName) => `(Step 3/4) To which location?`,
      optional: false
    },
    {
      field: 'notes',
      prompt: (itemName) => `(Step 4/4) Any notes about this transfer? (Enter notes or type 'skip')`,
      optional: true,
      skipText: 'No notes provided'
    }
  ]
}

/**
 * Flow for creating a purchase order
 */
export const CREATE_PURCHASE_ORDER_FLOW: MultiStepFlow = {
  id: 'CREATE_PURCHASE_ORDER',
  steps: [
    {
      field: 'supplierName',
      prompt: (itemName) => `(Step 1/2) Which supplier are you ordering from?`,
      optional: false
    },
    {
      field: 'jobNumber',
      prompt: (itemName) => `(Step 2/2) Is this for a specific job? (Enter job number or type 'skip')`,
      optional: true,
      skipText: 'Not linked to a specific job'
    }
  ]
}

/**
 * Flow for creating a supplier
 */
export const CREATE_SUPPLIER_FLOW: MultiStepFlow = {
  id: 'CREATE_SUPPLIER',
  steps: [
    {
      field: 'contactName',
      prompt: (supplierName) => `(Step 1/4) Who is the contact person at "${supplierName}"? (Enter name or type 'skip')`,
      optional: true,
      skipText: 'No contact person specified'
    },
    {
      field: 'email',
      prompt: (supplierName) => `(Step 2/4) What is the email address? (Enter email or type 'skip')`,
      optional: true,
      skipText: 'No email provided'
    },
    {
      field: 'phone',
      prompt: (supplierName) => `(Step 3/4) What is the phone number? (Enter phone or type 'skip')`,
      optional: true,
      skipText: 'No phone provided'
    },
    {
      field: 'accountNumber',
      prompt: (supplierName) => `(Step 4/4) What is your account number with this supplier? (Enter account number or type 'skip')`,
      optional: true,
      skipText: 'No account number provided'
    }
  ]
}

/**
 * Flow for creating a job
 */
export const CREATE_JOB_FLOW: MultiStepFlow = {
  id: 'CREATE_JOB',
  steps: [
    {
      field: 'type',
      prompt: (customerName) => `(Step 1/4) What type of job is this for "${customerName}"? (service, repair, installation, maintenance, quote, inspection)`,
      optional: false,
      validator: (value) => {
        const validTypes = ['service', 'repair', 'installation', 'maintenance', 'quote', 'inspection']
        const type = String(value).toLowerCase().trim()
        if (!validTypes.includes(type)) {
          return { valid: false, error: `Please enter one of: ${validTypes.join(', ')}` }
        }
        return { valid: true }
      }
    },
    {
      field: 'priority',
      prompt: (customerName) => `(Step 2/4) What is the priority? (low, normal, high, emergency)`,
      optional: false,
      validator: (value) => {
        const validPriorities = ['low', 'normal', 'high', 'emergency']
        const priority = String(value).toLowerCase().trim()
        if (!validPriorities.includes(priority)) {
          return { valid: false, error: `Please enter one of: ${validPriorities.join(', ')}` }
        }
        return { valid: true }
      }
    },
    {
      field: 'description',
      prompt: (customerName) => `(Step 3/4) Describe the job: (Enter description or type 'skip')`,
      optional: true,
      skipText: 'No description provided'
    },
    {
      field: 'equipmentName',
      prompt: (customerName) => `(Step 4/4) Is this for specific equipment? (Enter equipment name or type 'skip')`,
      optional: true,
      skipText: 'Not linked to specific equipment'
    }
  ]
}

/**
 * Flow for creating a customer
 */
export const CREATE_CUSTOMER_FLOW: MultiStepFlow = {
  id: 'CREATE_CUSTOMER',
  steps: [
    {
      field: 'type',
      prompt: (customerName) => `(Step 1/4) What type of customer is "${customerName}"? (commercial, residential, industrial)`,
      optional: false,
      validator: (value) => {
        const validTypes = ['commercial', 'residential', 'industrial']
        const type = String(value).toLowerCase().trim()
        if (!validTypes.includes(type)) {
          return { valid: false, error: `Please enter one of: ${validTypes.join(', ')}` }
        }
        return { valid: true }
      }
    },
    {
      field: 'contactName',
      prompt: (customerName) => `(Step 2/4) Who is the primary contact? (Enter contact name or type 'skip')`,
      optional: true,
      skipText: 'No contact name provided'
    },
    {
      field: 'email',
      prompt: (customerName) => `(Step 3/4) What is the email address? (Enter email or type 'skip')`,
      optional: true,
      skipText: 'No email provided'
    },
    {
      field: 'phone',
      prompt: (customerName) => `(Step 4/4) What is the phone number? (Enter phone or type 'skip')`,
      optional: true,
      skipText: 'No phone provided'
    }
  ]
}

/**
 * Flow for creating equipment
 */
export const CREATE_EQUIPMENT_FLOW: MultiStepFlow = {
  id: 'CREATE_EQUIPMENT',
  steps: [
    {
      field: 'type',
      prompt: (equipmentName) => `(Step 1/5) What type of equipment is "${equipmentName}"? (e.g., boiler, chiller, pump)`,
      optional: false
    },
    {
      field: 'manufacturer',
      prompt: (equipmentName) => `(Step 2/5) Who manufactures this equipment? (Enter manufacturer or type 'skip')`,
      optional: true,
      skipText: 'No manufacturer specified'
    },
    {
      field: 'model',
      prompt: (equipmentName) => `(Step 3/5) What is the model number? (Enter model or type 'skip')`,
      optional: true,
      skipText: 'No model specified'
    },
    {
      field: 'serialNumber',
      prompt: (equipmentName) => `(Step 4/5) What is the serial number? (Enter serial number or type 'skip')`,
      optional: true,
      skipText: 'No serial number provided'
    },
    {
      field: 'location',
      prompt: (equipmentName) => `(Step 5/5) Where is this equipment located at the site? (Enter location or type 'skip')`,
      optional: true,
      skipText: 'No location specified'
    }
  ]
}

/**
 * Get flow by ID
 */
export function getFlow(flowId: string): MultiStepFlow | null {
  const flows: Record<string, MultiStepFlow> = {
    'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK': CREATE_CATALOGUE_ITEM_FLOW,
    'CREATE_CATALOGUE_ITEM_WITH_DETAILS': CREATE_CATALOGUE_ITEM_WITH_DETAILS_FLOW,
    'RECEIVE_STOCK': RECEIVE_STOCK_FLOW,
    'USE_STOCK': REMOVE_STOCK_FLOW,
    'TRANSFER_STOCK': TRANSFER_STOCK_FLOW,
    'CREATE_PURCHASE_ORDER': CREATE_PURCHASE_ORDER_FLOW,
    'CREATE_SUPPLIER': CREATE_SUPPLIER_FLOW,
    'CREATE_JOB': CREATE_JOB_FLOW,
    'CREATE_CUSTOMER': CREATE_CUSTOMER_FLOW,
    'CREATE_EQUIPMENT': CREATE_EQUIPMENT_FLOW
  }
  
  return flows[flowId] || null
}

/**
 * List all available flow keys
 */
export function listFlowKeys(): string[] {
  return [
    'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK',
    'CREATE_CATALOGUE_ITEM_WITH_DETAILS',
    'RECEIVE_STOCK',
    'USE_STOCK',
    'TRANSFER_STOCK',
    'CREATE_PURCHASE_ORDER',
    'CREATE_SUPPLIER',
    'CREATE_JOB',
    'CREATE_CUSTOMER',
    'CREATE_EQUIPMENT'
  ]
}
