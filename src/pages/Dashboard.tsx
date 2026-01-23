import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CommandInput } from '@/components/CommandInput'
import { CommandResponse, AIClarification } from '@/components/CommandResponse'
import { AIDebugPanel } from '@/components/AIDebugPanel'
import { MissingInfoPrompt } from '@/components/MissingInfoPrompt'
import { SpeechAssistant } from '@/components/SpeechAssistant'
import { InventoryTable } from '@/components/InventoryView'
import { JobsView } from '@/components/JobsView'
import { CommandHistory } from '@/components/CommandHistory'
import { EquipmentView } from '@/components/EquipmentView'
import { SuppliersView } from '@/components/SuppliersView'
import { CustomersView } from '@/components/CustomersView'
import { CatalogueView } from '@/components/CatalogueView'
import { interpretCommand } from '@/lib/ai-commands'
import { executeCommand } from '@/lib/command-executor'
import { generateId } from '@/lib/ai-commands'
import { conversationManager } from '@/lib/conversation-manager'
import { getFlow, processStepInput, supplierExists, SUPPLIER_DETAILS_SUB_FLOW } from '@/lib/multi-step-flows'
import { useCatalogue, useStockLevels, useUpdateStockLevel } from '@/hooks/useInventoryData'
import { useCustomers, useEquipment, useJobs, useSuppliers, usePurchaseOrders } from '@/hooks/useEntityData'
import { useKV } from '@github/spark/hooks' // Legacy KV for non-catalogue/stock data
import { useNavigation } from '@/contexts/NavigationContext'
import type { 
  InventoryItem, 
  Location, 
  Customer, 
  Job, 
  CommandLog,
  Supplier,
  Equipment,
  InstalledPart,
  PurchaseOrder,
  DebugInfo,
  PendingCommand,
  StockLevel
} from '@/lib/types'
import { Package, FileText, ClockCounterClockwise, Sparkle, Gear, User, Bug, BookOpen, UserCircle } from '@phosphor-icons/react'

export function Dashboard() {
  const { userId } = useAuth()
  const { selectedTab, setSelectedTab } = useNavigation()

  // Check if speech feature is enabled
  const isSpeechEnabled = import.meta.env.VITE_FEATURE_SPEECH === 'true'

  // User-scoped KV keys for legacy data - all data is isolated per user
  // Use actual userId when available, hooks require stable keys
  const userPrefix = userId || 'temp'
  
  // Legacy KV storage (for backward compatibility with non-database data)
  const [inventory, setInventory] = useKV<InventoryItem[]>(`${userPrefix}-inventory`, [])
  const [locations, setLocations] = useKV<Location[]>(`${userPrefix}-locations`, [])
  const [commandLogs, setCommandLogs] = useKV<CommandLog[]>(`${userPrefix}-command-logs`, [])
  // TODO: installedParts needs API endpoint - keep as useKV for now
  const [installedParts, setInstalledParts] = useKV<InstalledPart[]>(`${userPrefix}-installed-parts`, [])
  
  // Database-backed storage for all entities (persistent across reloads)
  const { catalogue, loading: catalogueLoading, refetch: refetchCatalogue, setCatalogue } = useCatalogue()
  const { stockLevels, loading: stockLevelsLoading, refetch: refetchStockLevels, setStockLevels } = useStockLevels()
  const { updateStockLevel } = useUpdateStockLevel()
  
  // Database-backed entity hooks (replaces useKV for customers, jobs, equipment, suppliers, purchase orders)
  const { customers, loading: customersLoading, refetch: refetchCustomers, setCustomers } = useCustomers()
  const { equipment, loading: equipmentLoading, refetch: refetchEquipment, setEquipment } = useEquipment()
  const { jobs, loading: jobsLoading, refetch: refetchJobs, setJobs } = useJobs()
  const { suppliers, loading: suppliersLoading, refetch: refetchSuppliers, setSuppliers } = useSuppliers()
  const { purchaseOrders, loading: purchaseOrdersLoading, refetch: refetchPurchaseOrders, setPurchaseOrders } = usePurchaseOrders()

  const [isProcessing, setIsProcessing] = useState(false)
  const [latestResponse, setLatestResponse] = useState<CommandLog | null>(null)
  const [needsClarification, setNeedsClarification] = useState<{
    message: string
    interpretation: string
  } | null>(null)
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const [latestDebugInfo, setLatestDebugInfo] = useState<DebugInfo | null>(null)

  // Handler for updating stock levels from the UI
  const handleStockUpdate = async (id: string, updates: Partial<InventoryItem | StockLevel>) => {
    try {
      // Optimistic update
      setStockLevels((current) => 
        (current || []).map(item => 
          item.id === id ? { ...item, ...updates, updatedAt: Date.now() } : item
        )
      )

      // Update in database
      await updateStockLevel({ id, ...updates })
      toast.success('Stock level updated successfully')
      
      // Refetch to ensure consistency
      await refetchStockLevels()
    } catch (error) {
      toast.error('Failed to update stock level')
      console.error('Failed to update stock level:', error)
      // Refetch to restore correct state
      await refetchStockLevels()
    }
  }

  // Handler for updating customers from the UI
  const handleCustomerUpdate = (id: string, updates: Partial<Customer>) => {
    setCustomers((current) => 
      (current || []).map(customer => 
        customer.id === id ? { ...customer, ...updates } : customer
      )
    )
    toast.success('Customer updated successfully')
  }

  // Handler for updating equipment from the UI
  const handleEquipmentUpdate = (id: string, updates: Partial<Equipment>) => {
    setEquipment((current) => 
      (current || []).map(equip => 
        equip.id === id ? { ...equip, ...updates } : equip
      )
    )
    toast.success('Equipment updated successfully')
  }

  // Handler for updating jobs from the UI
  const handleJobUpdate = (id: string, updates: Partial<Job>) => {
    setJobs((current) => 
      (current || []).map(job => 
        job.id === id ? { ...job, ...updates } : job
      )
    )
    toast.success('Job updated successfully')
  }

  // Handler for updating suppliers from the UI
  const handleSupplierUpdate = (id: string, updates: Partial<Supplier>) => {
    setSuppliers((current) => 
      (current || []).map(supplier => 
        supplier.id === id ? { ...supplier, ...updates } : supplier
      )
    )
    toast.success('Supplier updated successfully')
  }

  // Keyboard shortcut to toggle debug mode (Ctrl/Cmd + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        setDebugMode(prev => {
          const newMode = !prev
          toast.info(newMode ? 'Debug mode enabled' : 'Debug mode disabled')
          return newMode
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Show loading state while userId is being retrieved
  // This should rarely happen since ProtectedLayout already checks auth
  if (!userId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading user data...</p>
        </div>
      </div>
    )
  }

  const handleCommand = async (command: string) => {
    setIsProcessing(true)
    setNeedsClarification(null)
    setLatestResponse(null)
    setLatestDebugInfo(null)

    try {
      // Check if we have a pending command from a previous interaction
      const existingPending = conversationManager.getPendingCommand()
      
      console.log('[Dashboard] Handling command:', {
        command,
        hasExistingPending: !!existingPending,
        pendingAction: existingPending?.pendingAction,
        currentStep: existingPending?.currentStep,
        totalSteps: existingPending?.totalSteps,
        inSubFlow: existingPending?.inSubFlow,
        subFlowType: existingPending?.subFlowType
      })
      
      let actionToExecute: string
      let paramsToExecute: Record<string, unknown>
      
      if (existingPending) {
        // User is responding to a pending command
        // Check if they're confirming to add to catalogue
        const commandLower = command.toLowerCase().trim()
        
        // IMPORTANT: Check for specific pendingAction handlers FIRST, before checking the general handler
        // This ensures proper precedence and prevents conflicts
        if (existingPending.pendingAction === 'CONFIRM_ADD_SUPPLIER') {
          // Handle supplier details confirmation
          if (commandLower === 'yes' || /\byes\b/.test(commandLower)) {
            // User wants to add supplier details, start sub-flow
            const supplierName = String(existingPending.collectedData?.preferredSupplierName || '')
            const firstSubStep = SUPPLIER_DETAILS_SUB_FLOW[0]
            
            const subFlowPending = conversationManager.createPendingCommand(
              existingPending.action,
              existingPending.parameters,
              [],
              firstSubStep.prompt(supplierName),
              'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK',
              existingPending.context,
              ['Skip'],
              1, // First sub-flow step
              SUPPLIER_DETAILS_SUB_FLOW.length, // Total sub-flow steps
              existingPending.collectedData
            )
            subFlowPending.inSubFlow = true
            subFlowPending.subFlowType = 'SUPPLIER_DETAILS'
            subFlowPending.subFlowData = {}
            subFlowPending.parentStep = 4 // Continue from step 4 (manufacturer) after sub-flow
            
            setPendingCommand(subFlowPending)
            setIsProcessing(false)
            return
          } else {
            // User declined to add supplier details, continue to next step
            const flow = getFlow('CREATE_CATALOGUE_ITEM_AND_ADD_STOCK')
            if (!flow) {
              toast.error('Flow configuration error')
              setIsProcessing(false)
              return
            }
            
            const nextStep = 4 // Step 4 is manufacturer
            const nextStepIndex = nextStep - 1
            const nextStepDef = flow.steps[nextStepIndex]
            const itemName = String(existingPending.context?.item || existingPending.context?.suggestedName || '')
            
            const updatedPending = conversationManager.createPendingCommand(
              existingPending.action,
              existingPending.parameters,
              [],
              nextStepDef.prompt(itemName),
              'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK',
              existingPending.context,
              ['Skip'],
              nextStep,
              flow.steps.length,
              existingPending.collectedData
            )
            
            // Preserve sub-flow state
            updatedPending.inSubFlow = existingPending.inSubFlow
            updatedPending.subFlowType = existingPending.subFlowType
            updatedPending.resumeAction = existingPending.resumeAction
            updatedPending.resumeParams = existingPending.resumeParams
            
            setPendingCommand(updatedPending)
            setIsProcessing(false)
            return
          }
        } else if (existingPending.pendingAction === 'CONFIRM_ADD_CUSTOMER') {
          // Handle customer creation confirmation
          if (commandLower === 'yes' || /\byes\b/.test(commandLower)) {
            // User wants to add customer details, start sub-flow
            const flow = getFlow('CREATE_CUSTOMER')
            if (!flow) {
              toast.error('Flow configuration error')
              setIsProcessing(false)
              return
            }
            
            const customerName = String(existingPending.context?.customerName || '')
            const firstSubStep = flow.steps[0]
            
            const subFlowPending = conversationManager.createPendingCommand(
              existingPending.action,
              existingPending.parameters,
              [],
              firstSubStep.prompt(customerName),
              'CREATE_CUSTOMER',
              {
                ...existingPending.context,
                name: customerName,  // Map customerName → name
              },
              firstSubStep.optional ? ['Skip'] : undefined,
              1,
              flow.steps.length,
              {}
            )
            subFlowPending.inSubFlow = true
            subFlowPending.subFlowType = 'CUSTOMER_DETAILS'
            subFlowPending.subFlowData = {}
            subFlowPending.resumeAction = existingPending.context?.resumeAction as string | undefined
            subFlowPending.resumeParams = existingPending.context?.resumeParams as Record<string, unknown> | undefined
            
            setPendingCommand(subFlowPending)
            setIsProcessing(false)
            return
          } else {
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
            toast.info('Operation cancelled')
            setIsProcessing(false)
            return
          }
        } else if (existingPending.pendingAction === 'CONFIRM_ADD_EQUIPMENT') {
          // Handle equipment creation confirmation
          if (commandLower === 'yes' || /\byes\b/.test(commandLower)) {
            // User wants to add equipment details, start sub-flow
            const flow = getFlow('CREATE_EQUIPMENT')
            if (!flow) {
              toast.error('Flow configuration error')
              setIsProcessing(false)
              return
            }
            
            const equipmentName = String(existingPending.context?.equipmentName || '')
            const firstSubStep = flow.steps[0]
            
            const subFlowPending = conversationManager.createPendingCommand(
              existingPending.action,
              existingPending.parameters,
              [],
              firstSubStep.prompt(equipmentName),
              'CREATE_EQUIPMENT',
              {
                ...existingPending.context,
                equipmentName: existingPending.context?.equipmentName,  // Explicitly preserve (defensive programming)
                customerName: existingPending.context?.customerName,     // Explicitly preserve (defensive programming)
              },
              firstSubStep.optional ? ['Skip'] : undefined,
              1,
              flow.steps.length,
              {}
            )
            subFlowPending.inSubFlow = true
            subFlowPending.subFlowType = 'EQUIPMENT_DETAILS'
            subFlowPending.subFlowData = {}
            subFlowPending.resumeAction = existingPending.context?.resumeAction as string | undefined
            subFlowPending.resumeParams = existingPending.context?.resumeParams as Record<string, unknown> | undefined
            
            setPendingCommand(subFlowPending)
            setIsProcessing(false)
            return
          } else {
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
            toast.info('Operation cancelled')
            setIsProcessing(false)
            return
          }
        } else if (existingPending.pendingAction === 'CONFIRM_ADD_JOB') {
          // Handle job creation confirmation
          if (commandLower === 'yes' || /\byes\b/.test(commandLower)) {
            // User wants to add job details, start sub-flow
            const flow = getFlow('CREATE_JOB')
            if (!flow) {
              toast.error('Flow configuration error')
              setIsProcessing(false)
              return
            }
            
            const jobNumber = String(existingPending.context?.jobNumber || '')
            const firstSubStep = flow.steps[0]
            
            const subFlowPending = conversationManager.createPendingCommand(
              existingPending.action,
              existingPending.parameters,
              [],
              firstSubStep.prompt(jobNumber),
              'CREATE_JOB',
              existingPending.context,
              firstSubStep.optional ? ['Skip'] : undefined,
              1,
              flow.steps.length,
              {}
            )
            subFlowPending.inSubFlow = true
            subFlowPending.subFlowType = 'JOB_DETAILS'
            subFlowPending.subFlowData = {}
            subFlowPending.resumeAction = existingPending.context?.resumeAction as string | undefined
            subFlowPending.resumeParams = existingPending.context?.resumeParams as Record<string, unknown> | undefined
            
            setPendingCommand(subFlowPending)
            setIsProcessing(false)
            return
          } else {
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
            toast.info('Operation cancelled')
            setIsProcessing(false)
            return
          }
        } else if (existingPending.pendingAction === 'CONFIRM_ADD_CATALOGUE_ITEM') {
          // Handle catalogue item creation confirmation
          if (commandLower === 'yes' || /\byes\b/.test(commandLower)) {
            // User wants to add catalogue item details, start sub-flow
            const flow = getFlow('CREATE_CATALOGUE_ITEM_WITH_DETAILS')
            if (!flow) {
              toast.error('Flow configuration error')
              setIsProcessing(false)
              return
            }
            
            const partNumber = String(existingPending.context?.partNumber || '')
            const firstSubStep = flow.steps[0]
            
            const subFlowPending = conversationManager.createPendingCommand(
              existingPending.action,
              existingPending.parameters,
              [],
              firstSubStep.prompt(partNumber),
              'CREATE_CATALOGUE_ITEM_WITH_DETAILS',
              {
                ...existingPending.context,
                partNumber: existingPending.context?.partNumber,  // Explicitly preserve (defensive programming)
                name: existingPending.context?.name || existingPending.context?.partNumber,  // Default name to partNumber
              },
              firstSubStep.optional ? ['Skip'] : undefined,
              1,
              flow.steps.length,
              {}
            )
            subFlowPending.inSubFlow = true
            subFlowPending.subFlowType = 'CATALOGUE_DETAILS'
            subFlowPending.subFlowData = {}
            subFlowPending.resumeAction = existingPending.context?.resumeAction as string | undefined
            subFlowPending.resumeParams = existingPending.context?.resumeParams as Record<string, unknown> | undefined
            
            setPendingCommand(subFlowPending)
            setIsProcessing(false)
            return
          } else {
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
            toast.info('Operation cancelled')
            setIsProcessing(false)
            return
          }
        } else if (existingPending && existingPending.currentStep === undefined && existingPending.pendingAction) {
          // Generalized multi-step flow start behavior
          // When user replies "yes" and pendingAction is set, check if a flow exists and start it
          if (commandLower === 'yes') {
            const flow = getFlow(existingPending.pendingAction)
            
            if (flow) {
              // Start the multi-step flow
              const firstStep = flow.steps[0]
              const itemName = String(existingPending.context?.item || existingPending.context?.suggestedName || existingPending.context?.name || '')
              const hint = existingPending.context?.hint ? String(existingPending.context.hint) : undefined
              
              const flowPending = conversationManager.createPendingCommand(
                existingPending.action,
                existingPending.parameters,
                [],
                hint ? `${firstStep.prompt(itemName)}\n${hint}` : firstStep.prompt(itemName),
                existingPending.pendingAction,
                existingPending.context,
                firstStep.optional ? ['Skip'] : undefined,
                1,
                flow.steps.length,
                existingPending.collectedData || {}
              )
              
              setPendingCommand(flowPending)
              toast.info(`Starting ${flow.steps.length}-step flow...`)
              setIsProcessing(false)
              return
            } else {
              // No flow exists, fall back to existing behavior
              // This handles post-flow secondary prompts where currentStep is undefined
              console.warn('[Dashboard] User said "yes" but no flow found for:', existingPending.pendingAction)
              toast.info('All optional fields have been collected. Creating item...')
              actionToExecute = existingPending.pendingAction || existingPending.action
              paramsToExecute = {
                ...existingPending.context,
                ...existingPending.parameters,
                flowCompleted: true
              }
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              // Continue to execute the action below
            }
          } else if (commandLower === 'no' || commandLower === 'no - create now' || commandLower === 'create now') {
            // User declined to add more info, create item with current data
            actionToExecute = existingPending.pendingAction || existingPending.action
            paramsToExecute = {
              ...existingPending.context,
              ...existingPending.parameters,
              flowCompleted: true  // Force creation without further prompts
            }
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
            // Continue to execute the action below
          } else {
            // Ambiguous response, re-prompt
            toast.warning('Please reply with "yes" to add more details or "no" to create the item as-is')
            setIsProcessing(false)
            return
          }
        } else if (existingPending.pendingAction === 'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK') {
          // If the pending command has no multi-step flow in progress and the user replied "yes",
          // start the CREATE_CATALOGUE_ITEM_AND_ADD_STOCK multi-step flow rather than creating immediately.
          if (commandLower === 'yes' && existingPending.currentStep === undefined) {
            const flow = getFlow('CREATE_CATALOGUE_ITEM_AND_ADD_STOCK')
            if (!flow || !flow.steps || flow.steps.length === 0) {
              toast.error('Flow configuration for catalogue creation is missing')
              setIsProcessing(false)
              return
            }

            const partNumberHint = String(
              existingPending.context?.partNumber || existingPending.parameters?.partNumber || existingPending.context?.item || existingPending.parameters?.item || ''
            ).trim()

            const firstPrompt =
              typeof flow.steps[0].prompt === 'function'
                ? flow.steps[0].prompt(partNumberHint)
                : flow.steps[0].prompt || `Please provide ${flow.steps[0].field}`

            const newPending = conversationManager.createPendingCommand(
              existingPending.action,
              existingPending.parameters,
              [], // missingFields are managed by the flow
              firstPrompt,
              existingPending.pendingAction, // preserve pendingAction
              existingPending.context, // preserve context (item, quantity, location)
              existingPending.options || [], // options from existing pending command (if any)
              1, // currentStep
              flow.steps.length, // totalSteps
              existingPending.collectedData || {} // collectedData (may be empty)
            )

            setPendingCommand(newPending)
            toast.info('Collecting additional catalogue details...')
            setIsProcessing(false)
            return
          }
          
          // Check if this is a multi-step flow in progress
          if (existingPending.currentStep !== undefined && existingPending.totalSteps !== undefined) {
            // Check if we're in a supplier details sub-flow
            if (existingPending.inSubFlow && existingPending.subFlowType === 'SUPPLIER_DETAILS') {
              // Handle supplier details sub-flow
              const subFlowStepIndex = (existingPending.currentStep || 1) - 1
              const subFlowStep = SUPPLIER_DETAILS_SUB_FLOW[subFlowStepIndex]
              
              if (!subFlowStep) {
                toast.error('Sub-flow configuration error')
                setIsProcessing(false)
                return
              }
              
              // Check for cancel
              if (commandLower === 'cancel') {
                conversationManager.clearPendingCommand()
                setPendingCommand(null)
                toast.info('Operation cancelled')
                setIsProcessing(false)
                return
              }
              
              // Process the sub-flow step input
              const result = processStepInput(subFlowStep, command)
              
              if (result.error) {
                toast.error(result.error)
                setIsProcessing(false)
                return
              }
              
              // Collect the supplier data
              const subFlowData = { ...(existingPending.subFlowData || {}) }
              if (!result.skipped && result.value !== null) {
                subFlowData[subFlowStep.field] = result.value
              }
              
              // Show skip confirmation if skipped
              if (result.skipped && subFlowStep.skipText) {
                toast.info(subFlowStep.skipText)
              }
              
              // Check if sub-flow is complete
              if ((existingPending.currentStep || 0) < SUPPLIER_DETAILS_SUB_FLOW.length) {
                // More sub-flow steps to go
                const nextSubStep = (existingPending.currentStep || 0) + 1
                const nextSubStepDef = SUPPLIER_DETAILS_SUB_FLOW[nextSubStep - 1]
                const supplierName = String(existingPending.collectedData?.preferredSupplierName || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextSubStepDef.prompt(supplierName),
                  existingPending.pendingAction,
                  existingPending.context,
                  ['Skip'],
                  nextSubStep,
                  SUPPLIER_DETAILS_SUB_FLOW.length,
                  existingPending.collectedData
                )
                updatedPending.inSubFlow = true
                updatedPending.subFlowType = 'SUPPLIER_DETAILS'
                updatedPending.subFlowData = subFlowData
                updatedPending.parentStep = existingPending.parentStep
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              } else {
                // Sub-flow complete, create the supplier and continue main flow
                const supplierName = String(existingPending.collectedData?.preferredSupplierName || '')
                
                // Create new supplier
                const newSupplier: Supplier = {
                  id: generateId(),
                  name: supplierName,
                  address: subFlowData.address ? String(subFlowData.address) : undefined,
                  email: subFlowData.email ? String(subFlowData.email) : undefined,
                  website: subFlowData.website ? String(subFlowData.website) : undefined,
                  phone: subFlowData.phone ? String(subFlowData.phone) : undefined,
                  createdAt: Date.now(),
                }
                
                setSuppliers((current) => [...(current || []), newSupplier])
                toast.success(`Supplier "${supplierName}" created`)
                
                // Continue main flow from where we left off (step 4 - manufacturer)
                const flow = getFlow('CREATE_CATALOGUE_ITEM_AND_ADD_STOCK')
                if (!flow) {
                  toast.error('Flow configuration error')
                  setIsProcessing(false)
                  return
                }
                
                const parentStep = existingPending.parentStep || 4 // Default to step 4 (manufacturer)
                const nextStepIndex = parentStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const itemName = String(existingPending.context?.item || existingPending.context?.suggestedName || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(itemName),
                  existingPending.pendingAction,
                  existingPending.context,
                  ['Skip'],
                  parentStep,
                  flow.steps.length,
                  existingPending.collectedData
                )
                
                // Preserve sub-flow state (resumeAction and resumeParams, but clear inSubFlow since we're returning)
                updatedPending.resumeAction = existingPending.resumeAction
                updatedPending.resumeParams = existingPending.resumeParams
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
            }
            
            // Multi-step flow in progress (main flow)
            const flow = getFlow('CREATE_CATALOGUE_ITEM_AND_ADD_STOCK')
            if (!flow) {
              toast.error('Flow configuration error')
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              setIsProcessing(false)
              return
            }
            
            const currentStepIndex = existingPending.currentStep - 1
            const step = flow.steps[currentStepIndex]
            
            // Check for cancel
            if (commandLower === 'cancel') {
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            }
            
            // Process the step input
            const result = processStepInput(step, command)
            
            if (result.error) {
              toast.error(result.error)
              setIsProcessing(false)
              return
            }
            
            // Collect the data
            const collectedData = { ...(existingPending.collectedData || {}) }
            if (!result.skipped && result.value !== null) {
              collectedData[step.field] = result.value
            }
            
            // Show skip confirmation if skipped
            if (result.skipped && step.skipText) {
              toast.info(step.skipText)
            }
            
            // SUPPLIER VALIDATION: After step 3 (preferredSupplierName), check if supplier exists
            if (existingPending.currentStep === 3 && step.field === 'preferredSupplierName') {
              const supplierName = result.value as string
              
              // Only validate if supplier name was provided (not skipped)
              if (supplierName && !result.skipped && !supplierExists(supplierName, suppliers || [])) {
                // Supplier doesn't exist, ask if user wants to add details
                const confirmPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  `Supplier "${supplierName}" not found. Would you like to add their details?`,
                  'CONFIRM_ADD_SUPPLIER',
                  existingPending.context,
                  ['Yes', 'No/Skip'],
                  existingPending.currentStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                setPendingCommand(confirmPending)
                setIsProcessing(false)
                return
              }
            }
            
            // Move to next step or complete
            if (existingPending.currentStep < existingPending.totalSteps) {
              // FIX 3: Find next step that needs input (skip already-known fields)
              let nextStep = existingPending.currentStep + 1
              while (nextStep <= existingPending.totalSteps) {
                const stepField = flow.steps[nextStep - 1].field
                if (!(stepField in collectedData)) {
                  break  // This step needs input
                }
                nextStep++  // Skip this step, we already have the value
              }
              
              if (nextStep <= existingPending.totalSteps) {
                // Found a step that needs input
                const nextStepIndex = nextStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const itemName = String(existingPending.context?.item || existingPending.context?.suggestedName || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(itemName),
                  existingPending.pendingAction,
                  existingPending.context,
                  ['Skip'], // Always offer skip option
                  nextStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                // Preserve sub-flow state
                updatedPending.inSubFlow = existingPending.inSubFlow
                updatedPending.subFlowType = existingPending.subFlowType
                updatedPending.resumeAction = existingPending.resumeAction
                updatedPending.resumeParams = existingPending.resumeParams
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
              // If nextStep > totalSteps, fall through to completion
            }
            
            // All steps completed (or skipped), execute the action
            // FIX 4: Properly merge all data sources on final execution
            actionToExecute = 'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK'
            paramsToExecute = {
              // Start with all context to preserve everything
              ...existingPending.context,
              // Ensure critical fields are explicitly set with proper fallbacks
              item: existingPending.context?.item || existingPending.context?.suggestedName,
              partNumber: existingPending.context?.partNumber || existingPending.context?.item,
              name: existingPending.context?.name || existingPending.context?.item,
              quantity: existingPending.context?.quantity,
              location: existingPending.context?.location,
              // Collected data from multi-step flow
              collectedData,
              currentStep: existingPending.currentStep,
              totalSteps: existingPending.totalSteps,
              flowCompleted: true  // Signal that user already went through the flow
            }
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
          } else {
            // Initial confirmation (yes/no)
            if (commandLower === 'yes' || commandLower === 'add it' || 
                /\byes\b/.test(commandLower) || /\badd\s+it\b/.test(commandLower)) {
              // User confirmed, start multi-step flow
              const flow = getFlow('CREATE_CATALOGUE_ITEM_AND_ADD_STOCK')
              if (!flow) {
                toast.error('Flow configuration error')
                conversationManager.clearPendingCommand()
                setPendingCommand(null)
                setIsProcessing(false)
                return
              }
              
              const itemName = String(existingPending.context?.item || existingPending.context?.suggestedName || '')
              
              // FIX 2: Pre-populate collectedData with already-known values from context
              const alreadyKnown: Record<string, unknown> = {}
              if (existingPending.context?.unitCost !== undefined) alreadyKnown.unitCost = existingPending.context.unitCost
              if (existingPending.context?.markup !== undefined) alreadyKnown.markup = existingPending.context.markup
              if (existingPending.context?.preferredSupplierName) alreadyKnown.preferredSupplierName = existingPending.context.preferredSupplierName
              if (existingPending.context?.manufacturer) alreadyKnown.manufacturer = existingPending.context.manufacturer
              if (existingPending.context?.category) alreadyKnown.category = existingPending.context.category
              if (existingPending.context?.minQuantity !== undefined) alreadyKnown.minQuantity = existingPending.context.minQuantity
              
              // FIX 3: Find first step that needs input (skip already-known fields)
              let startStep = 1
              for (let i = 0; i < flow.steps.length; i++) {
                const stepField = flow.steps[i].field
                if (!(stepField in alreadyKnown)) {
                  startStep = i + 1 // Steps are 1-indexed
                  break
                }
                // If we've skipped all steps, startStep will be beyond totalSteps
                if (i === flow.steps.length - 1) {
                  startStep = flow.steps.length + 1
                }
              }
              
              // If all steps are already completed, execute immediately
              if (startStep > flow.steps.length) {
                actionToExecute = 'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK'
                paramsToExecute = {
                  ...existingPending.context,
                  collectedData: alreadyKnown,
                  currentStep: flow.steps.length,
                  totalSteps: flow.steps.length,
                  flowCompleted: true  // Signal that user already went through the flow
                }
                conversationManager.clearPendingCommand()
                setPendingCommand(null)
                // Continue to execution below
              } else {
                const currentStepDef = flow.steps[startStep - 1]
                
                const pending = conversationManager.createPendingCommand(
                  'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK',
                  existingPending.parameters,
                  [],
                  currentStepDef.prompt(itemName),
                  'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK',
                  existingPending.context,
                  ['Skip'], // Always offer skip option
                  startStep, // currentStep
                  flow.steps.length, // totalSteps
                  alreadyKnown // Start with known values instead of empty {}
                )
                
                setPendingCommand(pending)
                setIsProcessing(false)
                return
              }
            } else if (commandLower === 'no' || commandLower === 'cancel') {
              // User cancelled
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            } else {
              // Ambiguous response, re-prompt
              toast.warning('Please reply with "yes" to add the item or "no" to cancel')
              setIsProcessing(false)
              return
            }
          }
        } else if (existingPending.pendingAction === 'CREATE_CATALOGUE_ITEM_WITH_DETAILS') {
          // Handle CREATE_CATALOGUE_ITEM_WITH_DETAILS flow (similar to CREATE_CATALOGUE_ITEM_AND_ADD_STOCK but without stock)
          if (existingPending.currentStep !== undefined && existingPending.totalSteps !== undefined) {
            // Check if we're in a supplier details sub-flow
            if (existingPending.inSubFlow && existingPending.subFlowType === 'SUPPLIER_DETAILS') {
              // Handle supplier details sub-flow (same logic as above)
              const subFlowStepIndex = (existingPending.currentStep || 1) - 1
              const subFlowStep = SUPPLIER_DETAILS_SUB_FLOW[subFlowStepIndex]
              
              if (!subFlowStep) {
                toast.error('Sub-flow configuration error')
                setIsProcessing(false)
                return
              }
              
              if (commandLower === 'cancel') {
                conversationManager.clearPendingCommand()
                setPendingCommand(null)
                toast.info('Operation cancelled')
                setIsProcessing(false)
                return
              }
              
              const result = processStepInput(subFlowStep, command)
              
              if (result.error) {
                toast.error(result.error)
                setIsProcessing(false)
                return
              }
              
              const subFlowData = { ...(existingPending.subFlowData || {}) }
              if (!result.skipped && result.value !== null) {
                subFlowData[subFlowStep.field] = result.value
              }
              
              if (result.skipped && subFlowStep.skipText) {
                toast.info(subFlowStep.skipText)
              }
              
              if ((existingPending.currentStep || 0) < SUPPLIER_DETAILS_SUB_FLOW.length) {
                // More sub-flow steps to go
                const nextSubStep = (existingPending.currentStep || 0) + 1
                const nextSubStepDef = SUPPLIER_DETAILS_SUB_FLOW[nextSubStep - 1]
                const supplierName = String(existingPending.collectedData?.preferredSupplierName || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextSubStepDef.prompt(supplierName),
                  existingPending.pendingAction,
                  existingPending.context,
                  ['Skip'],
                  nextSubStep,
                  SUPPLIER_DETAILS_SUB_FLOW.length,
                  existingPending.collectedData
                )
                updatedPending.inSubFlow = true
                updatedPending.subFlowType = 'SUPPLIER_DETAILS'
                updatedPending.subFlowData = subFlowData
                updatedPending.parentStep = existingPending.parentStep
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              } else {
                // Sub-flow complete, create the supplier and continue main flow
                const supplierName = String(existingPending.collectedData?.preferredSupplierName || '')
                
                const newSupplier: Supplier = {
                  id: generateId(),
                  name: supplierName,
                  address: subFlowData.address ? String(subFlowData.address) : undefined,
                  email: subFlowData.email ? String(subFlowData.email) : undefined,
                  website: subFlowData.website ? String(subFlowData.website) : undefined,
                  phone: subFlowData.phone ? String(subFlowData.phone) : undefined,
                  createdAt: Date.now(),
                }
                
                setSuppliers((current) => [...(current || []), newSupplier])
                toast.success(`Supplier "${supplierName}" created`)
                
                // Continue main flow from where we left off (step 4 - manufacturer)
                const flow = getFlow('CREATE_CATALOGUE_ITEM_WITH_DETAILS')
                if (!flow) {
                  toast.error('Flow configuration error')
                  setIsProcessing(false)
                  return
                }
                
                const parentStep = existingPending.parentStep || 4
                const nextStepIndex = parentStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const itemName = String(existingPending.context?.partNumber || existingPending.context?.name || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(itemName),
                  existingPending.pendingAction,
                  existingPending.context,
                  ['Skip'],
                  parentStep,
                  flow.steps.length,
                  existingPending.collectedData
                )
                
                // Preserve sub-flow state (resumeAction and resumeParams, but clear inSubFlow since we're returning)
                updatedPending.resumeAction = existingPending.resumeAction
                updatedPending.resumeParams = existingPending.resumeParams
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
            }
            
            // Multi-step flow in progress (main flow)
            const flow = getFlow('CREATE_CATALOGUE_ITEM_WITH_DETAILS')
            if (!flow) {
              toast.error('Flow configuration error')
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              setIsProcessing(false)
              return
            }
            
            const currentStepIndex = existingPending.currentStep - 1
            const step = flow.steps[currentStepIndex]
            
            if (commandLower === 'cancel') {
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            }
            
            const result = processStepInput(step, command)
            
            if (result.error) {
              toast.error(result.error)
              setIsProcessing(false)
              return
            }
            
            const collectedData = { ...(existingPending.collectedData || {}) }
            if (!result.skipped && result.value !== null) {
              collectedData[step.field] = result.value
            }
            
            if (result.skipped && step.skipText) {
              toast.info(step.skipText)
            }
            
            // SUPPLIER VALIDATION: After step 3 (preferredSupplierName), check if supplier exists
            if (existingPending.currentStep === 3 && step.field === 'preferredSupplierName') {
              const supplierName = result.value as string
              
              if (supplierName && !result.skipped && !supplierExists(supplierName, suppliers || [])) {
                const confirmPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  `Supplier "${supplierName}" not found. Would you like to add their details?`,
                  'CONFIRM_ADD_SUPPLIER',
                  existingPending.context,
                  ['Yes', 'No/Skip'],
                  existingPending.currentStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                setPendingCommand(confirmPending)
                setIsProcessing(false)
                return
              }
            }
            
            // Move to next step or complete
            if (existingPending.currentStep < existingPending.totalSteps) {
              // FIX 3: Find next step that needs input (skip already-known fields)
              let nextStep = existingPending.currentStep + 1
              while (nextStep <= existingPending.totalSteps) {
                const stepField = flow.steps[nextStep - 1].field
                if (!(stepField in collectedData)) {
                  break  // This step needs input
                }
                nextStep++  // Skip this step, we already have the value
              }
              
              if (nextStep <= existingPending.totalSteps) {
                // Found a step that needs input
                const nextStepIndex = nextStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const itemName = String(existingPending.context?.partNumber || existingPending.context?.name || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(itemName),
                  existingPending.pendingAction,
                  existingPending.context,
                  ['Skip'],
                  nextStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                // Preserve sub-flow state
                updatedPending.inSubFlow = existingPending.inSubFlow
                updatedPending.subFlowType = existingPending.subFlowType
                updatedPending.resumeAction = existingPending.resumeAction
                updatedPending.resumeParams = existingPending.resumeParams
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
              // If nextStep > totalSteps, fall through to completion
            }
            
            // All steps completed (or skipped), execute the action
            // FIX 4: Properly merge all data sources on final execution
            actionToExecute = 'CREATE_CATALOGUE_ITEM'
            paramsToExecute = {
              // Original command parameters
              partNumber: existingPending.context?.partNumber || existingPending.context?.item,
              name: collectedData.name || existingPending.context?.name || existingPending.context?.partNumber,  // Map with fallbacks
              // Collected data from multi-step flow (spread first so context can override)
              ...collectedData,
              // Calculate sell price if both unitCost and markup are provided
              sellPrice: collectedData.unitCost && collectedData.markup 
                ? Number(collectedData.unitCost) * (1 + Number(collectedData.markup) / 100)
                : undefined,
              // Ensure we don't lose any context
              ...existingPending.context,
              flowCompleted: true  // Signal that user already went through the flow
            }
            
            // Check if we need to resume a previous action after completion
            const resumeAction = existingPending.resumeAction || existingPending.context?.resumeAction
            const resumeParams = existingPending.resumeParams || existingPending.context?.resumeParams
            
            if (resumeAction && resumeParams) {
              // Store resume info for after this action completes
              paramsToExecute.resumeAction = resumeAction
              paramsToExecute.resumeParams = resumeParams
            }
            
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
          } else {
            // Initial confirmation (yes/no)
            if (commandLower === 'yes' || /\byes\b/.test(commandLower)) {
              // User confirmed, start multi-step flow
              const flow = getFlow('CREATE_CATALOGUE_ITEM_WITH_DETAILS')
              if (!flow) {
                toast.error('Flow configuration error')
                conversationManager.clearPendingCommand()
                setPendingCommand(null)
                setIsProcessing(false)
                return
              }
              
              const itemName = String(existingPending.context?.partNumber || existingPending.context?.name || '')
              
              // FIX 2: Pre-populate collectedData with already-known values from context
              const alreadyKnown: Record<string, unknown> = {}
              if (existingPending.context?.unitCost !== undefined) alreadyKnown.unitCost = existingPending.context.unitCost
              if (existingPending.context?.markup !== undefined) alreadyKnown.markup = existingPending.context.markup
              if (existingPending.context?.preferredSupplierName) alreadyKnown.preferredSupplierName = existingPending.context.preferredSupplierName
              if (existingPending.context?.manufacturer) alreadyKnown.manufacturer = existingPending.context.manufacturer
              if (existingPending.context?.category) alreadyKnown.category = existingPending.context.category
              if (existingPending.context?.minQuantity !== undefined) alreadyKnown.minQuantity = existingPending.context.minQuantity
              
              // FIX 3: Find first step that needs input (skip already-known fields)
              let startStep = 1
              for (let i = 0; i < flow.steps.length; i++) {
                const stepField = flow.steps[i].field
                if (!(stepField in alreadyKnown)) {
                  startStep = i + 1 // Steps are 1-indexed
                  break
                }
                // If we've skipped all steps, startStep will be beyond totalSteps
                if (i === flow.steps.length - 1) {
                  startStep = flow.steps.length + 1
                }
              }
              
              // If all steps are already completed, execute immediately
              if (startStep > flow.steps.length) {
                actionToExecute = 'CREATE_CATALOGUE_ITEM'
                paramsToExecute = {
                  ...existingPending.context,
                  ...alreadyKnown,
                  partNumber: existingPending.context?.partNumber,  // Explicitly preserve (defensive programming)
                  name: alreadyKnown.name || existingPending.context?.name || existingPending.context?.partNumber,  // Map with fallbacks
                  // Calculate sell price if both unitCost and markup are provided
                  sellPrice: alreadyKnown.unitCost && alreadyKnown.markup 
                    ? Number(alreadyKnown.unitCost) * (1 + Number(alreadyKnown.markup) / 100)
                    : undefined,
                  flowCompleted: true  // Signal that user already went through the flow
                }
                conversationManager.clearPendingCommand()
                setPendingCommand(null)
                // Continue to execution below
              } else {
                const currentStepDef = flow.steps[startStep - 1]
                
                const pending = conversationManager.createPendingCommand(
                  'CREATE_CATALOGUE_ITEM',
                  existingPending.parameters,
                  [],
                  currentStepDef.prompt(itemName),
                  'CREATE_CATALOGUE_ITEM_WITH_DETAILS',
                  existingPending.context,
                  ['Skip'],
                  startStep,
                  flow.steps.length,
                  alreadyKnown // Start with known values instead of empty {}
                )
                
                setPendingCommand(pending)
                setIsProcessing(false)
                return
              }
            } else if (commandLower === 'no' || commandLower === 'cancel' || /create\s+now/.test(commandLower)) {
              // User declined details, create item with what we have
              actionToExecute = 'CREATE_CATALOGUE_ITEM'
              paramsToExecute = existingPending.context || {}
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
            } else {
              // Ambiguous response, re-prompt
              toast.warning('Please reply with "yes" to add details or "no"/"create now" to create the item as-is')
              setIsProcessing(false)
              return
            }
          }
        } else if (existingPending.pendingAction === 'CREATE_CUSTOMER') {
          if (existingPending.currentStep !== undefined && existingPending.totalSteps !== undefined) {
            // Multi-step flow in progress
            const flow = getFlow('CREATE_CUSTOMER')
            if (!flow) {
              toast.error('Flow configuration error')
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              setIsProcessing(false)
              return
            }
            
            const currentStepIndex = existingPending.currentStep - 1
            const step = flow.steps[currentStepIndex]
            
            if (commandLower === 'cancel') {
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            }
            
            const result = processStepInput(step, command)
            
            if (result.error) {
              toast.error(result.error)
              setIsProcessing(false)
              return
            }
            
            const collectedData = { ...(existingPending.collectedData || {}) }
            if (!result.skipped && result.value !== null) {
              collectedData[step.field] = result.value
            }
            
            if (result.skipped && step.skipText) {
              toast.info(step.skipText)
            }
            
            // Move to next step or complete
            if (existingPending.currentStep < existingPending.totalSteps) {
              let nextStep = existingPending.currentStep + 1
              while (nextStep <= existingPending.totalSteps) {
                const stepField = flow.steps[nextStep - 1].field
                if (!(stepField in collectedData)) {
                  break
                }
                nextStep++
              }
              
              if (nextStep <= existingPending.totalSteps) {
                const nextStepIndex = nextStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const customerName = String(existingPending.context?.name || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(customerName),
                  existingPending.pendingAction,
                  existingPending.context,
                  ['Skip'],
                  nextStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                // Preserve sub-flow state
                updatedPending.inSubFlow = existingPending.inSubFlow
                updatedPending.subFlowType = existingPending.subFlowType
                updatedPending.resumeAction = existingPending.resumeAction
                updatedPending.resumeParams = existingPending.resumeParams
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
            }
            
            // All steps completed, execute the action
            actionToExecute = 'CREATE_CUSTOMER'
            paramsToExecute = {
              ...existingPending.context,
              ...collectedData,
              name: existingPending.context?.name || existingPending.context?.customerName,  // Map customerName → name
              flowCompleted: true
            }
            
            // Check if we need to resume a previous action after completion
            const resumeAction = existingPending.resumeAction || existingPending.context?.resumeAction
            const resumeParams = existingPending.resumeParams || existingPending.context?.resumeParams
            
            if (resumeAction && resumeParams) {
              // Store resume info for after this action completes
              paramsToExecute.resumeAction = resumeAction
              paramsToExecute.resumeParams = resumeParams
            }
            
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
          } else {
            // Initial confirmation (yes/no)
            if (commandLower === 'yes' || /\byes\b/.test(commandLower)) {
              // User confirmed, start multi-step flow
              const flow = getFlow('CREATE_CUSTOMER')
              if (!flow) {
                toast.error('Flow configuration error')
                conversationManager.clearPendingCommand()
                setPendingCommand(null)
                setIsProcessing(false)
                return
              }
              
              const customerName = String(existingPending.context?.name || '')
              
              const pending = conversationManager.createPendingCommand(
                'CREATE_CUSTOMER',
                existingPending.parameters,
                [],
                flow.steps[0].prompt(customerName),
                'CREATE_CUSTOMER',
                existingPending.context,
                flow.steps[0].optional ? ['Skip'] : undefined,
                1,
                flow.steps.length,
                {}
              )
              
              setPendingCommand(pending)
              setIsProcessing(false)
              return
            } else if (commandLower === 'no' || commandLower === 'cancel') {
              // User cancelled
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            } else {
              toast.warning('Please reply with "yes" to add details or "no" to cancel')
              setIsProcessing(false)
              return
            }
          }
        } else if (existingPending.pendingAction === 'CREATE_SUPPLIER') {
          if (existingPending.currentStep !== undefined && existingPending.totalSteps !== undefined) {
            // Multi-step flow in progress
            const flow = getFlow('CREATE_SUPPLIER')
            if (!flow) {
              toast.error('Flow configuration error')
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              setIsProcessing(false)
              return
            }
            
            const currentStepIndex = existingPending.currentStep - 1
            const step = flow.steps[currentStepIndex]
            
            if (commandLower === 'cancel') {
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            }
            
            const result = processStepInput(step, command)
            
            if (result.error) {
              toast.error(result.error)
              setIsProcessing(false)
              return
            }
            
            const collectedData = { ...(existingPending.collectedData || {}) }
            if (!result.skipped && result.value !== null) {
              collectedData[step.field] = result.value
            }
            
            if (result.skipped && step.skipText) {
              toast.info(step.skipText)
            }
            
            // Move to next step or complete
            if (existingPending.currentStep < existingPending.totalSteps) {
              let nextStep = existingPending.currentStep + 1
              while (nextStep <= existingPending.totalSteps) {
                const stepField = flow.steps[nextStep - 1].field
                if (!(stepField in collectedData)) {
                  break
                }
                nextStep++
              }
              
              if (nextStep <= existingPending.totalSteps) {
                const nextStepIndex = nextStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const supplierName = String(existingPending.context?.name || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(supplierName),
                  existingPending.pendingAction,
                  existingPending.context,
                  ['Skip'],
                  nextStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                // Preserve sub-flow state
                updatedPending.inSubFlow = existingPending.inSubFlow
                updatedPending.subFlowType = existingPending.subFlowType
                updatedPending.resumeAction = existingPending.resumeAction
                updatedPending.resumeParams = existingPending.resumeParams
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
            }
            
            // All steps completed, execute the action
            actionToExecute = 'CREATE_SUPPLIER'
            paramsToExecute = {
              ...existingPending.context,
              ...collectedData,
              flowCompleted: true
            }
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
          } else {
            // Initial confirmation (yes/no)
            if (commandLower === 'yes' || /\byes\b/.test(commandLower)) {
              // User confirmed, start multi-step flow
              const flow = getFlow('CREATE_SUPPLIER')
              if (!flow) {
                toast.error('Flow configuration error')
                conversationManager.clearPendingCommand()
                setPendingCommand(null)
                setIsProcessing(false)
                return
              }
              
              const supplierName = String(existingPending.context?.name || '')
              
              const pending = conversationManager.createPendingCommand(
                'CREATE_SUPPLIER',
                existingPending.parameters,
                [],
                flow.steps[0].prompt(supplierName),
                'CREATE_SUPPLIER',
                existingPending.context,
                flow.steps[0].optional ? ['Skip'] : undefined,
                1,
                flow.steps.length,
                {}
              )
              
              setPendingCommand(pending)
              setIsProcessing(false)
              return
            } else if (commandLower === 'no' || commandLower === 'cancel') {
              // User cancelled
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            } else {
              toast.warning('Please reply with "yes" to add details or "no" to cancel')
              setIsProcessing(false)
              return
            }
          }
        } else if (existingPending.pendingAction === 'CREATE_JOB') {
          if (existingPending.currentStep !== undefined && existingPending.totalSteps !== undefined) {
            // Multi-step flow in progress
            const flow = getFlow('CREATE_JOB')
            if (!flow) {
              toast.error('Flow configuration error')
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              setIsProcessing(false)
              return
            }
            
            const currentStepIndex = existingPending.currentStep - 1
            const step = flow.steps[currentStepIndex]
            
            if (commandLower === 'cancel') {
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            }
            
            const result = processStepInput(step, command)
            
            if (result.error) {
              toast.error(result.error)
              setIsProcessing(false)
              return
            }
            
            const collectedData = { ...(existingPending.collectedData || {}) }
            if (!result.skipped && result.value !== null) {
              collectedData[step.field] = result.value
            }
            
            if (result.skipped && step.skipText) {
              toast.info(step.skipText)
            }
            
            // Move to next step or complete
            if (existingPending.currentStep < existingPending.totalSteps) {
              let nextStep = existingPending.currentStep + 1
              while (nextStep <= existingPending.totalSteps) {
                const stepField = flow.steps[nextStep - 1].field
                if (!(stepField in collectedData)) {
                  break
                }
                nextStep++
              }
              
              if (nextStep <= existingPending.totalSteps) {
                const nextStepIndex = nextStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const customerName = String(existingPending.context?.name || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(customerName),
                  existingPending.pendingAction,
                  existingPending.context,
                  ['Skip'],
                  nextStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                // Preserve sub-flow state
                updatedPending.inSubFlow = existingPending.inSubFlow
                updatedPending.subFlowType = existingPending.subFlowType
                updatedPending.resumeAction = existingPending.resumeAction
                updatedPending.resumeParams = existingPending.resumeParams
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
            }
            
            // All steps completed, execute the action
            actionToExecute = 'CREATE_JOB'
            paramsToExecute = {
              ...existingPending.context,
              ...collectedData,
              customerName: existingPending.context?.customerName,  // Explicitly preserve (defensive programming)
              flowCompleted: true
            }
            
            // Check if we need to resume a previous action after completion
            const resumeAction = existingPending.resumeAction || existingPending.context?.resumeAction
            const resumeParams = existingPending.resumeParams || existingPending.context?.resumeParams
            
            if (resumeAction && resumeParams) {
              // Store resume info for after this action completes
              paramsToExecute.resumeAction = resumeAction
              paramsToExecute.resumeParams = resumeParams
            }
            
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
          } else {
            // Initial confirmation (yes/no)
            if (commandLower === 'yes' || /\byes\b/.test(commandLower)) {
              // User confirmed, start multi-step flow
              const flow = getFlow('CREATE_JOB')
              if (!flow) {
                toast.error('Flow configuration error')
                conversationManager.clearPendingCommand()
                setPendingCommand(null)
                setIsProcessing(false)
                return
              }
              
              const customerName = String(existingPending.context?.customerName || '')
              
              const pending = conversationManager.createPendingCommand(
                'CREATE_JOB',
                existingPending.parameters,
                [],
                flow.steps[0].prompt(customerName),
                'CREATE_JOB',
                existingPending.context,
                flow.steps[0].optional ? ['Skip'] : undefined,
                1,
                flow.steps.length,
                {}
              )
              
              setPendingCommand(pending)
              setIsProcessing(false)
              return
            } else if (commandLower === 'no' || commandLower === 'cancel') {
              // User cancelled
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            } else {
              toast.warning('Please reply with "yes" to add details or "no" to cancel')
              setIsProcessing(false)
              return
            }
          }
        } else if (existingPending.pendingAction === 'CREATE_EQUIPMENT') {
          if (existingPending.currentStep !== undefined && existingPending.totalSteps !== undefined) {
            // Multi-step flow in progress
            const flow = getFlow('CREATE_EQUIPMENT')
            if (!flow) {
              toast.error('Flow configuration error')
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              setIsProcessing(false)
              return
            }
            
            const currentStepIndex = existingPending.currentStep - 1
            const step = flow.steps[currentStepIndex]
            
            if (commandLower === 'cancel') {
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            }
            
            const result = processStepInput(step, command)
            
            if (result.error) {
              toast.error(result.error)
              setIsProcessing(false)
              return
            }
            
            const collectedData = { ...(existingPending.collectedData || {}) }
            if (!result.skipped && result.value !== null) {
              collectedData[step.field] = result.value
            }
            
            if (result.skipped && step.skipText) {
              toast.info(step.skipText)
            }
            
            // Move to next step or complete
            if (existingPending.currentStep < existingPending.totalSteps) {
              let nextStep = existingPending.currentStep + 1
              while (nextStep <= existingPending.totalSteps) {
                const stepField = flow.steps[nextStep - 1].field
                if (!(stepField in collectedData)) {
                  break
                }
                nextStep++
              }
              
              if (nextStep <= existingPending.totalSteps) {
                const nextStepIndex = nextStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const equipmentName = String(existingPending.context?.name || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(equipmentName),
                  existingPending.pendingAction,
                  existingPending.context,
                  ['Skip'],
                  nextStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                // Preserve sub-flow state
                updatedPending.inSubFlow = existingPending.inSubFlow
                updatedPending.subFlowType = existingPending.subFlowType
                updatedPending.resumeAction = existingPending.resumeAction
                updatedPending.resumeParams = existingPending.resumeParams
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
            }
            
            // All steps completed, execute the action
            actionToExecute = 'CREATE_EQUIPMENT'
            paramsToExecute = {
              ...existingPending.context,
              ...collectedData,
              equipmentName: existingPending.context?.equipmentName,  // Explicitly preserve (defensive programming)
              customerName: existingPending.context?.customerName,    // Explicitly preserve (defensive programming)
              flowCompleted: true
            }
            
            // Check if we need to resume a previous action after completion
            const resumeAction = existingPending.resumeAction || existingPending.context?.resumeAction
            const resumeParams = existingPending.resumeParams || existingPending.context?.resumeParams
            
            if (resumeAction && resumeParams) {
              // Store resume info for after this action completes
              paramsToExecute.resumeAction = resumeAction
              paramsToExecute.resumeParams = resumeParams
            }
            
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
          } else {
            // Initial confirmation (yes/no)
            if (commandLower === 'yes' || /\byes\b/.test(commandLower)) {
              // User confirmed, start multi-step flow
              const flow = getFlow('CREATE_EQUIPMENT')
              if (!flow) {
                toast.error('Flow configuration error')
                conversationManager.clearPendingCommand()
                setPendingCommand(null)
                setIsProcessing(false)
                return
              }
              
              const equipmentName = String(existingPending.context?.equipmentName || '')
              
              const pending = conversationManager.createPendingCommand(
                'CREATE_EQUIPMENT',
                existingPending.parameters,
                [],
                flow.steps[0].prompt(equipmentName),
                'CREATE_EQUIPMENT',
                existingPending.context,
                flow.steps[0].optional ? ['Skip'] : undefined,
                1,
                flow.steps.length,
                {}
              )
              
              setPendingCommand(pending)
              setIsProcessing(false)
              return
            } else if (commandLower === 'no' || commandLower === 'cancel') {
              // User cancelled
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            } else {
              toast.warning('Please reply with "yes" to add details or "no" to cancel')
              setIsProcessing(false)
              return
            }
          }
        } else if (existingPending.pendingAction === 'CREATE_PURCHASE_ORDER') {
          if (existingPending.currentStep !== undefined && existingPending.totalSteps !== undefined) {
            // Multi-step flow in progress
            const flow = getFlow('CREATE_PURCHASE_ORDER')
            if (!flow) {
              toast.error('Flow configuration error')
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              setIsProcessing(false)
              return
            }
            
            const currentStepIndex = existingPending.currentStep - 1
            const step = flow.steps[currentStepIndex]
            
            if (commandLower === 'cancel') {
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            }
            
            const result = processStepInput(step, command)
            
            if (result.error) {
              toast.error(result.error)
              setIsProcessing(false)
              return
            }
            
            const collectedData = { ...(existingPending.collectedData || {}) }
            if (!result.skipped && result.value !== null) {
              collectedData[step.field] = result.value
            }
            
            if (result.skipped && step.skipText) {
              toast.info(step.skipText)
            }
            
            // Move to next step or complete
            if (existingPending.currentStep < existingPending.totalSteps) {
              let nextStep = existingPending.currentStep + 1
              while (nextStep <= existingPending.totalSteps) {
                const stepField = flow.steps[nextStep - 1].field
                if (!(stepField in collectedData)) {
                  break
                }
                nextStep++
              }
              
              if (nextStep <= existingPending.totalSteps) {
                const nextStepIndex = nextStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const supplierName = String(existingPending.context?.name || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(supplierName),
                  existingPending.pendingAction,
                  existingPending.context,
                  ['Skip'],
                  nextStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                // Preserve sub-flow state
                updatedPending.inSubFlow = existingPending.inSubFlow
                updatedPending.subFlowType = existingPending.subFlowType
                updatedPending.resumeAction = existingPending.resumeAction
                updatedPending.resumeParams = existingPending.resumeParams
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
            }
            
            // All steps completed, execute the action
            actionToExecute = 'CREATE_PURCHASE_ORDER'
            paramsToExecute = {
              ...existingPending.context,
              ...collectedData,
              flowCompleted: true
            }
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
          } else {
            // Initial confirmation (yes/no)
            if (commandLower === 'yes' || /\byes\b/.test(commandLower)) {
              // User confirmed, start multi-step flow
              const flow = getFlow('CREATE_PURCHASE_ORDER')
              if (!flow) {
                toast.error('Flow configuration error')
                conversationManager.clearPendingCommand()
                setPendingCommand(null)
                setIsProcessing(false)
                return
              }
              
              const supplierName = String(existingPending.context?.supplierName || '')
              
              const pending = conversationManager.createPendingCommand(
                'CREATE_PURCHASE_ORDER',
                existingPending.parameters,
                [],
                flow.steps[0].prompt(supplierName),
                'CREATE_PURCHASE_ORDER',
                existingPending.context,
                flow.steps[0].optional ? ['Skip'] : undefined,
                1,
                flow.steps.length,
                {}
              )
              
              setPendingCommand(pending)
              setIsProcessing(false)
              return
            } else if (commandLower === 'no' || commandLower === 'cancel') {
              // User cancelled
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            } else {
              toast.warning('Please reply with "yes" to add details or "no" to cancel')
              setIsProcessing(false)
              return
            }
          }
        } else if (existingPending.pendingAction === 'USE_STOCK') {
          if (existingPending.currentStep !== undefined && existingPending.totalSteps !== undefined) {
            // Multi-step flow in progress
            const flow = getFlow('USE_STOCK')
            if (!flow) {
              toast.error('Flow configuration error')
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              setIsProcessing(false)
              return
            }
            
            const currentStepIndex = existingPending.currentStep - 1
            const step = flow.steps[currentStepIndex]
            
            if (commandLower === 'cancel') {
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            }
            
            const result = processStepInput(step, command)
            
            if (result.error) {
              toast.error(result.error)
              setIsProcessing(false)
              return
            }
            
            const collectedData = { ...(existingPending.collectedData || {}) }
            if (!result.skipped && result.value !== null) {
              collectedData[step.field] = result.value
            }
            
            if (result.skipped && step.skipText) {
              toast.info(step.skipText)
            }
            
            // Move to next step or complete
            if (existingPending.currentStep < existingPending.totalSteps) {
              let nextStep = existingPending.currentStep + 1
              while (nextStep <= existingPending.totalSteps) {
                const stepField = flow.steps[nextStep - 1].field
                if (!(stepField in collectedData)) {
                  break
                }
                nextStep++
              }
              
              if (nextStep <= existingPending.totalSteps) {
                const nextStepIndex = nextStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const itemName = String(existingPending.context?.item || existingPending.context?.partNumber || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(itemName),
                  existingPending.pendingAction,
                  existingPending.context,
                  nextStepDef.optional ? ['Skip'] : undefined,
                  nextStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
            }
            
            // All steps completed, execute the action
            actionToExecute = 'USE_STOCK'
            paramsToExecute = {
              ...existingPending.context,
              ...collectedData,
              partNumber: existingPending.context?.partNumber || existingPending.context?.item,
              flowCompleted: true
            }
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
          } else {
            // Initial confirmation or direct execution (no confirmation needed for USE_STOCK)
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
            toast.info('Stock removal cancelled')
            setIsProcessing(false)
            return
          }
        } else if (existingPending.pendingAction === 'RECEIVE_STOCK') {
          if (existingPending.currentStep !== undefined && existingPending.totalSteps !== undefined) {
            // Multi-step flow in progress
            const flow = getFlow('RECEIVE_STOCK')
            if (!flow) {
              toast.error('Flow configuration error')
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              setIsProcessing(false)
              return
            }
            
            const currentStepIndex = existingPending.currentStep - 1
            const step = flow.steps[currentStepIndex]
            
            if (commandLower === 'cancel') {
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            }
            
            const result = processStepInput(step, command)
            
            if (result.error) {
              toast.error(result.error)
              setIsProcessing(false)
              return
            }
            
            const collectedData = { ...(existingPending.collectedData || {}) }
            if (!result.skipped && result.value !== null) {
              collectedData[step.field] = result.value
            }
            
            if (result.skipped && step.skipText) {
              toast.info(step.skipText)
            }
            
            // Move to next step or complete
            if (existingPending.currentStep < existingPending.totalSteps) {
              let nextStep = existingPending.currentStep + 1
              while (nextStep <= existingPending.totalSteps) {
                const stepField = flow.steps[nextStep - 1].field
                if (!(stepField in collectedData)) {
                  break
                }
                nextStep++
              }
              
              if (nextStep <= existingPending.totalSteps) {
                const nextStepIndex = nextStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const itemName = String(existingPending.context?.item || existingPending.context?.partNumber || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(itemName),
                  existingPending.pendingAction,
                  existingPending.context,
                  nextStepDef.optional ? ['Skip'] : undefined,
                  nextStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
            }
            
            // All steps completed, execute the action
            actionToExecute = 'RECEIVE_STOCK'
            paramsToExecute = {
              ...existingPending.context,
              ...collectedData,
              partNumber: existingPending.context?.partNumber || existingPending.context?.item,
              flowCompleted: true
            }
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
          } else {
            // Initial confirmation or direct execution
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
            toast.info('Stock receiving cancelled')
            setIsProcessing(false)
            return
          }
        } else if (existingPending.pendingAction === 'TRANSFER_STOCK') {
          if (existingPending.currentStep !== undefined && existingPending.totalSteps !== undefined) {
            // Multi-step flow in progress
            const flow = getFlow('TRANSFER_STOCK')
            if (!flow) {
              toast.error('Flow configuration error')
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              setIsProcessing(false)
              return
            }
            
            const currentStepIndex = existingPending.currentStep - 1
            const step = flow.steps[currentStepIndex]
            
            if (commandLower === 'cancel') {
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
              toast.info('Operation cancelled')
              setIsProcessing(false)
              return
            }
            
            const result = processStepInput(step, command)
            
            if (result.error) {
              toast.error(result.error)
              setIsProcessing(false)
              return
            }
            
            const collectedData = { ...(existingPending.collectedData || {}) }
            if (!result.skipped && result.value !== null) {
              collectedData[step.field] = result.value
            }
            
            if (result.skipped && step.skipText) {
              toast.info(step.skipText)
            }
            
            // Move to next step or complete
            if (existingPending.currentStep < existingPending.totalSteps) {
              let nextStep = existingPending.currentStep + 1
              while (nextStep <= existingPending.totalSteps) {
                const stepField = flow.steps[nextStep - 1].field
                if (!(stepField in collectedData)) {
                  break
                }
                nextStep++
              }
              
              if (nextStep <= existingPending.totalSteps) {
                const nextStepIndex = nextStep - 1
                const nextStepDef = flow.steps[nextStepIndex]
                const itemName = String(existingPending.context?.item || existingPending.context?.partNumber || '')
                
                const updatedPending = conversationManager.createPendingCommand(
                  existingPending.action,
                  existingPending.parameters,
                  [],
                  nextStepDef.prompt(itemName),
                  existingPending.pendingAction,
                  existingPending.context,
                  nextStepDef.optional ? ['Skip'] : undefined,
                  nextStep,
                  existingPending.totalSteps,
                  collectedData
                )
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
            }
            
            // All steps completed, execute the action
            actionToExecute = 'TRANSFER_STOCK'
            paramsToExecute = {
              ...existingPending.context,
              ...collectedData,
              partNumber: existingPending.context?.partNumber || existingPending.context?.item,
              flowCompleted: true
            }
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
          } else {
            // Initial confirmation or direct execution
            conversationManager.clearPendingCommand()
            setPendingCommand(null)
            toast.info('Stock transfer cancelled')
            setIsProcessing(false)
            return
          }
        } else {
          // Try to extract missing parameters from the user's response
          // Pass pending context to help AI understand this is a secondary input
          const pendingContext = {
            pendingAction: existingPending.action,
            missingFields: existingPending.missingFields,
            partialParams: existingPending.parameters
          }
          const interpretation = await interpretCommand(command, pendingContext)
          const completed = conversationManager.completePendingCommand(interpretation.parameters)
          
          if (completed) {
            actionToExecute = completed.action
            paramsToExecute = completed.parameters
          } else {
            // Failed to complete, try as new command
            actionToExecute = interpretation.action
            paramsToExecute = interpretation.parameters
          }
        }
        
        setPendingCommand(null) // Clear UI pending command only if not continuing multi-step
      } else {
        // Normal new command flow
        const interpretation = await interpretCommand(command)

        // [TRACING] Log interpretation result
        console.log('[Dashboard] Step 1 - Interpretation result:', {
          action: interpretation.action,
          parameters: interpretation.parameters,
          confidence: interpretation.confidence
        })

        // Store debug info if available
        if (interpretation.debug) {
          setLatestDebugInfo(interpretation.debug)
        }

        if (interpretation.confidence < 0.7 && interpretation.clarificationNeeded) {
          setNeedsClarification({
            message: interpretation.clarificationNeeded,
            interpretation: interpretation.interpretation
          })
          setIsProcessing(false)
          return
        }

        actionToExecute = interpretation.action
        paramsToExecute = interpretation.parameters
        
        // Check if AI detected missing required parameters
        const missingFromAI = interpretation.debug?.stage2?.missingRequired || []
        if (missingFromAI.length > 0) {
          const pending = conversationManager.createPendingCommand(
            interpretation.action,
            interpretation.parameters,
            missingFromAI,
            `Please provide the following to complete this action: ${missingFromAI.join(', ')}`,
            undefined, // pendingAction - not a pending action, just missing parameters
            interpretation.parameters
          )
          setPendingCommand(pending)
          toast.info(`Missing: ${missingFromAI.join(', ')}`)
          setIsProcessing(false)
          return // DON'T EXECUTE
        }
      }

      // [TRACING] Log before execution
      console.log('[Dashboard] Step 2 - About to execute:', {
        actionToExecute,
        paramsToExecute,
        catalogueLength: catalogue?.length || 0,
        stockLevelsLength: stockLevels?.length || 0
      })

      const result = await executeCommand(
        actionToExecute,
        paramsToExecute,
        inventory || [],
        setInventory,
        locations || [],
        setLocations,
        customers || [],
        setCustomers,
        jobs || [],
        setJobs,
        // New state
        catalogue || [],
        setCatalogue,
        stockLevels || [],
        setStockLevels,
        suppliers || [],
        setSuppliers,
        equipment || [],
        setEquipment,
        installedParts || [],
        setInstalledParts,
        purchaseOrders || [],
        setPurchaseOrders,
        command, // Pass original command for fallback parsing
        userId // Pass userId for API calls
      )

      // Handle if command needs more input
      // Note: We check for both missing fields AND options because some actions (like catalogue confirmation)
      // use options instead of missing fields to prompt the user for a decision
      if (result.needsInput && result.prompt) {
        const hasMissingFields = result.missingFields && result.missingFields.length > 0
        const hasOptions = result.options && result.options.length > 0
        
        if (hasMissingFields || hasOptions) {
          const pending = conversationManager.createPendingCommand(
            actionToExecute,
            paramsToExecute,
            result.missingFields || [],
            result.prompt,
            result.pendingAction,
            result.context,
            result.options
          )
          setPendingCommand(pending)
          
          toast.info(result.pendingAction ? 'Confirmation needed' : 'Need more information')
          setIsProcessing(false)
          return
        }
      }

      const log: CommandLog = {
        id: generateId(),
        command,
        action: actionToExecute,
        timestamp: Date.now(),
        success: result.success,
        result: result.message,
        data: result.data,
        debug: latestDebugInfo || undefined
      }

      setCommandLogs((current) => [...(current || []), log])
      setLatestResponse(log)
      
      // Update conversation context
      conversationManager.updateContext(command, result.message)

      if (result.success) {
        toast.success(result.message)
        
        // Check if we need to resume a previous action after this completion
        const resumeAction = paramsToExecute?.resumeAction
        const resumeParams = paramsToExecute?.resumeParams
        
        if (resumeAction && resumeParams) {
          // Notify user we're continuing with the original action
          const actionName = String(actionToExecute).replace(/_/g, ' ').toLowerCase()
          const resumeName = String(resumeAction).replace(/_/g, ' ').toLowerCase()
          toast.info(`${actionName.charAt(0).toUpperCase() + actionName.slice(1)} created. Continuing with ${resumeName}...`)
          
          // Execute the resumed action after a short delay to let the user see the message
          setTimeout(async () => {
            try {
              const resumeResult = await executeCommand(
                String(resumeAction),
                resumeParams as Record<string, unknown>,
                inventory || [],
                setInventory,
                locations || [],
                setLocations,
                customers || [],
                setCustomers,
                jobs || [],
                setJobs,
                catalogue || [],
                setCatalogue,
                stockLevels || [],
                setStockLevels,
                suppliers || [],
                setSuppliers,
                equipment || [],
                setEquipment,
                installedParts || [],
                setInstalledParts,
                purchaseOrders || [],
                setPurchaseOrders,
                command,
                userId
              )
              
              if (resumeResult.success) {
                toast.success(resumeResult.message)
              } else {
                toast.error(resumeResult.message)
              }
              
              // Log the resumed action
              const resumeLog: CommandLog = {
                id: generateId(),
                command: `[Resumed] ${String(resumeAction)}`,
                action: String(resumeAction),
                timestamp: Date.now(),
                success: resumeResult.success,
                result: resumeResult.message,
                data: resumeResult.data
              }
              setCommandLogs((current) => [...(current || []), resumeLog])
              setLatestResponse(resumeLog)
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to resume action'
              toast.error(errorMessage)
            }
          }, 1000)
        }
        
        // Refetch data from database after successful mutations
        // Check if the action modified catalogue or stock data
        const catalogueActions = [
          'create_catalogue_item', 
          'add_product', 
          'create_product',
          'update_catalogue_item',
          'update_product',
          'create_catalogue_item_and_add_stock'
        ]
        const stockActions = [
          'receive_stock',
          'add_stock',
          'use_stock',
          'remove_stock',
          'transfer_stock',
          'stock_count',
          'count_stock',
          'create_catalogue_item_and_add_stock'
        ]
        
        const actionLower = actionToExecute.toLowerCase()
        
        // Refetch catalogue if modified
        if (catalogueActions.some(action => actionLower === action)) {
          refetchCatalogue().catch(err => console.error('Failed to refetch catalogue:', err))
        }
        
        // Refetch stock levels if modified
        if (stockActions.some(action => actionLower === action)) {
          refetchStockLevels().catch(err => console.error('Failed to refetch stock levels:', err))
        }
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      const log: CommandLog = {
        id: generateId(),
        command,
        action: 'unknown',
        timestamp: Date.now(),
        success: false,
        result: errorMessage
      }

      setCommandLogs((current) => [...(current || []), log])
      setLatestResponse(log)
      toast.error(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const inventoryArray = inventory || []
  const stockLevelsArray = stockLevels || []
  const jobsArray = jobs || []
  const customersArray = customers || []
  const commandLogsArray = commandLogs || []
  const equipmentArray = equipment || []
  const suppliersArray = suppliers || []
  const catalogueArray = catalogue || []

  // Enrich stock levels with catalogue data for comprehensive inventory view
  const enrichedInventoryArray = stockLevelsArray.map(stockLevel => {
    const catalogueItem = catalogueArray.find(cat => cat.id === stockLevel.catalogueItemId)
    if (catalogueItem) {
      return {
        ...stockLevel,
        description: catalogueItem.description,
        category: catalogueItem.category,
        subcategory: catalogueItem.subcategory,
        manufacturer: catalogueItem.manufacturer,
        unitCost: catalogueItem.unitCost,
        markup: catalogueItem.markup,
        sellPrice: catalogueItem.sellPrice,
        preferredSupplierName: catalogueItem.preferredSupplierName,
        minQuantity: catalogueItem.minQuantity,
        lastUpdated: stockLevel.updatedAt,
      }
    }
    return {
      ...stockLevel,
      lastUpdated: stockLevel.updatedAt,
    }
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-accent/20 text-accent">
              <Sparkle size={32} weight="fill" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight">
                Field Service Manager
              </h1>
              <p className="text-muted-foreground">
                AI-powered inventory & equipment tracking
              </p>
            </div>
            <Button
              variant={debugMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const newMode = !debugMode
                setDebugMode(newMode)
                toast.info(newMode ? 'Debug mode enabled' : 'Debug mode disabled')
              }}
              className="gap-2"
            >
              <Bug size={16} weight={debugMode ? 'fill' : 'regular'} />
              Debug {debugMode ? 'ON' : 'OFF'}
            </Button>
          </div>
        </header>

        <div className="mb-8">
          <CommandInput onSubmit={handleCommand} isProcessing={isProcessing} />
        </div>

        {isSpeechEnabled && (
          <div className="mb-8">
            <SpeechAssistant onCommandSubmit={handleCommand} isProcessing={isProcessing} />
          </div>
        )}

        {needsClarification && (
          <div className="mb-6">
            <AIClarification
              message={needsClarification.message}
              interpretation={needsClarification.interpretation}
            />
          </div>
        )}

        {pendingCommand && (
          <div className="mb-6">
            <MissingInfoPrompt
              action={pendingCommand.action}
              missingFields={pendingCommand.missingFields}
              partialParams={pendingCommand.context || pendingCommand.parameters}
              prompt={pendingCommand.prompt}
              options={pendingCommand.options}
              pendingAction={pendingCommand.pendingAction}
              onOptionSelect={(option) => handleCommand(option)}
              currentStep={pendingCommand.currentStep}
              totalSteps={pendingCommand.totalSteps}
              collectedData={pendingCommand.collectedData}
            />
          </div>
        )}

        {debugMode && latestDebugInfo && (
          <div className="mb-6">
            <AIDebugPanel debugInfo={latestDebugInfo} />
          </div>
        )}

        {latestResponse && (
          <div className="mb-6">
            <CommandResponse log={latestResponse} />
          </div>
        )}

        <Separator className="my-8" />

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          {/* Desktop: Horizontal tabs (md and above) */}
          <div className="hidden md:block">
            {/* Note: grid-cols-7 is hardcoded for 7 tabs. Update if adding more tabs. */}
            <TabsList className="grid w-full max-w-5xl grid-cols-7 mb-6">
              <TabsTrigger value="inventory" className="gap-2">
                <Package size={16} />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="catalogue" className="gap-2">
                <BookOpen size={16} />
                Catalogue
              </TabsTrigger>
              <TabsTrigger value="equipment" className="gap-2">
                <Gear size={16} />
                Equipment
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="gap-2">
                <User size={16} />
                Suppliers
              </TabsTrigger>
              <TabsTrigger value="customers" className="gap-2">
                <UserCircle size={16} />
                Customers
              </TabsTrigger>
              <TabsTrigger value="jobs" className="gap-2">
                <FileText size={16} />
                Jobs
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <ClockCounterClockwise size={16} />
                History
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Mobile: Dropdown select (below md) */}
          <div className="md:hidden mb-6">
            <Select value={selectedTab} onValueChange={setSelectedTab}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inventory">
                  <div className="flex items-center gap-2">
                    <Package size={16} />
                    Inventory
                  </div>
                </SelectItem>
                <SelectItem value="catalogue">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} />
                    Catalogue
                  </div>
                </SelectItem>
                <SelectItem value="equipment">
                  <div className="flex items-center gap-2">
                    <Gear size={16} />
                    Equipment
                  </div>
                </SelectItem>
                <SelectItem value="suppliers">
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    Suppliers
                  </div>
                </SelectItem>
                <SelectItem value="customers">
                  <div className="flex items-center gap-2">
                    <UserCircle size={16} />
                    Customers
                  </div>
                </SelectItem>
                <SelectItem value="jobs">
                  <div className="flex items-center gap-2">
                    <FileText size={16} />
                    Jobs
                  </div>
                </SelectItem>
                <SelectItem value="history">
                  <div className="flex items-center gap-2">
                    <ClockCounterClockwise size={16} />
                    History
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="inventory">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Inventory Overview</h2>
              <p className="text-sm text-muted-foreground">
                {enrichedInventoryArray.length} items across {new Set(enrichedInventoryArray.map(i => i.location)).size} locations
              </p>
            </div>
            <InventoryTable items={enrichedInventoryArray} onUpdate={handleStockUpdate} />
          </TabsContent>

          <TabsContent value="catalogue">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Product Catalogue</h2>
              <p className="text-sm text-muted-foreground">
                {catalogueArray.length} catalogue items
              </p>
            </div>
            <CatalogueView catalogue={catalogueArray} stockLevels={stockLevelsArray} suppliers={suppliersArray} />
          </TabsContent>

          <TabsContent value="equipment">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Customer Equipment</h2>
              <p className="text-sm text-muted-foreground">
                {equipmentArray.length} equipment items for {customersArray.length} customers
              </p>
            </div>
            <EquipmentView equipment={equipmentArray} onUpdate={handleEquipmentUpdate} />
          </TabsContent>

          <TabsContent value="suppliers">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Suppliers</h2>
              <p className="text-sm text-muted-foreground">
                {suppliersArray.length} suppliers registered
              </p>
            </div>
            <SuppliersView suppliers={suppliersArray} onUpdate={handleSupplierUpdate} />
          </TabsContent>

          <TabsContent value="customers">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Customers</h2>
              <p className="text-sm text-muted-foreground">
                {customersArray.length} customers registered
              </p>
            </div>
            <CustomersView customers={customersArray} onUpdate={handleCustomerUpdate} />
          </TabsContent>

          <TabsContent value="jobs">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Work Orders</h2>
              <p className="text-sm text-muted-foreground">
                {jobsArray.length} jobs for {customersArray.length} customers
              </p>
            </div>
            <JobsView jobs={jobsArray} onUpdate={handleJobUpdate} />
          </TabsContent>

          <TabsContent value="history">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Command History</h2>
              <p className="text-sm text-muted-foreground">
                {commandLogsArray.length} commands executed
              </p>
            </div>
            <CommandHistory logs={commandLogsArray} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
