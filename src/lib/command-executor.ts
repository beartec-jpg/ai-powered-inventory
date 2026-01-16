import type { 
  InventoryItem, 
  Location, 
  Customer, 
  Job, 
  CommandLog,
  CatalogueItem,
  StockLevel,
  Supplier,
  Equipment,
  InstalledPart,
  PurchaseOrder,
  StockTake
} from './types'
import { generateId, findBestMatchItem } from './ai-commands'
import { getFlow, processStepInput } from './multi-step-flows'
import { apiPost, apiPut } from './api-client'

interface ExecutionResult {
  success: boolean
  message: string
  data?: unknown
  needsInput?: boolean
  missingFields?: string[]
  prompt?: string
  pendingAction?: string
  context?: Record<string, unknown>
  options?: string[]
}

interface StateSetters {
  inventory: InventoryItem[]
  setInventory: (updater: (current: InventoryItem[]) => InventoryItem[]) => void
  locations: Location[]
  setLocations: (updater: (current: Location[]) => Location[]) => void
  customers: Customer[]
  setCustomers: (updater: (current: Customer[]) => Customer[]) => void
  jobs: Job[]
  setJobs: (updater: (current: Job[]) => Job[]) => void
  catalogue: CatalogueItem[]
  setCatalogue: (updater: (current: CatalogueItem[]) => CatalogueItem[]) => void
  stockLevels: StockLevel[]
  setStockLevels: (updater: (current: StockLevel[]) => StockLevel[]) => void
  suppliers: Supplier[]
  setSuppliers: (updater: (current: Supplier[]) => Supplier[]) => void
  equipment: Equipment[]
  setEquipment: (updater: (current: Equipment[]) => Equipment[]) => void
  installedParts: InstalledPart[]
  setInstalledParts: (updater: (current: InstalledPart[]) => InstalledPart[]) => void
  purchaseOrders: PurchaseOrder[]
  setPurchaseOrders: (updater: (current: PurchaseOrder[]) => PurchaseOrder[]) => void
}

/**
 * Local fallback parser for common command patterns
 * Used when AI returns QUERY_INVENTORY but command matches known patterns
 * 
 * LIMITATIONS:
 * - Part number extraction is inconsistent across patterns:
 *   * Some use regex matching for alphanumeric sequences
 *   * Others use simple word splitting (first word)
 *   * TODO: Create dedicated utility function for consistent extraction
 * - Complex product names like "Siemens LMV37.100 burner controller" may not extract ideal part numbers
 * - The AI or backend should provide better part numbers when possible
 * - This is a safety fallback, not the primary parsing mechanism
 */
function tryLocalParse(command: string, aiParams: Record<string, unknown>): { action: string; parameters: Record<string, unknown> } | null {
  const lower = command.toLowerCase().trim()
  
  // Pattern: "Add new item [name] cost [price] markup [%]"
  // Matches: add/create + item/product + name + cost + optional markup
  // Examples: 
  // - "Add new item Siemens LMV37.100 burner controller cost 450 markup 40%"
  // - "Add new item cable 0.75mm tri-rated 100m roll black cost 25 markup 35%"
  // Note: Markup percentage (%) symbol is optional in the pattern
  const addItemMatch = lower.match(/^(?:add\s+new\s+item|add\s+to\s+catalogue|create\s+product|new\s+part)\s+(.+?)\s+cost\s+(\d+(?:\.\d+)?)(?:\s+markup\s+(\d+(?:\.\d+)?)%?)?/i)
  if (addItemMatch) {
    const name = addItemMatch[1].trim()
    const cost = parseFloat(addItemMatch[2])
    // Markup is always treated as a percentage (e.g., 40 means 40%)
    const markup = addItemMatch[3] ? parseFloat(addItemMatch[3]) : undefined
    
    return {
      action: 'CREATE_CATALOGUE_ITEM',
      parameters: {
        // Use the first meaningful token as part number (usually a model/part code)
        // For "Siemens LMV37.100 burner controller", this would give "Siemens"
        // The AI or backend can provide a better part number in aiParams
        partNumber: name.split(/\s+/)[0] || name, 
        name: name,
        unitCost: cost,
        markup: markup,
        ...aiParams // Include any additional params from AI (which may override partNumber)
      }
    }
  }
  
  // Pattern: "Received [qty] [item] into [location]"
  const receivedMatch = lower.match(/^received\s+(\d+)\s+(.+?)\s+(?:into|at|to)\s+(.+)$/i)
  if (receivedMatch) {
    const quantity = parseInt(receivedMatch[1])
    const item = receivedMatch[2].trim()
    const location = receivedMatch[3].trim()
    
    return {
      action: 'RECEIVE_STOCK',
      parameters: {
        partNumber: item,
        quantity: quantity,
        location: location,
        ...aiParams
      }
    }
  }
  
  // Pattern: "I've got [qty] [item] at/on [location]"
  const stockCountMatch = lower.match(/^(?:i(?:'ve|\s+have)\s+got|there(?:'s|\s+are))\s+(\d+)\s+(.+?)\s+(?:at|on|in)\s+(.+)$/i)
  if (stockCountMatch) {
    const quantity = parseInt(stockCountMatch[1])
    const item = stockCountMatch[2].trim()
    const location = stockCountMatch[3].trim()
    
    return {
      action: 'STOCK_COUNT',
      parameters: {
        partNumber: item,
        location: location,
        countedQuantity: quantity,
        ...aiParams
      }
    }
  }
  
  // Pattern: "Add new item [name/details] to [location]" (without cost)
  // Matches: add item with details and location specification
  // Examples: "Add a new item, details Siemens km3 123455 bought from comtherm, add to rack 1 bin 2"
  const addItemToLocationMatch = lower.match(
    /^(?:add\s+)?(?:a\s+)?(?:new\s+)?item[,\s]+(?:details?\s+)?(.+?)(?:\s+to\s+|,\s*add\s+to\s+)(.+)$/i
  )
  if (addItemToLocationMatch) {
    const itemDetails = addItemToLocationMatch[1].trim()
    const location = addItemToLocationMatch[2].trim()
    
    // Extract supplier if present ("bought from X" or "from X")
    // Note: Matches multi-word supplier names (e.g., "Acme Corp", "ABC Industries")
    // Supports ampersands (&) common in company names (e.g., "Smith & Jones Ltd")
    const supplierMatch = itemDetails.match(/(?:bought\s+from|from)\s+([A-Za-z0-9\s&]+?)(?:\s*,|\s+add\s+to\s+|$)/i)
    const supplier = supplierMatch ? supplierMatch[1].trim() : undefined
    
    // Remove supplier text from item name (uses same pattern as above for consistency)
    const itemName = itemDetails.replace(/(?:bought\s+from|from)\s+[A-Za-z0-9\s&]+?(?:\s*,|\s+add\s+to\s+|$)/i, '').trim()
    
    // Try to extract part number (alphanumeric sequences)
    const partNumberMatch = itemName.match(/\b([A-Z0-9]+-?[A-Z0-9]+|\d{4,})\b/i)
    const partNumber = partNumberMatch ? partNumberMatch[1] : itemName.split(/\s+/)[0]
    
    return {
      action: 'RECEIVE_STOCK',
      parameters: {
        name: itemName,
        partNumber: partNumber,
        location: location,
        supplier: supplier,
        quantity: 1,
        ...aiParams
      }
    }
  }
  
  // Pattern: "Add [item] bought from [supplier]"
  // Matches: add item with supplier mention
  // Examples: "Add widget-123 bought from Acme Corp", "Add bolts from ABC Industries"
  // Note: Supports multi-word supplier names
  // Item names can include: letters, numbers, spaces, hyphens, underscores (e.g., "widget-123", "special_part")
  // Supplier names can include: letters, numbers, spaces, ampersands (e.g., "Acme Corp", "Smith & Co")
  const addWithSupplierMatch = lower.match(
    /^add\s+([A-Za-z0-9\s\-_]+?)\s+(?:bought\s+)?from(?:\s+supplier)?\s+(.+?)(?:\s+to\s+|\s*$)/i
  )
  if (addWithSupplierMatch) {
    const itemDetails = addWithSupplierMatch[1].trim()
    const supplier = addWithSupplierMatch[2].trim()
    
    return {
      action: 'RECEIVE_STOCK', 
      parameters: {
        name: itemDetails,
        partNumber: itemDetails.split(/\s+/)[0],
        supplier: supplier,
        quantity: 1,
        ...aiParams
      }
    }
  }
  
  return null
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
  setJobs: (updater: (current: Job[]) => Job[]) => void,
  // New state for comprehensive system
  catalogue?: CatalogueItem[],
  setCatalogue?: (updater: (current: CatalogueItem[]) => CatalogueItem[]) => void,
  stockLevels?: StockLevel[],
  setStockLevels?: (updater: (current: StockLevel[]) => StockLevel[]) => void,
  suppliers?: Supplier[],
  setSuppliers?: (updater: (current: Supplier[]) => Supplier[]) => void,
  equipment?: Equipment[],
  setEquipment?: (updater: (current: Equipment[]) => Equipment[]) => void,
  installedParts?: InstalledPart[],
  setInstalledParts?: (updater: (current: InstalledPart[]) => InstalledPart[]) => void,
  purchaseOrders?: PurchaseOrder[],
  setPurchaseOrders?: (updater: (current: PurchaseOrder[]) => PurchaseOrder[]) => void,
  originalCommand?: string,
  userId?: string | null // Add userId for API calls
): Promise<ExecutionResult> {
  
  // [TRACING] Log execution entry point
  console.log('[Executor] Received:', { 
    action, 
    parameters,
    originalCommand: originalCommand || 'N/A'
  })
  
  const state: StateSetters = {
    inventory,
    setInventory,
    locations,
    setLocations,
    customers,
    setCustomers,
    jobs,
    setJobs,
    catalogue: catalogue || [],
    setCatalogue: setCatalogue || (() => {}),
    stockLevels: stockLevels || [],
    setStockLevels: setStockLevels || (() => {}),
    suppliers: suppliers || [],
    setSuppliers: setSuppliers || (() => {}),
    equipment: equipment || [],
    setEquipment: setEquipment || (() => {}),
    installedParts: installedParts || [],
    setInstalledParts: setInstalledParts || (() => {}),
    purchaseOrders: purchaseOrders || [],
    setPurchaseOrders: setPurchaseOrders || (() => {}),
  }
  
  const actionLower = action.toLowerCase()
  
  // [TRACING] Log action routing with state info
  console.log('[Executor] Action routing:', { 
    original: action,
    lowercase: actionLower,
    catalogueItems: state.catalogue?.length || 0,
    stockLevels: state.stockLevels?.length || 0
  })
  
  // Handle special conversational actions
  if (actionLower === 'create_catalogue_item_and_add_stock') {
    // Check if this is a multi-step flow in progress
    const currentStep = parameters.currentStep as number | undefined
    const totalSteps = parameters.totalSteps as number | undefined
    const collectedData = parameters.collectedData as Record<string, unknown> | undefined
    
    // If we have step info, this is mid-flow
    if (currentStep !== undefined && totalSteps !== undefined && collectedData) {
      // This should not happen here - flow progression is handled by Dashboard
      // If we reach here with all data collected, create the item
      const flow = getFlow('CREATE_CATALOGUE_ITEM_AND_ADD_STOCK')
      if (!flow) {
        return { success: false, message: 'Flow configuration not found' }
      }
      
      // All steps completed, create the complete catalogue item
      // FIX 4: Check both collectedData and parameters for values (parameters now includes context)
      const item = String(
        collectedData.item || parameters.item || 
        collectedData.name || parameters.name || 
        parameters.suggestedName || ''
      ).trim()
      const partNumber = String(
        collectedData.partNumber || parameters.partNumber || item
      ).trim()
      const quantity = Number(collectedData.quantity || parameters.quantity || 0)
      const location = String(collectedData.location || parameters.location || '').trim()
      
      if (!item || !partNumber) {
        return { success: false, message: 'Item name and part number are required' }
      }
      
      // Calculate sell price if both unitCost and markup are provided
      const unitCost = collectedData.unitCost !== undefined ? Number(collectedData.unitCost) : 
                       parameters.unitCost !== undefined ? Number(parameters.unitCost) : undefined
      const markup = collectedData.markup !== undefined ? Number(collectedData.markup) : 
                     parameters.markup !== undefined ? Number(parameters.markup) : undefined
      const sellPrice = unitCost && markup ? unitCost * (1 + markup / 100) : undefined
      
      // Create complete catalogue entry with all collected data
      const catalogueData: Partial<CatalogueItem> = {
        partNumber,
        name: item,
        unitCost,
        markup,
        sellPrice,
        manufacturer: collectedData.manufacturer ? String(collectedData.manufacturer) : 
                      parameters.manufacturer ? String(parameters.manufacturer) : undefined,
        preferredSupplierName: collectedData.preferredSupplierName ? String(collectedData.preferredSupplierName) : 
                                parameters.preferredSupplierName ? String(parameters.preferredSupplierName) : undefined,
        category: collectedData.category ? String(collectedData.category) : 
                  parameters.category ? String(parameters.category) : undefined,
        minQuantity: collectedData.minQuantity !== undefined ? Number(collectedData.minQuantity) : 
                     parameters.minQuantity !== undefined ? Number(parameters.minQuantity) : undefined,
        isStocked: true,
        active: true,
      }
      
      // Call API to create catalogue item
      if (userId) {
        try {
          const createdItem = await apiPost<CatalogueItem>('/api/inventory/catalogue', userId, catalogueData)
          
          // Optimistically update local state
          state.setCatalogue((current) => [...current, createdItem])
          
          // Now add stock if quantity and location are provided
          if (quantity > 0 && location) {
            const stockData = {
              catalogueItemId: createdItem.id,
              partNumber: createdItem.partNumber,
              name: createdItem.name,
              location,
              quantity,
              action: 'set' as const,
            }
            
            const createdStock = await apiPost<StockLevel>('/api/stock/levels', userId, stockData)
            state.setStockLevels((current) => [...current, createdStock])
            
            // Build success message with summary
            const details: string[] = []
            if (unitCost && markup && sellPrice) {
              details.push(`Cost: £${unitCost.toFixed(2)}, Markup: ${markup}%, Sell Price: £${sellPrice.toFixed(2)}`)
            }
            if (collectedData.manufacturer) {
              details.push(`Manufacturer: ${collectedData.manufacturer}`)
            }
            if (collectedData.preferredSupplierName) {
              details.push(`Supplier: ${collectedData.preferredSupplierName}`)
            }
            if (collectedData.category) {
              details.push(`Category: ${collectedData.category}`)
            }
            if (collectedData.minQuantity) {
              details.push(`Min Stock: ${collectedData.minQuantity}`)
            }
            
            const summary = details.length > 0 ? `\n  - ${details.join('\n  - ')}` : ''
            
            return {
              success: true,
              message: `✓ Created catalogue item "${partNumber}":${summary}\n✓ Added ${quantity} units to ${location}`
            }
          }
          
          return {
            success: true,
            message: `Created catalogue item "${partNumber}"`
          }
        } catch (error) {
          console.error('[CREATE_CATALOGUE_ITEM_AND_ADD_STOCK] API error:', error)
          return { 
            success: false, 
            message: error instanceof Error ? error.message : 'Failed to create catalogue item and stock' 
          }
        }
      }
      
      // Fallback to local state only (shouldn't happen)
      const newItem: CatalogueItem = {
        ...catalogueData as CatalogueItem,
        id: catalogueData.id || generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      state.setCatalogue((current) => [...current, newItem])
      
      if (quantity > 0 && location) {
        const newStock: StockLevel = {
          id: generateId(),
          catalogueItemId: newItem.id,
          partNumber: newItem.partNumber,
          name: newItem.name,
          location,
          quantity,
          lastMovementAt: Date.now(),
          updatedAt: Date.now(),
        }
        state.setStockLevels((current) => [...current, newStock])
        
        return {
          success: true,
          message: `Created catalogue item "${partNumber}" and added ${quantity} units to ${location} (local only - not persisted)`
        }
      }
      
      return {
        success: true,
        message: `Created catalogue item "${partNumber}" (local only - not persisted)`
      }
    }
    
    // Initial creation (old simple flow or fallback) - delegate to createCatalogueItem
    return await createCatalogueItem(parameters, state, userId)
  }
  
  // If AI returned QUERY_INVENTORY, try local fallback parser
  if (actionLower === 'query_inventory' && originalCommand) {
    console.log(`[Command Executor] Attempting local fallback parsing for: "${originalCommand}"`)
    const fallbackResult = tryLocalParse(originalCommand, parameters)
    if (fallbackResult) {
      console.log(`[Command Executor] Local parser matched: ${fallbackResult.action}`)
      // Recursively call without originalCommand to prevent infinite loop
      return await executeCommand(
        fallbackResult.action,
        fallbackResult.parameters,
        inventory,
        setInventory,
        locations,
        setLocations,
        customers,
        setCustomers,
        jobs,
        setJobs,
        catalogue,
        setCatalogue,
        stockLevels,
        setStockLevels,
        suppliers,
        setSuppliers,
        equipment,
        setEquipment,
        installedParts,
        setInstalledParts,
        purchaseOrders,
        setPurchaseOrders
        // No originalCommand passed to prevent fallback logic from triggering again
      )
    }
  }
  
  // Catalogue Management
  if (actionLower === 'create_catalogue_item') return await createCatalogueItem(parameters, state, userId)
  if (actionLower === 'add_product') return await createCatalogueItem(parameters, state, userId)
  if (actionLower === 'create_product') return await createCatalogueItem(parameters, state, userId)
  if (actionLower === 'update_catalogue_item') return updateCatalogueItem(parameters, state)
  if (actionLower === 'update_product') return updateCatalogueItem(parameters, state)
  if (actionLower === 'search_catalogue') return searchCatalogue(parameters, state)
  
  // Stock Management - Support both old and new action names
  if (actionLower === 'receive_stock') {
    console.log('[Executor] Matched RECEIVE_STOCK action, calling receiveStock')
    return await receiveStock(parameters, state, userId)
  }
  if (actionLower === 'add_stock') {
    console.log('[Executor] Matched ADD_STOCK action, calling receiveStock')
    return await receiveStock(parameters, state, userId)
  }
  if (actionLower === 'put_away_stock') return putAwayStock(parameters, state)
  if (actionLower === 'use_stock') return useStock(parameters, state)
  if (actionLower === 'remove_stock') return useStock(parameters, state)
  if (actionLower === 'transfer_stock') return transferStock(parameters, state)
  if (actionLower === 'stock_count') return stockCount(parameters, state)
  if (actionLower === 'count_stock') return stockCount(parameters, state)
  if (actionLower === 'search_stock') return searchStock(parameters, state)
  if (actionLower === 'low_stock_report') return lowStockReport(parameters, state)
  if (actionLower === 'set_min_stock') return setMinStock(parameters, state)
  
  // Customer & Equipment
  if (actionLower === 'create_customer') return createCustomer(parameters, state)
  if (actionLower === 'add_customer') return createCustomer(parameters, state)
  if (actionLower === 'add_site_address') return addSiteAddress(parameters, state)
  if (actionLower === 'add_site') return addSiteAddress(parameters, state)
  if (actionLower === 'create_equipment') return createEquipment(parameters, state)
  if (actionLower === 'add_equipment') return createEquipment(parameters, state)
  if (actionLower === 'update_equipment') return updateEquipment(parameters, state)
  if (actionLower === 'list_equipment') return listEquipment(parameters, state)
  if (actionLower === 'search_equipment') return listEquipment(parameters, state)
  
  // Parts Installation
  if (actionLower === 'install_from_stock') return installFromStock(parameters, state)
  if (actionLower === 'install_part') return installFromStock(parameters, state)
  if (actionLower === 'install_direct_order') return installDirectOrder(parameters, state)
  if (actionLower === 'query_equipment_parts') return queryEquipmentParts(parameters, state)
  if (actionLower === 'query_customer_parts') return queryCustomerParts(parameters, state)
  
  // Jobs
  if (actionLower === 'create_job') return createJob(parameters, state)
  if (actionLower === 'schedule_job') return scheduleJob(parameters, state)
  if (actionLower === 'start_job') return startJob(parameters, state)
  if (actionLower === 'complete_job') return completeJob(parameters, state)
  if (actionLower === 'update_job') return updateJob(parameters, state)
  if (actionLower === 'add_part_to_job') return addPartToJob(parameters, state)
  if (actionLower === 'add_parts_to_job') return addPartToJob(parameters, state)
  if (actionLower === 'list_jobs') return listJobs(parameters, state)
  if (actionLower === 'search_jobs') return listJobs(parameters, state)
  
  // Suppliers & Orders
  if (actionLower === 'create_supplier') return createSupplier(parameters, state)
  if (actionLower === 'add_supplier') return createSupplier(parameters, state)
  if (actionLower === 'create_purchase_order') return createPurchaseOrder(parameters, state)
  if (actionLower === 'create_order') return createPurchaseOrder(parameters, state)
  if (actionLower === 'receive_purchase_order') return receivePurchaseOrder(parameters, state)
  if (actionLower === 'receive_order') return receivePurchaseOrder(parameters, state)
  
  // Legacy actions
  if (actionLower === 'add_item') return addItem(parameters, inventory, setInventory)
  if (actionLower === 'remove_item') return removeItem(parameters, inventory, setInventory)
  if (actionLower === 'move_item') return moveItem(parameters, inventory, setInventory)
  if (actionLower === 'update_quantity') return updateQuantity(parameters, inventory, setInventory)
  if (actionLower === 'create_location') return createLocation(parameters, locations, setLocations)
  if (actionLower === 'stock_check') return stockCheckLegacy(parameters, inventory, locations)
  if (actionLower === 'query') return handleQuery(parameters, inventory, locations, customers, jobs)
  if (actionLower === 'query_inventory') {
    console.log('[Executor] Matched QUERY_INVENTORY action')
    return handleQuery(parameters, inventory, locations, customers, jobs)
  }
  if (actionLower === 'list_items') return listItems(parameters, inventory)
  
  console.log('[Executor] No action match found for:', actionLower)
  return { success: false, message: `Unknown action: ${action}` }
}

// ===== CATALOGUE MANAGEMENT =====

async function createCatalogueItem(params: Record<string, unknown>, state: StateSetters, userId?: string | null): Promise<ExecutionResult> {
  const partNumber = String(params.partNumber || '').trim()
  const name = String(params.name || '').trim()
  
  if (!partNumber || !name) {
    return { success: false, message: 'Part number and name are required' }
  }
  
  const exists = state.catalogue.find(item => 
    item.partNumber.toLowerCase() === partNumber.toLowerCase()
  )
  
  if (exists) {
    return { success: false, message: `Catalogue item ${partNumber} already exists` }
  }
  
  // Check if any optional fields are missing (to offer multi-step flow)
  const hasUnitCost = params.unitCost !== undefined && params.unitCost !== null
  const hasMarkup = params.markup !== undefined && params.markup !== null
  const hasSupplier = params.preferredSupplierName !== undefined && params.preferredSupplierName !== null && String(params.preferredSupplierName).trim() !== ''
  const hasManufacturer = params.manufacturer !== undefined && params.manufacturer !== null && String(params.manufacturer).trim() !== ''
  const hasCategory = params.category !== undefined && params.category !== null && String(params.category).trim() !== ''
  const hasMinQuantity = params.minQuantity !== undefined && params.minQuantity !== null
  
  // If all optional fields are provided, just create the item without prompting
  const allOptionalProvided = hasUnitCost && hasMarkup && hasSupplier && hasManufacturer && hasCategory && hasMinQuantity
  
  // FIX 2: Check if user already went through the multi-step flow
  // If flowCompleted is true, skip the secondary prompt and create the item with whatever data we have
  const flowCompleted = params.flowCompleted === true
  
  // If some optional fields are missing, offer to collect them via multi-step flow
  // BUT only if the flow hasn't already been completed
  if (!allOptionalProvided && !flowCompleted) {
    const missingFields: string[] = []
    if (!hasUnitCost) missingFields.push('unitCost')
    if (!hasMarkup) missingFields.push('markup')
    if (!hasSupplier) missingFields.push('preferredSupplierName')
    if (!hasManufacturer) missingFields.push('manufacturer')
    if (!hasCategory) missingFields.push('category')
    if (!hasMinQuantity) missingFields.push('minQuantity')
    
    return {
      success: false,
      message: `Catalogue item "${partNumber}" ready to create. Would you like to add more details (${missingFields.join(', ')})?`,
      needsInput: true,
      missingFields: ['confirm_add_details'],
      prompt: `Would you like to add more details for "${partNumber}" (cost, markup, supplier, manufacturer, category, min stock)?`,
      pendingAction: 'CREATE_CATALOGUE_ITEM_WITH_DETAILS',
      options: ['Yes', 'No - Create Now'],
      context: {
        partNumber,
        name,
        ...params // Include any fields that were already provided
      }
    }
  }
  
  const unitCost = params.unitCost ? Number(params.unitCost) : undefined
  const markup = params.markup ? Number(params.markup) : undefined
  const sellPrice = params.sellPrice ? Number(params.sellPrice) : 
    (unitCost && markup ? unitCost * (1 + markup / 100) : undefined)
  
  const newItem: Partial<CatalogueItem> = {
    partNumber,
    name,
    description: params.description ? String(params.description) : undefined,
    manufacturer: params.manufacturer ? String(params.manufacturer) : undefined,
    category: params.category ? String(params.category) : undefined,
    subcategory: params.subcategory ? String(params.subcategory) : undefined,
    unitCost,
    markup,
    sellPrice,
    isStocked: params.isStocked === true,
    minQuantity: params.minQuantity ? Number(params.minQuantity) : undefined,
    preferredSupplierName: params.preferredSupplierName ? String(params.preferredSupplierName) : undefined,
    attributes: params.attributes as Record<string, string> | undefined,
    active: true,
  }
  
  // Call API to create item in database
  if (userId) {
    try {
      const createdItem = await apiPost<CatalogueItem>('/api/inventory/catalogue', userId, newItem)
      
      // Optimistically update local state
      state.setCatalogue((current) => [...current, createdItem])
      
      return {
        success: true,
        message: `Created catalogue item: ${partNumber} - ${name}${sellPrice ? ` (£${sellPrice.toFixed(2)})` : ''}`,
        data: createdItem
      }
    } catch (error) {
      console.error('[createCatalogueItem] API error:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to create catalogue item' 
      }
    }
  }
  
  // Fallback to local state only (shouldn't happen in normal flow)
  const localItem: CatalogueItem = {
    ...newItem as CatalogueItem,
    id: newItem.id || generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  
  state.setCatalogue((current) => [...current, localItem])
  
  return {
    success: true,
    message: `Created catalogue item: ${partNumber} - ${name}${sellPrice ? ` (£${sellPrice.toFixed(2)})` : ''} (local only - not persisted)`,
    data: localItem
  }
}

function updateCatalogueItem(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const partNumber = String(params.partNumber || '').trim()
  
  if (!partNumber) {
    return { success: false, message: 'Part number is required' }
  }
  
  const item = state.catalogue.find(i => 
    i.partNumber.toLowerCase() === partNumber.toLowerCase()
  )
  
  if (!item) {
    return { success: false, message: `Catalogue item ${partNumber} not found` }
  }
  
  state.setCatalogue((current) =>
    current.map(i =>
      i.id === item.id
        ? {
            ...i,
            name: params.name ? String(params.name) : i.name,
            unitCost: params.unitCost !== undefined ? Number(params.unitCost) : i.unitCost,
            markup: params.markup !== undefined ? Number(params.markup) : i.markup,
            sellPrice: params.sellPrice !== undefined ? Number(params.sellPrice) : 
              (params.unitCost && params.markup ? Number(params.unitCost) * (1 + Number(params.markup) / 100) : i.sellPrice),
            minQuantity: params.minQuantity !== undefined ? Number(params.minQuantity) : i.minQuantity,
            isStocked: params.isStocked !== undefined ? Boolean(params.isStocked) : i.isStocked,
            active: params.active !== undefined ? Boolean(params.active) : i.active,
            updatedAt: Date.now(),
          }
        : i
    )
  )
  
  return {
    success: true,
    message: `Updated catalogue item: ${partNumber}`
  }
}

function searchCatalogue(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const search = String(params.search || '').toLowerCase().trim()
  
  if (!search) {
    return { success: false, message: 'Search term is required' }
  }
  
  const results = state.catalogue.filter(item => {
    const matchesSearch = 
      item.partNumber.toLowerCase().includes(search) ||
      item.name.toLowerCase().includes(search) ||
      (item.description && item.description.toLowerCase().includes(search)) ||
      (item.manufacturer && item.manufacturer.toLowerCase().includes(search))
    
    const matchesCategory = !params.category || 
      (item.category && item.category.toLowerCase() === String(params.category).toLowerCase())
    
    const matchesManufacturer = !params.manufacturer || 
      (item.manufacturer && item.manufacturer.toLowerCase() === String(params.manufacturer).toLowerCase())
    
    return matchesSearch && matchesCategory && matchesManufacturer
  })
  
  // Get stock levels for results
  const resultsWithStock = results.map(item => {
    const stock = state.stockLevels.filter(s => s.catalogueItemId === item.id)
    const totalQty = stock.reduce((sum, s) => sum + s.quantity, 0)
    return { ...item, stockQuantity: totalQty, stockLocations: stock }
  })
  
  return {
    success: true,
    message: `Found ${results.length} catalogue item(s)`,
    data: resultsWithStock
  }
}

// ===== STOCK MANAGEMENT =====

async function receiveStock(params: Record<string, unknown>, state: StateSetters, userId?: string | null): Promise<ExecutionResult> {
  // Handle both 'item' and 'partNumber' parameter names
  const item = String(params.item || params.partNumber || '').trim()
  const quantity = Number(params.quantity || 0)
  const location = String(params.location || '').trim()
  
  // [TRACING] Log receiveStock entry with all relevant info
  console.log('[receiveStock] Entry:', {
    params: { item, quantity, location },
    catalogueState: { itemCount: state.catalogue.length, stockLevelCount: state.stockLevels.length }
  })

  
  // Check for missing required parameters
  const missingFields: string[] = []
  if (!item) missingFields.push('item')
  if (!quantity || quantity <= 0) missingFields.push('quantity')
  if (!location) missingFields.push('location')
  
  if (missingFields.length > 0) {
    const fieldNames = missingFields.join(', ')
    return {
      success: false,
      message: `Missing required information: ${fieldNames}`,
      needsInput: true,
      missingFields,
      prompt: `Please provide the ${fieldNames} to complete adding stock.`,
      context: { 
        item, 
        quantity, 
        location,
        // Include ALL original parameters to preserve extracted data
        ...params
      }
    }
  }
  
  // Search for item in catalogue by part number or name
  // - Exact match (case-insensitive) on part number for precision
  // - Partial match on name for flexibility (e.g., "M10" matches "M10 nuts")
  let catalogueItem = state.catalogue.find(i => 
    i.partNumber.toLowerCase() === item.toLowerCase() ||
    i.name.toLowerCase().includes(item.toLowerCase())
  )
  
  console.log('[receiveStock] Catalogue lookup result:', catalogueItem ? `Found: ${catalogueItem.partNumber}` : 'NOT FOUND')
  
  // If not in catalogue, prompt to create it
  if (!catalogueItem) {
    return {
      success: false,
      message: `Item "${item}" not found in catalogue. Would you like to add it?`,
      needsInput: true,
      missingFields: ['confirm_add_to_catalogue'],
      prompt: `The item "${item}" doesn't exist in the catalogue. Would you like to add it?`,
      pendingAction: 'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK',
      options: ['Yes', 'No'],
      context: { 
        item,
        partNumber: item,  // Use item name as default part number
        suggestedName: item,  // Keep for backwards compatibility with existing fallback chains
        quantity,
        location,
        supplier: params.supplier || params.supplierName,
        // Include ALL original parameters to preserve extracted data
        ...params
      }
    }
  }
  
  // Use the catalogue item's part number for consistency
  const partNumber = catalogueItem.partNumber
  
  // Call API to create or update stock level
  if (userId) {
    try {
      const stockData = {
        catalogueItemId: catalogueItem.id,
        partNumber: catalogueItem.partNumber,
        name: catalogueItem.name,
        location,
        quantity,
        action: 'add' as const, // Add to existing quantity
      }
      
      const result = await apiPost<StockLevel>('/api/stock/levels', userId, stockData)
      
      // Optimistically update local state
      const existingStock = state.stockLevels.find(s => 
        s.catalogueItemId === catalogueItem!.id && 
        s.location.toLowerCase() === location.toLowerCase()
      )
      
      if (existingStock) {
        state.setStockLevels((current) =>
          current.map(s =>
            s.id === existingStock.id
              ? { ...s, quantity: result.quantity, lastMovementAt: result.lastMovementAt, updatedAt: result.updatedAt }
              : s
          )
        )
      } else {
        state.setStockLevels((current) => [...current, result])
      }
      
      const supplierInfo = params.supplier || params.supplierName ? ` from ${params.supplier || params.supplierName}` : ''
      return {
        success: true,
        message: `Received ${quantity} units of ${partNumber}${supplierInfo} into ${location}`
      }
    } catch (error) {
      console.error('[receiveStock] API error:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to add stock' 
      }
    }
  }
  
  // Fallback to local state only (shouldn't happen in normal flow)
  const existingStock = state.stockLevels.find(s => 
    s.catalogueItemId === catalogueItem!.id && 
    s.location.toLowerCase() === location.toLowerCase()
  )
  
  if (existingStock) {
    state.setStockLevels((current) =>
      current.map(s =>
        s.id === existingStock.id
          ? { ...s, quantity: s.quantity + quantity, lastMovementAt: Date.now(), updatedAt: Date.now() }
          : s
      )
    )
  } else {
    const newStock: StockLevel = {
      id: generateId(),
      catalogueItemId: catalogueItem.id,
      partNumber: catalogueItem.partNumber,
      name: catalogueItem.name,
      location,
      quantity,
      lastMovementAt: Date.now(),
      updatedAt: Date.now(),
    }
    state.setStockLevels((current) => [...current, newStock])
  }
  
  const supplierInfo = params.supplier || params.supplierName ? ` from ${params.supplier || params.supplierName}` : ''
  return {
    success: true,
    message: `Received ${quantity} units of ${partNumber}${supplierInfo} into ${location} (local only - not persisted)`
  }
}

function putAwayStock(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  return transferStock(params, state) // Same operation as transfer
}

function useStock(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const partNumber = String(params.partNumber || '').trim()
  const quantity = Number(params.quantity || 0)
  const location = String(params.location || '').trim()
  
  if (!partNumber || quantity <= 0 || !location) {
    return { success: false, message: 'Part number, positive quantity, and location are required' }
  }
  
  const stockItem = state.stockLevels.find(s =>
    s.partNumber.toLowerCase() === partNumber.toLowerCase() &&
    s.location.toLowerCase() === location.toLowerCase()
  )
  
  if (!stockItem) {
    return { success: false, message: `${partNumber} not found in stock at ${location}` }
  }
  
  if (stockItem.quantity < quantity) {
    return {
      success: false,
      message: `Insufficient stock. Only ${stockItem.quantity} units available at ${location}`
    }
  }
  
  state.setStockLevels((current) =>
    current.map(s =>
      s.id === stockItem.id
        ? { ...s, quantity: s.quantity - quantity, lastMovementAt: Date.now(), updatedAt: Date.now() }
        : s
    ).filter(s => s.quantity > 0)
  )
  
  const reason = params.reason ? ` (${params.reason})` : ''
  const jobInfo = params.jobNumber ? ` for job ${params.jobNumber}` : ''
  
  return {
    success: true,
    message: `Used ${quantity} units of ${partNumber} from ${location}${reason}${jobInfo}`
  }
}

function transferStock(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const partNumber = String(params.partNumber || '').trim()
  const fromLocation = String(params.fromLocation || '').trim()
  const toLocation = String(params.toLocation || '').trim()
  const quantity = Number(params.quantity || 0)
  
  if (!partNumber || !fromLocation || !toLocation || quantity <= 0) {
    return { success: false, message: 'Part number, from/to locations, and positive quantity are required' }
  }
  
  const sourceStock = state.stockLevels.find(s =>
    s.partNumber.toLowerCase() === partNumber.toLowerCase() &&
    s.location.toLowerCase() === fromLocation.toLowerCase()
  )
  
  if (!sourceStock) {
    return { success: false, message: `${partNumber} not found at ${fromLocation}` }
  }
  
  if (sourceStock.quantity < quantity) {
    return {
      success: false,
      message: `Insufficient stock at ${fromLocation}. Only ${sourceStock.quantity} units available`
    }
  }
  
  const destStock = state.stockLevels.find(s =>
    s.catalogueItemId === sourceStock.catalogueItemId &&
    s.location.toLowerCase() === toLocation.toLowerCase()
  )
  
  state.setStockLevels((current) => {
    let updated = current.map(s =>
      s.id === sourceStock.id
        ? { ...s, quantity: s.quantity - quantity, lastMovementAt: Date.now(), updatedAt: Date.now() }
        : s
    ).filter(s => s.quantity > 0)
    
    if (destStock) {
      updated = updated.map(s =>
        s.id === destStock.id
          ? { ...s, quantity: s.quantity + quantity, lastMovementAt: Date.now(), updatedAt: Date.now() }
          : s
      )
    } else {
      updated.push({
        id: generateId(),
        catalogueItemId: sourceStock.catalogueItemId,
        partNumber: sourceStock.partNumber,
        name: sourceStock.name,
        location: toLocation,
        quantity,
        lastMovementAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    
    return updated
  })
  
  return {
    success: true,
    message: `Transferred ${quantity} units of ${partNumber} from ${fromLocation} to ${toLocation}`
  }
}

function stockCount(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const partNumber = String(params.partNumber || '').trim()
  const location = String(params.location || '').trim()
  const countedQuantity = Number(params.countedQuantity || 0)
  
  if (!partNumber || !location) {
    return { success: false, message: 'Part number and location are required' }
  }
  
  const stockItem = state.stockLevels.find(s =>
    s.partNumber.toLowerCase() === partNumber.toLowerCase() &&
    s.location.toLowerCase() === location.toLowerCase()
  )
  
  if (!stockItem) {
    // No existing stock, create new if counted > 0
    if (countedQuantity > 0) {
      const catalogueItem = state.catalogue.find(i =>
        i.partNumber.toLowerCase() === partNumber.toLowerCase()
      )
      
      if (catalogueItem) {
        const newStock: StockLevel = {
          id: generateId(),
          catalogueItemId: catalogueItem.id,
          partNumber: catalogueItem.partNumber,
          name: catalogueItem.name,
          location,
          quantity: countedQuantity,
          lastCountedAt: Date.now(),
          lastMovementAt: Date.now(),
          updatedAt: Date.now(),
        }
        state.setStockLevels((current) => [...current, newStock])
        
        return {
          success: true,
          message: `Stock count: Found ${countedQuantity} units of ${partNumber} at ${location} (previously untracked)`
        }
      }
    }
    
    return {
      success: true,
      message: `Stock count: ${partNumber} not found at ${location}. Counted: ${countedQuantity}`
    }
  }
  
  const expectedQuantity = stockItem.quantity
  const difference = countedQuantity - expectedQuantity
  
  state.setStockLevels((current) =>
    current.map(s =>
      s.id === stockItem.id
        ? { ...s, quantity: countedQuantity, lastCountedAt: Date.now(), updatedAt: Date.now() }
        : s
    ).filter(s => s.quantity > 0)
  )
  
  if (difference === 0) {
    return {
      success: true,
      message: `Stock count verified: ${partNumber} at ${location} = ${countedQuantity} units (as expected)`
    }
  } else {
    return {
      success: true,
      message: `Stock count updated: ${partNumber} at ${location}. Expected: ${expectedQuantity}, Counted: ${countedQuantity}, Difference: ${difference > 0 ? '+' : ''}${difference}`
    }
  }
}

function searchStock(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const search = String(params.search || '').toLowerCase().trim()
  
  if (!search) {
    return { success: false, message: 'Search term is required' }
  }
  
  const results = state.stockLevels.filter(stock => {
    const matchesSearch = 
      stock.partNumber.toLowerCase().includes(search) ||
      stock.name.toLowerCase().includes(search)
    
    const matchesLocation = !params.location || 
      stock.location.toLowerCase().includes(String(params.location).toLowerCase())
    
    return matchesSearch && matchesLocation && stock.quantity > 0
  })
  
  return {
    success: true,
    message: `Found ${results.length} item(s) in stock`,
    data: results
  }
}

function lowStockReport(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const location = params.location ? String(params.location).toLowerCase() : null
  
  const lowStockItems = state.catalogue.filter(item => {
    if (!item.isStocked || !item.minQuantity) return false
    
    const stockLevels = state.stockLevels.filter(s => {
      const matchesCatalogue = s.catalogueItemId === item.id
      const matchesLocation = !location || s.location.toLowerCase().includes(location)
      return matchesCatalogue && matchesLocation
    })
    
    const totalStock = stockLevels.reduce((sum, s) => sum + s.quantity, 0)
    return totalStock < item.minQuantity
  }).map(item => {
    const stockLevels = state.stockLevels.filter(s => s.catalogueItemId === item.id)
    const totalStock = stockLevels.reduce((sum, s) => sum + s.quantity, 0)
    return { ...item, currentStock: totalStock, stockLevels }
  })
  
  return {
    success: true,
    message: `Found ${lowStockItems.length} item(s) below minimum stock level`,
    data: lowStockItems
  }
}

function setMinStock(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const partNumber = String(params.partNumber || '').trim()
  const minQuantity = Number(params.minQuantity || 0)
  
  if (!partNumber) {
    return { success: false, message: 'Part number is required' }
  }
  
  const item = state.catalogue.find(i =>
    i.partNumber.toLowerCase() === partNumber.toLowerCase()
  )
  
  if (!item) {
    return { success: false, message: `Catalogue item ${partNumber} not found` }
  }
  
  state.setCatalogue((current) =>
    current.map(i =>
      i.id === item.id
        ? {
            ...i,
            minQuantity,
            reorderQuantity: params.reorderQuantity ? Number(params.reorderQuantity) : i.reorderQuantity,
            updatedAt: Date.now(),
          }
        : i
    )
  )
  
  return {
    success: true,
    message: `Set minimum stock level for ${partNumber} to ${minQuantity} units`
  }
}

// ===== CUSTOMER & EQUIPMENT =====

function createCustomer(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const name = String(params.name || '').trim()
  const type = String(params.type || 'commercial')
  
  if (!name) {
    return { success: false, message: 'Customer name is required' }
  }
  
  const exists = state.customers.find(c =>
    c.name.toLowerCase() === name.toLowerCase()
  )
  
  if (exists) {
    return { success: false, message: `Customer ${name} already exists` }
  }
  
  const newCustomer: Customer = {
    id: generateId(),
    name,
    type: type as 'commercial' | 'residential' | 'industrial',
    contactName: params.contactName ? String(params.contactName) : undefined,
    email: params.email ? String(params.email) : undefined,
    phone: params.phone ? String(params.phone) : undefined,
    billingAddress: params.billingAddress ? String(params.billingAddress) : undefined,
    siteAddresses: [],
    createdAt: Date.now(),
  }
  
  state.setCustomers((current) => [...current, newCustomer])
  
  return {
    success: true,
    message: `Created customer: ${name}`,
    data: newCustomer
  }
}

function addSiteAddress(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const customerName = String(params.customerName || '').trim()
  const siteName = String(params.siteName || '').trim()
  const address = String(params.address || '').trim()
  
  if (!customerName || !siteName || !address) {
    return { success: false, message: 'Customer name, site name, and address are required' }
  }
  
  const customer = state.customers.find(c =>
    c.name.toLowerCase() === customerName.toLowerCase()
  )
  
  if (!customer) {
    return { success: false, message: `Customer ${customerName} not found` }
  }
  
  const newSite = {
    id: generateId(),
    name: siteName,
    address,
    postcode: params.postcode ? String(params.postcode) : undefined,
    accessNotes: params.accessNotes ? String(params.accessNotes) : undefined,
  }
  
  state.setCustomers((current) =>
    current.map(c =>
      c.id === customer.id
        ? { ...c, siteAddresses: [...c.siteAddresses, newSite] }
        : c
    )
  )
  
  return {
    success: true,
    message: `Added site address "${siteName}" to customer ${customerName}`
  }
}

function createEquipment(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const customerName = String(params.customerName || '').trim()
  const equipmentName = String(params.equipmentName || '').trim()
  const type = String(params.type || '').trim()
  
  if (!customerName || !equipmentName || !type) {
    return { success: false, message: 'Customer name, equipment name, and type are required' }
  }
  
  const customer = state.customers.find(c =>
    c.name.toLowerCase() === customerName.toLowerCase()
  )
  
  if (!customer) {
    return { success: false, message: `Customer ${customerName} not found` }
  }
  
  const newEquipment: Equipment = {
    id: generateId(),
    customerId: customer.id,
    customerName: customer.name,
    name: equipmentName,
    type,
    manufacturer: params.manufacturer ? String(params.manufacturer) : undefined,
    model: params.model ? String(params.model) : undefined,
    serialNumber: params.serialNumber ? String(params.serialNumber) : undefined,
    location: params.location ? String(params.location) : undefined,
    createdAt: Date.now(),
  }
  
  state.setEquipment((current) => [...current, newEquipment])
  
  return {
    success: true,
    message: `Created equipment: ${equipmentName} for ${customerName}`,
    data: newEquipment
  }
}

function updateEquipment(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const customerName = String(params.customerName || '').trim()
  const equipmentName = String(params.equipmentName || '').trim()
  
  if (!customerName || !equipmentName) {
    return { success: false, message: 'Customer name and equipment name are required' }
  }
  
  const equipment = state.equipment.find(e =>
    e.customerName.toLowerCase() === customerName.toLowerCase() &&
    e.name.toLowerCase() === equipmentName.toLowerCase()
  )
  
  if (!equipment) {
    return { success: false, message: `Equipment ${equipmentName} not found for ${customerName}` }
  }
  
  state.setEquipment((current) =>
    current.map(e =>
      e.id === equipment.id
        ? {
            ...e,
            lastServiceDate: params.lastServiceDate ? Number(params.lastServiceDate) : e.lastServiceDate,
            nextServiceDue: params.nextServiceDue ? Number(params.nextServiceDue) : e.nextServiceDue,
            technicalNotes: params.technicalNotes ? String(params.technicalNotes) : e.technicalNotes,
          }
        : e
    )
  )
  
  return {
    success: true,
    message: `Updated equipment: ${equipmentName}`
  }
}

function listEquipment(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const customerName = String(params.customerName || '').trim()
  
  if (!customerName) {
    return { success: false, message: 'Customer name is required' }
  }
  
  const equipment = state.equipment.filter(e =>
    e.customerName.toLowerCase() === customerName.toLowerCase()
  )
  
  return {
    success: true,
    message: `Found ${equipment.length} equipment item(s) for ${customerName}`,
    data: equipment
  }
}

// ===== PARTS INSTALLATION =====

function installFromStock(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const partNumber = String(params.partNumber || '').trim()
  const quantity = Number(params.quantity || 0)
  const customerName = String(params.customerName || '').trim()
  const equipmentName = String(params.equipmentName || '').trim()
  const location = String(params.location || '').trim()
  
  if (!partNumber || quantity <= 0 || !customerName || !equipmentName || !location) {
    return { success: false, message: 'Part number, quantity, customer, equipment, and stock location are required' }
  }
  
  // Find equipment
  const equipment = state.equipment.find(e =>
    e.customerName.toLowerCase() === customerName.toLowerCase() &&
    e.name.toLowerCase() === equipmentName.toLowerCase()
  )
  
  if (!equipment) {
    return { success: false, message: `Equipment ${equipmentName} not found for ${customerName}` }
  }
  
  // Check stock and decrement
  const useResult = useStock({ partNumber, quantity, location, reason: 'installation' }, state)
  if (!useResult.success) {
    return useResult
  }
  
  // Find catalogue item for details
  const catalogueItem = state.catalogue.find(i =>
    i.partNumber.toLowerCase() === partNumber.toLowerCase()
  )
  
  // Create installed part record
  const installedPart: InstalledPart = {
    id: generateId(),
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    customerId: equipment.customerId,
    customerName: equipment.customerName,
    partNumber,
    name: catalogueItem?.name || partNumber,
    quantity,
    source: 'stock',
    unitCost: catalogueItem?.unitCost,
    sellPrice: catalogueItem?.sellPrice,
    installedDate: Date.now(),
    jobNumber: params.jobNumber ? String(params.jobNumber) : undefined,
  }
  
  state.setInstalledParts((current) => [...current, installedPart])
  
  return {
    success: true,
    message: `Installed ${quantity} units of ${partNumber} from ${location} on ${customerName}'s ${equipmentName}`,
    data: installedPart
  }
}

function installDirectOrder(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const partNumber = String(params.partNumber || '').trim()
  const name = String(params.name || '').trim()
  const quantity = Number(params.quantity || 0)
  const customerName = String(params.customerName || '').trim()
  const equipmentName = String(params.equipmentName || '').trim()
  const supplierName = String(params.supplierName || '').trim()
  
  if (!partNumber || !name || quantity <= 0 || !customerName || !equipmentName || !supplierName) {
    return { success: false, message: 'Part number, name, quantity, customer, equipment, and supplier are required' }
  }
  
  // Find equipment
  const equipment = state.equipment.find(e =>
    e.customerName.toLowerCase() === customerName.toLowerCase() &&
    e.name.toLowerCase() === equipmentName.toLowerCase()
  )
  
  if (!equipment) {
    return { success: false, message: `Equipment ${equipmentName} not found for ${customerName}` }
  }
  
  // Create installed part record
  const installedPart: InstalledPart = {
    id: generateId(),
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    customerId: equipment.customerId,
    customerName: equipment.customerName,
    partNumber,
    name,
    quantity,
    source: 'direct_order',
    supplierName,
    unitCost: params.unitCost ? Number(params.unitCost) : undefined,
    sellPrice: params.sellPrice ? Number(params.sellPrice) : undefined,
    installedDate: Date.now(),
  }
  
  state.setInstalledParts((current) => [...current, installedPart])
  
  return {
    success: true,
    message: `Installed ${quantity} units of ${partNumber} (direct from ${supplierName}) on ${customerName}'s ${equipmentName}`,
    data: installedPart
  }
}

function queryEquipmentParts(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const customerName = String(params.customerName || '').trim()
  const equipmentName = String(params.equipmentName || '').trim()
  
  if (!customerName || !equipmentName) {
    return { success: false, message: 'Customer name and equipment name are required' }
  }
  
  const parts = state.installedParts.filter(p =>
    p.customerName.toLowerCase() === customerName.toLowerCase() &&
    p.equipmentName.toLowerCase() === equipmentName.toLowerCase()
  )
  
  return {
    success: true,
    message: `Found ${parts.length} part(s) installed on ${customerName}'s ${equipmentName}`,
    data: parts
  }
}

function queryCustomerParts(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const customerName = String(params.customerName || '').trim()
  
  if (!customerName) {
    return { success: false, message: 'Customer name is required' }
  }
  
  const parts = state.installedParts.filter(p =>
    p.customerName.toLowerCase() === customerName.toLowerCase()
  )
  
  return {
    success: true,
    message: `Found ${parts.length} part(s) installed for ${customerName}`,
    data: parts
  }
}

// ===== JOBS =====

function createJob(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const customerName = String(params.customerName || '').trim()
  const type = String(params.type || 'service')
  
  if (!customerName) {
    return { success: false, message: 'Customer name is required' }
  }
  
  const customer = state.customers.find(c =>
    c.name.toLowerCase() === customerName.toLowerCase()
  )
  
  if (!customer) {
    return { success: false, message: `Customer ${customerName} not found` }
  }
  
  // Generate job number
  const jobCount = state.jobs.length + 1
  const jobNumber = `JOB-${Date.now()}-${jobCount.toString().padStart(4, '0')}`
  
  const newJob: Job = {
    id: generateId(),
    jobNumber,
    customerId: customer.id,
    customerName: customer.name,
    type: type as Job['type'],
    priority: (params.priority as Job['priority']) || 'normal',
    equipmentName: params.equipmentName ? String(params.equipmentName) : undefined,
    description: params.description ? String(params.description) : undefined,
    reportedFault: params.reportedFault ? String(params.reportedFault) : undefined,
    status: 'quote',
    partsUsed: [],
    createdAt: Date.now(),
  }
  
  state.setJobs((current) => [...current, newJob])
  
  return {
    success: true,
    message: `Created job ${jobNumber} for ${customerName}`,
    data: newJob
  }
}

function scheduleJob(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const jobNumber = String(params.jobNumber || '').trim()
  const scheduledDate = Number(params.scheduledDate || 0)
  
  if (!jobNumber || !scheduledDate) {
    return { success: false, message: 'Job number and scheduled date are required' }
  }
  
  const job = state.jobs.find(j => j.jobNumber === jobNumber)
  
  if (!job) {
    return { success: false, message: `Job ${jobNumber} not found` }
  }
  
  state.setJobs((current) =>
    current.map(j =>
      j.id === job.id
        ? {
            ...j,
            scheduledDate,
            assignedEngineerName: params.assignedEngineerName ? String(params.assignedEngineerName) : j.assignedEngineerName,
            status: 'scheduled' as Job['status'],
          }
        : j
    )
  )
  
  return {
    success: true,
    message: `Scheduled job ${jobNumber}${params.assignedEngineerName ? ` for ${params.assignedEngineerName}` : ''}`
  }
}

function startJob(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const jobNumber = String(params.jobNumber || '').trim()
  
  if (!jobNumber) {
    return { success: false, message: 'Job number is required' }
  }
  
  const job = state.jobs.find(j => j.jobNumber === jobNumber)
  
  if (!job) {
    return { success: false, message: `Job ${jobNumber} not found` }
  }
  
  state.setJobs((current) =>
    current.map(j =>
      j.id === job.id
        ? {
            ...j,
            status: 'in_progress' as Job['status'],
            startedAt: Date.now(),
          }
        : j
    )
  )
  
  return {
    success: true,
    message: `Started job ${jobNumber}`
  }
}

function completeJob(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const jobNumber = String(params.jobNumber || '').trim()
  const workCarriedOut = String(params.workCarriedOut || '').trim()
  
  if (!jobNumber || !workCarriedOut) {
    return { success: false, message: 'Job number and work carried out are required' }
  }
  
  const job = state.jobs.find(j => j.jobNumber === jobNumber)
  
  if (!job) {
    return { success: false, message: `Job ${jobNumber} not found` }
  }
  
  state.setJobs((current) =>
    current.map(j =>
      j.id === job.id
        ? {
            ...j,
            status: 'completed' as Job['status'],
            completedAt: Date.now(),
            workCarriedOut,
            findings: params.findings ? String(params.findings) : j.findings,
            recommendations: params.recommendations ? String(params.recommendations) : j.recommendations,
          }
        : j
    )
  )
  
  return {
    success: true,
    message: `Completed job ${jobNumber}`
  }
}

function updateJob(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const jobNumber = String(params.jobNumber || '').trim()
  
  if (!jobNumber) {
    return { success: false, message: 'Job number is required' }
  }
  
  const job = state.jobs.find(j => j.jobNumber === jobNumber)
  
  if (!job) {
    return { success: false, message: `Job ${jobNumber} not found` }
  }
  
  // Build update object from provided params
  const updates: Partial<Job> = {}
  
  if (params.status) {
    updates.status = String(params.status) as Job['status']
  }
  
  if (params.priority) {
    updates.priority = String(params.priority) as Job['priority']
  }
  
  if (params.description) {
    updates.description = String(params.description)
  }
  
  if (params.notes) {
    updates.notes = String(params.notes)
  }
  
  if (params.findings) {
    updates.findings = String(params.findings)
  }
  
  if (params.recommendations) {
    updates.recommendations = String(params.recommendations)
  }
  
  state.setJobs((current) =>
    current.map(j =>
      j.id === job.id ? { ...j, ...updates } : j
    )
  )
  
  const updatedFields = Object.keys(updates).join(', ')
  return {
    success: true,
    message: `Updated job ${jobNumber} (${updatedFields})`
  }
}

function addPartToJob(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const jobNumber = String(params.jobNumber || '').trim()
  const partNumber = String(params.partNumber || '').trim()
  const quantity = Number(params.quantity || 0)
  const source = String(params.source || 'stock')
  
  if (!jobNumber || !partNumber || quantity <= 0) {
    return { success: false, message: 'Job number, part number, and quantity are required' }
  }
  
  const job = state.jobs.find(j => j.jobNumber === jobNumber)
  
  if (!job) {
    return { success: false, message: `Job ${jobNumber} not found` }
  }
  
  const catalogueItem = state.catalogue.find(i =>
    i.partNumber.toLowerCase() === partNumber.toLowerCase()
  )
  
  const usedPart = {
    id: generateId(),
    partNumber,
    name: catalogueItem?.name || partNumber,
    quantity,
    source: source as 'stock' | 'direct_order' | 'customer_supplied',
    unitCost: catalogueItem?.unitCost,
    sellPrice: catalogueItem?.sellPrice,
  }
  
  state.setJobs((current) =>
    current.map(j =>
      j.id === job.id
        ? { ...j, partsUsed: [...j.partsUsed, usedPart] }
        : j
    )
  )
  
  return {
    success: true,
    message: `Added ${quantity} units of ${partNumber} to job ${jobNumber}`
  }
}

function listJobs(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  let jobs = state.jobs
  
  if (params.customerName) {
    const customerName = String(params.customerName).toLowerCase()
    jobs = jobs.filter(j => j.customerName.toLowerCase() === customerName)
  }
  
  if (params.status) {
    const status = String(params.status)
    jobs = jobs.filter(j => j.status === status)
  }
  
  if (params.assignedEngineerName) {
    const engineerName = String(params.assignedEngineerName).toLowerCase()
    jobs = jobs.filter(j =>
      j.assignedEngineerName?.toLowerCase() === engineerName
    )
  }
  
  return {
    success: true,
    message: `Found ${jobs.length} job(s)`,
    data: jobs
  }
}

// ===== SUPPLIERS & ORDERS =====

function createSupplier(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const name = String(params.name || '').trim()
  
  if (!name) {
    return { success: false, message: 'Supplier name is required' }
  }
  
  const exists = state.suppliers.find(s =>
    s.name.toLowerCase() === name.toLowerCase()
  )
  
  if (exists) {
    return { success: false, message: `Supplier ${name} already exists` }
  }
  
  const newSupplier: Supplier = {
    id: generateId(),
    name,
    contactName: params.contactName ? String(params.contactName) : undefined,
    email: params.email ? String(params.email) : undefined,
    phone: params.phone ? String(params.phone) : undefined,
    accountNumber: params.accountNumber ? String(params.accountNumber) : undefined,
    createdAt: Date.now(),
  }
  
  state.setSuppliers((current) => [...current, newSupplier])
  
  return {
    success: true,
    message: `Created supplier: ${name}`,
    data: newSupplier
  }
}

function createPurchaseOrder(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const supplierName = String(params.supplierName || '').trim()
  const items = params.items as any[] || []
  
  if (!supplierName || items.length === 0) {
    return { success: false, message: 'Supplier name and items are required' }
  }
  
  const supplier = state.suppliers.find(s =>
    s.name.toLowerCase() === supplierName.toLowerCase()
  )
  
  if (!supplier) {
    return { success: false, message: `Supplier ${supplierName} not found` }
  }
  
  const poNumber = `PO-${Date.now()}`
  
  const newPO: PurchaseOrder = {
    id: generateId(),
    poNumber,
    supplierId: supplier.id,
    supplierName: supplier.name,
    items: items.map(item => ({
      partNumber: String(item.partNumber),
      name: String(item.name),
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      totalCost: Number(item.quantity) * Number(item.unitCost),
    })),
    status: 'draft',
    jobNumber: params.jobNumber ? String(params.jobNumber) : undefined,
    createdDate: Date.now(),
  }
  
  state.setPurchaseOrders((current) => [...current, newPO])
  
  return {
    success: true,
    message: `Created purchase order ${poNumber} for ${supplierName}`,
    data: newPO
  }
}

function receivePurchaseOrder(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
  const poNumber = String(params.poNumber || '').trim()
  
  if (!poNumber) {
    return { success: false, message: 'Purchase order number is required' }
  }
  
  const po = state.purchaseOrders.find(p => p.poNumber === poNumber)
  
  if (!po) {
    return { success: false, message: `Purchase order ${poNumber} not found` }
  }
  
  state.setPurchaseOrders((current) =>
    current.map(p =>
      p.id === po.id
        ? {
            ...p,
            status: 'received' as PurchaseOrder['status'],
            receivedDate: Date.now(),
          }
        : p
    )
  )
  
  return {
    success: true,
    message: `Marked purchase order ${poNumber} as received`
  }
}

// ===== LEGACY FUNCTIONS =====

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

function stockCheckLegacy(
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

function handleQuery(
  params: Record<string, unknown>,
  inventory: InventoryItem[],
  locations: Location[],
  customers: Customer[],
  jobs: Job[]
): ExecutionResult {
  // Prefer params.search, then params.query, params.searchTerm, params.q as the query term
  const query = String(
    params.search || params.query || params.searchTerm || params.q || ''
  ).toLowerCase().trim();

  // If no query term, return all data
  if (!query) {
    return { 
      success: true, 
      message: 'Please provide a search term',
      data: { inventory, locations, customers, jobs }
    }
  }

  // Legacy behavior for special query types
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

  // Perform case-insensitive contains matching across item fields
  const results = inventory.filter(item => {
    const itemName = (item.name || '').toLowerCase();
    const itemPartNumber = (item.partNumber || '').toLowerCase();
    
    // Legacy InventoryItem type may not have these fields, so we safely access them
    // @ts-expect-error - sku field may not exist on legacy InventoryItem type
    const itemSku = (item.sku || '').toLowerCase();
    // @ts-expect-error - manufacturer field may not exist on legacy InventoryItem type
    const itemManufacturer = (item.manufacturer || '').toLowerCase();
    // @ts-expect-error - description field may not exist on legacy InventoryItem type
    const itemDescription = (item.description || '').toLowerCase();
    
    // Standard contains matching across all searchable fields
    const containsMatch = 
      itemName.includes(query) ||
      itemPartNumber.includes(query) ||
      itemSku.includes(query) ||
      itemManufacturer.includes(query) ||
      itemDescription.includes(query);
    
    if (containsMatch) return true;
    
    // For short queries (<=4 chars), attempt token startsWith matching
    // This catches short codes like "lmv" in "Siemens LMV37.100"
    if (query.length <= 4) {
      const nameTokens = itemName.split(/[\s\-._]+/);
      const partTokens = itemPartNumber.split(/[\s\-._]+/);
      const skuTokens = itemSku.split(/[\s\-._]+/);
      const manufacturerTokens = itemManufacturer.split(/[\s\-._]+/);
      const descTokens = itemDescription.split(/[\s\-._]+/);
      
      const allTokens = [...nameTokens, ...partTokens, ...skuTokens, ...manufacturerTokens, ...descTokens];
      return allTokens.some(token => token.startsWith(query));
    }
    
    return false;
  });

  // Always return "Searching for: <term>" message with results
  return {
    success: true,
    message: `Searching for: ${query}`,
    data: results
  };
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
