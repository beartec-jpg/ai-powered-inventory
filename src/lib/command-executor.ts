import type { InventoryItem, Location, Customer, Job, CommandLog } from './types'
import { generateId, findBestMatchItem } from './ai-commands'

interface ExecutionResult {
  success: boolean
  message: string
  data?: unknown
}

export async function executeCommand(
  action: string,
  parameters: Record<string, unknown>,
  inventory: InventoryItem[],
  setInventory: (updater: (current: InventoryItem[]) => InventoryItem[]) => void,
  locations: Location[],
  setLocations: (updater: (current: Location[]) => Location[]) => void,
  customers: Customer[],
  setCustomers: (updater: (current: Customer[]) => Customer[]) => void,
  jobs: Job[],
  setJobs: (updater: (current: Job[]) => Job[]) => void
): Promise<ExecutionResult> {
  
  switch (action) {
    case 'add_item':
      return addItem(parameters, inventory, setInventory)
    
    case 'remove_item':
      return removeItem(parameters, inventory, setInventory)
    
    case 'move_item':
      return moveItem(parameters, inventory, setInventory)
    
    case 'update_quantity':
      return updateQuantity(parameters, inventory, setInventory)
    
    case 'create_location':
      return createLocation(parameters, locations, setLocations)
    
    case 'stock_check':
      return stockCheck(parameters, inventory, locations)
    
    case 'create_job':
      return createJob(parameters, customers, setCustomers, jobs, setJobs)
    
    case 'create_customer':
      return createCustomer(parameters, customers, setCustomers)
    
    case 'query':
      return handleQuery(parameters, inventory, locations, customers, jobs)
    
    case 'list_items':
      return listItems(parameters, inventory)
    
    default:
      return { success: false, message: 'Unknown action' }
  }
}

function addItem(
  params: Record<string, unknown>,
  inventory: InventoryItem[],
  setInventory: (updater: (current: InventoryItem[]) => InventoryItem[]) => void
): ExecutionResult {
  const partNumber = String(params.partNumber || '').trim()
  const name = String(params.name || partNumber).trim()
  const quantity = Number(params.quantity || 0)
  const location = String(params.location || 'default').trim()

  if (!partNumber || quantity <= 0) {
    return { success: false, message: 'Invalid part number or quantity' }
  }

  const existingItem = inventory.find(item => 
    item.partNumber.toLowerCase() === partNumber.toLowerCase() && 
    item.location.toLowerCase() === location.toLowerCase()
  )

  if (existingItem) {
    setInventory((current) => 
      current.map(item => 
        item.id === existingItem.id
          ? { ...item, quantity: item.quantity + quantity, lastUpdated: Date.now() }
          : item
      )
    )
    return { 
      success: true, 
      message: `Added ${quantity} units to ${partNumber} at ${location}. New total: ${existingItem.quantity + quantity}`,
      data: { partNumber, quantity, location }
    }
  } else {
    const newItem: InventoryItem = {
      id: generateId(),
      partNumber,
      name,
      quantity,
      location,
      lastUpdated: Date.now()
    }
    setInventory((current) => [...current, newItem])
    return { 
      success: true, 
      message: `Created new item ${partNumber} with ${quantity} units at ${location}`,
      data: newItem
    }
  }
}

function removeItem(
  params: Record<string, unknown>,
  inventory: InventoryItem[],
  setInventory: (updater: (current: InventoryItem[]) => InventoryItem[]) => void
): ExecutionResult {
  const partNumber = String(params.partNumber || '').trim()
  const quantity = Number(params.quantity || 0)
  const location = params.location ? String(params.location).trim() : null

  if (!partNumber || quantity <= 0) {
    return { success: false, message: 'Invalid part number or quantity' }
  }

  let items = inventory.filter(item => 
    item.partNumber.toLowerCase() === partNumber.toLowerCase()
  )

  if (location) {
    items = items.filter(item => 
      item.location.toLowerCase() === location.toLowerCase()
    )
  }

  if (items.length === 0) {
    const match = findBestMatchItem(partNumber, inventory)
    if (match) {
      return { success: false, message: `Part ${partNumber} not found. Did you mean ${match.partNumber}?` }
    }
    return { success: false, message: `Part ${partNumber} not found` }
  }

  const item = items[0]
  if (item.quantity < quantity) {
    return { 
      success: false, 
      message: `Insufficient quantity. Only ${item.quantity} units available at ${item.location}` 
    }
  }

  const newQuantity = item.quantity - quantity

  if (newQuantity === 0) {
    setInventory((current) => current.filter(i => i.id !== item.id))
    return { 
      success: true, 
      message: `Removed all ${quantity} units of ${partNumber} from ${item.location}. Item deleted.` 
    }
  } else {
    setInventory((current) => 
      current.map(i => 
        i.id === item.id 
          ? { ...i, quantity: newQuantity, lastUpdated: Date.now() }
          : i
      )
    )
    return { 
      success: true, 
      message: `Removed ${quantity} units of ${partNumber} from ${item.location}. ${newQuantity} remaining.` 
    }
  }
}

function moveItem(
  params: Record<string, unknown>,
  inventory: InventoryItem[],
  setInventory: (updater: (current: InventoryItem[]) => InventoryItem[]) => void
): ExecutionResult {
  const partNumber = String(params.partNumber || '').trim()
  const fromLocation = String(params.fromLocation || '').trim()
  const toLocation = String(params.toLocation || '').trim()
  const quantity = params.quantity ? Number(params.quantity) : null

  if (!partNumber || !fromLocation || !toLocation) {
    return { success: false, message: 'Missing required parameters for move operation' }
  }

  const sourceItem = inventory.find(item => 
    item.partNumber.toLowerCase() === partNumber.toLowerCase() &&
    item.location.toLowerCase() === fromLocation.toLowerCase()
  )

  if (!sourceItem) {
    return { success: false, message: `Part ${partNumber} not found at ${fromLocation}` }
  }

  const moveQty = quantity || sourceItem.quantity

  if (moveQty > sourceItem.quantity) {
    return { 
      success: false, 
      message: `Cannot move ${moveQty} units. Only ${sourceItem.quantity} available at ${fromLocation}` 
    }
  }

  const destItem = inventory.find(item => 
    item.partNumber.toLowerCase() === partNumber.toLowerCase() &&
    item.location.toLowerCase() === toLocation.toLowerCase()
  )

  setInventory((current) => {
    let updated = current.map(item => 
      item.id === sourceItem.id
        ? { ...item, quantity: item.quantity - moveQty, lastUpdated: Date.now() }
        : item
    ).filter(item => item.quantity > 0)

    if (destItem) {
      updated = updated.map(item => 
        item.id === destItem.id
          ? { ...item, quantity: item.quantity + moveQty, lastUpdated: Date.now() }
          : item
      )
    } else {
      updated.push({
        id: generateId(),
        partNumber: sourceItem.partNumber,
        name: sourceItem.name,
        quantity: moveQty,
        location: toLocation,
        lastUpdated: Date.now()
      })
    }

    return updated
  })

  return { 
    success: true, 
    message: `Moved ${moveQty} units of ${partNumber} from ${fromLocation} to ${toLocation}` 
  }
}

function updateQuantity(
  params: Record<string, unknown>,
  inventory: InventoryItem[],
  setInventory: (updater: (current: InventoryItem[]) => InventoryItem[]) => void
): ExecutionResult {
  const partNumber = String(params.partNumber || '').trim()
  const quantity = Number(params.quantity || 0)

  if (!partNumber || quantity < 0) {
    return { success: false, message: 'Invalid part number or quantity' }
  }

  const items = inventory.filter(item => 
    item.partNumber.toLowerCase() === partNumber.toLowerCase()
  )

  if (items.length === 0) {
    return { success: false, message: `Part ${partNumber} not found` }
  }

  if (items.length > 1) {
    return { 
      success: false, 
      message: `Part ${partNumber} exists in multiple locations. Please specify location.` 
    }
  }

  const item = items[0]
  setInventory((current) => 
    current.map(i => 
      i.id === item.id 
        ? { ...i, quantity, lastUpdated: Date.now() }
        : i
    )
  )

  return { 
    success: true, 
    message: `Updated ${partNumber} quantity to ${quantity} at ${item.location}` 
  }
}

function createLocation(
  params: Record<string, unknown>,
  locations: Location[],
  setLocations: (updater: (current: Location[]) => Location[]) => void
): ExecutionResult {
  const path = String(params.path || '').trim()
  const description = params.description ? String(params.description) : undefined

  if (!path) {
    return { success: false, message: 'Location path is required' }
  }

  const exists = locations.find(loc => 
    loc.path.toLowerCase() === path.toLowerCase()
  )

  if (exists) {
    return { success: false, message: `Location ${path} already exists` }
  }

  const newLocation: Location = {
    id: generateId(),
    path,
    description,
    createdAt: Date.now()
  }

  setLocations((current) => [...current, newLocation])

  return { 
    success: true, 
    message: `Created location: ${path}${description ? ` - ${description}` : ''}`,
    data: newLocation
  }
}

function stockCheck(
  params: Record<string, unknown>,
  inventory: InventoryItem[],
  locations: Location[]
): ExecutionResult {
  const partNumber = params.partNumber ? String(params.partNumber).trim() : null
  const location = params.location ? String(params.location).trim() : null

  if (partNumber) {
    const items = inventory.filter(item => 
      item.partNumber.toLowerCase().includes(partNumber.toLowerCase()) ||
      item.name.toLowerCase().includes(partNumber.toLowerCase())
    )

    if (items.length === 0) {
      return { success: false, message: `No items found matching "${partNumber}"` }
    }

    const total = items.reduce((sum, item) => sum + item.quantity, 0)
    const details = items.map(item => 
      `${item.quantity} at ${item.location}`
    ).join(', ')

    return { 
      success: true, 
      message: `${partNumber}: ${total} total units (${details})`,
      data: items
    }
  }

  if (location) {
    const items = inventory.filter(item => 
      item.location.toLowerCase().includes(location.toLowerCase())
    )

    if (items.length === 0) {
      return { success: false, message: `No items found at "${location}"` }
    }

    return { 
      success: true, 
      message: `Found ${items.length} items at ${location}`,
      data: items
    }
  }

  return { success: false, message: 'Please specify a part number or location for stock check' }
}

function createJob(
  params: Record<string, unknown>,
  customers: Customer[],
  setCustomers: (updater: (current: Customer[]) => Customer[]) => void,
  jobs: Job[],
  setJobs: (updater: (current: Job[]) => Job[]) => void
): ExecutionResult {
  const jobNumber = String(params.jobNumber || '').trim()
  const customerName = String(params.customerName || '').trim()
  const parts = params.parts as Array<{ partNumber: string; name: string; quantity: number }> || []

  if (!jobNumber || !customerName || parts.length === 0) {
    return { success: false, message: 'Job number, customer name, and parts list are required' }
  }

  let customer = customers.find(c => 
    c.name.toLowerCase() === customerName.toLowerCase()
  )

  if (!customer) {
    customer = {
      id: generateId(),
      name: customerName,
      createdAt: Date.now()
    }
    setCustomers((current) => [...current, customer!])
  }

  const newJob: Job = {
    id: generateId(),
    jobNumber,
    customerId: customer.id,
    customerName: customer.name,
    partsList: parts,
    createdAt: Date.now(),
    status: 'active'
  }

  setJobs((current) => [...current, newJob])

  return { 
    success: true, 
    message: `Created job ${jobNumber} for ${customerName} with ${parts.length} parts`,
    data: newJob
  }
}

function createCustomer(
  params: Record<string, unknown>,
  customers: Customer[],
  setCustomers: (updater: (current: Customer[]) => Customer[]) => void
): ExecutionResult {
  const name = String(params.name || '').trim()
  const email = params.email ? String(params.email).trim() : undefined

  if (!name) {
    return { success: false, message: 'Customer name is required' }
  }

  const exists = customers.find(c => 
    c.name.toLowerCase() === name.toLowerCase()
  )

  if (exists) {
    return { success: false, message: `Customer ${name} already exists` }
  }

  const newCustomer: Customer = {
    id: generateId(),
    name,
    email,
    createdAt: Date.now()
  }

  setCustomers((current) => [...current, newCustomer])

  return { 
    success: true, 
    message: `Created customer: ${name}${email ? ` (${email})` : ''}`,
    data: newCustomer
  }
}

function handleQuery(
  params: Record<string, unknown>,
  inventory: InventoryItem[],
  locations: Location[],
  customers: Customer[],
  jobs: Job[]
): ExecutionResult {
  const query = String(params.query || '').toLowerCase()

  if (query.includes('low') || query.includes('under')) {
    const threshold = 10
    const lowStock = inventory.filter(item => item.quantity < threshold)
    return { 
      success: true, 
      message: `Found ${lowStock.length} items with low stock (under ${threshold} units)`,
      data: lowStock
    }
  }

  if (query.includes('where') || query.includes('location')) {
    const results = inventory.filter(item => 
      query.includes(item.partNumber.toLowerCase()) || 
      query.includes(item.name.toLowerCase())
    )
    
    if (results.length > 0) {
      const locationInfo = results.map(item => 
        `${item.partNumber}: ${item.quantity} at ${item.location}`
      ).join(', ')
      return { 
        success: true, 
        message: locationInfo,
        data: results
      }
    }
  }

  return { 
    success: true, 
    message: `Searching for: ${query}`,
    data: { inventory, locations, customers, jobs }
  }
}

function listItems(
  params: Record<string, unknown>,
  inventory: InventoryItem[]
): ExecutionResult {
  const location = params.location ? String(params.location).toLowerCase() : null
  const lowStock = params.lowStock === true

  let filtered = inventory

  if (location) {
    filtered = filtered.filter(item => 
      item.location.toLowerCase().includes(location)
    )
  }

  if (lowStock) {
    filtered = filtered.filter(item => item.quantity < 10)
  }

  return { 
    success: true, 
    message: `Found ${filtered.length} items`,
    data: filtered
  }
}
