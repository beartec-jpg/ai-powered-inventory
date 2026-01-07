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

export interface Customer {
  id: string
  name: string
  email?: string
  createdAt: number
}

export interface Job {
  id: string
  jobNumber: string
  customerId: string
  customerName: string
  partsList: JobPart[]
  createdAt: number
  status: 'active' | 'completed' | 'cancelled'
}

export interface JobPart {
  partNumber: string
  name: string
  quantity: number
}

export interface CommandLog {
  id: string
  command: string
  action: string
  timestamp: number
  success: boolean
  result?: string
  data?: unknown
}

export type CommandAction = 
  | 'add_item'
  | 'remove_item'
  | 'move_item'
  | 'update_quantity'
  | 'create_location'
  | 'stock_check'
  | 'create_job'
  | 'create_customer'
  | 'query'
  | 'list_items'
  | 'unknown'
