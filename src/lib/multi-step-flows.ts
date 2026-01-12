/**
 * Multi-step conversational flow definitions
 * Handles complex flows that require collecting multiple pieces of information
 */

import type { Supplier } from './types'

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
 * Get flow by ID
 */
export function getFlow(flowId: string): MultiStepFlow | null {
  if (flowId === CREATE_CATALOGUE_ITEM_FLOW.id) {
    return CREATE_CATALOGUE_ITEM_FLOW
  }
  if (flowId === CREATE_CATALOGUE_ITEM_WITH_DETAILS_FLOW.id) {
    return CREATE_CATALOGUE_ITEM_WITH_DETAILS_FLOW
  }
  return null
}
