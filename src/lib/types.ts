// CATALOGUE ITEM - Products you sell/use (stocked or not)
export interface CatalogueItem {
  id: string
  partNumber: string
  name: string
  description?: string
  manufacturer?: string
  manufacturerPartNumber?: string
  
  // Classification
  category?: string
  subcategory?: string
  tags?: string[]
  
  // Flexible attributes (size, colour, length, voltage, etc.)
  attributes?: Record<string, string>
  
  // Pricing
  unitCost?: number
  markup?: number              // Percentage
  sellPrice?: number           // Auto-calculated or fixed
  
  // Supplier
  preferredSupplierId?: string
  preferredSupplierName?: string
  supplierPartNumber?: string
  
  // Stock settings
  isStocked: boolean           // Do you normally keep this in stock?
  minQuantity?: number         // Reorder point
  reorderQuantity?: number
  
  // Media
  imageUrl?: string
  dataSheetUrl?: string
  
  // Status
  active: boolean
  discontinued?: boolean
  replacementPartId?: string
  
  createdAt: number
  updatedAt: number
}

// STOCK LEVEL - Physical inventory at locations
export interface StockLevel {
  id: string
  catalogueItemId: string
  partNumber: string           // Denormalized for quick access
  name: string
  
  location: string             // "Warehouse", "Van 1", "Rack 12 Bin 2"
  quantity: number
  
  serialNumbers?: string[]     // For serial-tracked items
  batchNumber?: string
  expiryDate?: number
  
  lastCountedAt?: number
  lastMovementAt?: number
  updatedAt: number
}

// SUPPLIER
export interface Supplier {
  id: string
  name: string
  accountNumber?: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  paymentTerms?: string
  discountPercentage?: number
  notes?: string
  createdAt: number
}

// CUSTOMER
export interface Customer {
  id: string
  name: string
  type: 'commercial' | 'residential' | 'industrial'
  contactName?: string
  email?: string
  phone?: string
  mobile?: string
  billingAddress?: string
  siteAddresses: SiteAddress[]
  accountNumber?: string
  vatNumber?: string
  paymentTerms?: string
  notes?: string
  tags?: string[]
  createdAt: number
}

export interface SiteAddress {
  id: string
  name: string
  address: string
  postcode?: string
  contactName?: string
  contactPhone?: string
  accessNotes?: string
}

// EQUIPMENT - Customer assets you service
export interface Equipment {
  id: string
  customerId: string
  customerName: string
  siteAddressId?: string
  
  name: string
  type: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  
  location?: string
  accessNotes?: string
  
  installDate?: number
  warrantyExpiry?: number
  
  serviceInterval?: number
  lastServiceDate?: number
  nextServiceDue?: number
  
  contractType?: 'none' | 'breakdown' | 'maintenance' | 'full_cover'
  contractExpiry?: number
  
  technicalNotes?: string
  qrCode?: string
  
  createdAt: number
}

// INSTALLED PART - Parts on customer equipment
export interface InstalledPart {
  id: string
  equipmentId: string
  equipmentName: string
  customerId: string
  customerName: string
  
  partNumber: string
  name: string
  manufacturer?: string
  serialNumber?: string
  quantity: number
  
  source: 'stock' | 'direct_order' | 'customer_supplied'
  supplierId?: string
  supplierName?: string
  supplierOrderRef?: string
  
  unitCost?: number
  sellPrice?: number
  
  installedDate: number
  installedBy?: string
  jobId?: string
  jobNumber?: string
  
  warrantyMonths?: number
  warrantyExpiry?: number
  
  replacedPartId?: string
  replacementReason?: string
  
  notes?: string
}

// JOB - Work orders
export interface Job {
  id: string
  jobNumber: string
  
  customerId: string
  customerName: string
  siteAddressId?: string
  siteAddress?: string
  
  equipmentId?: string
  equipmentName?: string
  
  type: 'service' | 'repair' | 'installation' | 'maintenance' | 'quote' | 'inspection'
  priority: 'low' | 'normal' | 'high' | 'emergency'
  
  description?: string
  reportedFault?: string
  workRequired?: string
  
  assignedTo?: string
  assignedEngineerName?: string
  
  status: 'quote' | 'scheduled' | 'dispatched' | 'in_progress' | 'on_hold' | 'completed' | 'invoiced' | 'cancelled'
  
  scheduledDate?: number
  scheduledTimeSlot?: string
  estimatedDuration?: number
  
  startedAt?: number
  completedAt?: number
  completedBy?: string
  
  workCarriedOut?: string
  findings?: string
  recommendations?: string
  
  partsUsed: UsedPart[]
  
  labourHours?: number
  labourRate?: number
  partsCost?: number
  totalCost?: number
  
  customerSignature?: string
  signedByName?: string
  signedAt?: number
  
  followUpRequired?: boolean
  followUpNotes?: string
  
  notes?: string
  internalNotes?: string
  
  createdAt: number
}

export interface UsedPart {
  id: string
  partNumber: string
  name: string
  serialNumber?: string
  quantity: number
  source: 'stock' | 'direct_order' | 'customer_supplied'
  supplierId?: string
  supplierName?: string
  unitCost?: number
  sellPrice?: number
}

// PURCHASE ORDER
export interface PurchaseOrder {
  id: string
  poNumber: string
  
  supplierId: string
  supplierName: string
  
  jobId?: string
  jobNumber?: string
  customerId?: string
  customerName?: string
  
  items: POItem[]
  
  status: 'draft' | 'sent' | 'confirmed' | 'partial' | 'received' | 'cancelled'
  
  createdDate: number
  sentDate?: number
  expectedDate?: number
  receivedDate?: number
  
  subtotal?: number
  vat?: number
  total?: number
  
  notes?: string
  supplierReference?: string
}

export interface POItem {
  partNumber: string
  name: string
  quantity: number
  quantityReceived?: number
  unitCost: number
  totalCost: number
}

// STOCK TAKE
export interface StockTake {
  id: string
  location?: string
  status: 'in_progress' | 'completed' | 'cancelled'
  startedAt: number
  completedAt?: number
  counts: StockCount[]
  discrepancies: StockDiscrepancy[]
  notes?: string
}

export interface StockCount {
  catalogueItemId: string
  partNumber: string
  name: string
  location: string
  expectedQuantity: number
  countedQuantity: number
  countedAt: number
  countedBy?: string
}

export interface StockDiscrepancy {
  catalogueItemId: string
  partNumber: string
  name: string
  location: string
  expected: number
  counted: number
  difference: number
  resolved: boolean
  resolution?: 'adjusted' | 'investigated' | 'written_off'
  notes?: string
}

// COMMAND LOG
export interface CommandLog {
  id: string
  command: string
  action: string
  timestamp: number
  success: boolean
  result?: string
  data?: unknown
  debug?: DebugInfo
}

// DEBUG INFO
export interface DebugInfo {
  stage1: {
    action: string
    confidence: number
    reasoning?: string
  }
  stage2: {
    parameters: Record<string, unknown>
    missingRequired: string[]
    confidence: number
  }
  usedFallback: boolean
  fallbackReason?: string
  rawCommand: string
}

// Legacy types for backwards compatibility
export interface InventoryItem {
  id: string
  partNumber: string
  name: string
  quantity: number
  location: string
  minQuantity?: number
  lastUpdated: number
}

export interface Location {
  id: string
  path: string
  description?: string
  createdAt: number
}

export interface JobPart {
  partNumber: string
  name: string
  quantity: number
}

export type CommandAction = 
  // Catalogue Management
  | 'create_catalogue_item'
  | 'update_catalogue_item'
  | 'search_catalogue'
  // Stock Management
  | 'receive_stock'
  | 'put_away_stock'
  | 'use_stock'
  | 'transfer_stock'
  | 'stock_count'
  | 'search_stock'
  | 'low_stock_report'
  | 'set_min_stock'
  // Customer & Equipment
  | 'create_customer'
  | 'add_site_address'
  | 'create_equipment'
  | 'update_equipment'
  | 'list_equipment'
  // Parts Installation
  | 'install_from_stock'
  | 'install_direct_order'
  | 'query_equipment_parts'
  | 'query_customer_parts'
  // Jobs
  | 'create_job'
  | 'schedule_job'
  | 'start_job'
  | 'complete_job'
  | 'add_part_to_job'
  | 'list_jobs'
  // Suppliers & Orders
  | 'create_supplier'
  | 'create_purchase_order'
  | 'receive_purchase_order'
  // Legacy actions
  | 'add_item'
  | 'remove_item'
  | 'move_item'
  | 'update_quantity'
  | 'create_location'
  | 'stock_check'
  | 'query'
  | 'list_items'
  | 'unknown'

// CONVERSATIONAL FLOW - For handling multi-turn interactions
export interface PendingCommand {
  id: string
  action: string
  parameters: Record<string, unknown>
  missingFields: string[]
  prompt: string
  createdAt: number
  expiresAt: number
  pendingAction?: string
  context?: Record<string, unknown>
}

export interface ConversationContext {
  pendingCommand: PendingCommand | null
  lastCommand: string | null
  lastResponse: string | null
  updatedAt: number
}
