import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { useAuth } from '@clerk/clerk-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CommandInput } from '@/components/CommandInput'
import { CommandResponse, AIClarification } from '@/components/CommandResponse'
import { AIDebugPanel } from '@/components/AIDebugPanel'
import { MissingInfoPrompt } from '@/components/MissingInfoPrompt'
import { InventoryTable } from '@/components/InventoryView'
import { JobsView } from '@/components/JobsView'
import { CommandHistory } from '@/components/CommandHistory'
import { EquipmentView } from '@/components/EquipmentView'
import { SuppliersView } from '@/components/SuppliersView'
import { interpretCommand } from '@/lib/ai-commands'
import { executeCommand } from '@/lib/command-executor'
import { generateId } from '@/lib/ai-commands'
import { conversationManager } from '@/lib/conversation-manager'
import { getFlow, processStepInput, supplierExists, SUPPLIER_DETAILS_SUB_FLOW } from '@/lib/multi-step-flows'
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
  DebugInfo,
  PendingCommand
} from '@/lib/types'
import { Package, FileText, ClockCounterClockwise, Sparkle, Gear, User, Bug } from '@phosphor-icons/react'

export function Dashboard() {
  const { userId } = useAuth()

  // User-scoped KV keys - all data is isolated per user
  // Use actual userId when available, hooks require stable keys
  const userPrefix = userId || 'temp'
  const [inventory, setInventory] = useKV<InventoryItem[]>(`${userPrefix}-inventory`, [])
  const [locations, setLocations] = useKV<Location[]>(`${userPrefix}-locations`, [])
  const [customers, setCustomers] = useKV<Customer[]>(`${userPrefix}-customers`, [])
  const [jobs, setJobs] = useKV<Job[]>(`${userPrefix}-jobs`, [])
  const [commandLogs, setCommandLogs] = useKV<CommandLog[]>(`${userPrefix}-command-logs`, [])
  const [catalogue, setCatalogue] = useKV<CatalogueItem[]>(`${userPrefix}-catalogue`, [])
  const [stockLevels, setStockLevels] = useKV<StockLevel[]>(`${userPrefix}-stock-levels`, [])
  const [suppliers, setSuppliers] = useKV<Supplier[]>(`${userPrefix}-suppliers`, [])
  const [equipment, setEquipment] = useKV<Equipment[]>(`${userPrefix}-equipment`, [])
  const [installedParts, setInstalledParts] = useKV<InstalledPart[]>(`${userPrefix}-installed-parts`, [])
  const [purchaseOrders, setPurchaseOrders] = useKV<PurchaseOrder[]>(`${userPrefix}-purchase-orders`, [])

  const [isProcessing, setIsProcessing] = useState(false)
  const [latestResponse, setLatestResponse] = useState<CommandLog | null>(null)
  const [needsClarification, setNeedsClarification] = useState<{
    message: string
    interpretation: string
  } | null>(null)
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const [latestDebugInfo, setLatestDebugInfo] = useState<DebugInfo | null>(null)

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
      
      let actionToExecute: string
      let paramsToExecute: Record<string, unknown>
      
      if (existingPending) {
        // User is responding to a pending command
        // Check if they're confirming to add to catalogue
        const commandLower = command.toLowerCase().trim()
        
        // IMPORTANT: Check for supplier confirmation FIRST, before checking CREATE_CATALOGUE_ITEM_AND_ADD_STOCK
        // This prevents "Yes/No" responses from being captured as supplier names
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
            
            setPendingCommand(updatedPending)
            setIsProcessing(false)
            return
          }
        } else if (existingPending.pendingAction === 'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK') {
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
                
                setSuppliers((current) => [...current, newSupplier])
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
              if (supplierName && !result.skipped && !supplierExists(supplierName, suppliers)) {
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
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
              // If nextStep > totalSteps, fall through to completion
            }
            
            // All steps completed (or skipped), execute the action
            if (existingPending.currentStep >= existingPending.totalSteps || 
                existingPending.currentStep < existingPending.totalSteps) {
              // FIX 4: Properly merge all data sources on final execution
              actionToExecute = 'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK'
              paramsToExecute = {
                // Original command parameters (item, quantity, location)
                item: existingPending.context?.item || existingPending.context?.suggestedName || existingPending.context?.partNumber,
                partNumber: existingPending.context?.partNumber || existingPending.context?.item,
                name: existingPending.context?.name || existingPending.context?.item,
                quantity: existingPending.context?.quantity,
                location: existingPending.context?.location,
                // Collected data from multi-step flow
                collectedData,
                currentStep: existingPending.currentStep,
                totalSteps: existingPending.totalSteps,
                // Ensure we don't lose any context
                ...existingPending.context
              }
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
            }
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
                  totalSteps: flow.steps.length
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
                
                setSuppliers((current) => [...current, newSupplier])
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
              
              if (supplierName && !result.skipped && !supplierExists(supplierName, suppliers)) {
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
                
                setPendingCommand(updatedPending)
                setIsProcessing(false)
                return
              }
              // If nextStep > totalSteps, fall through to completion
            }
            
            // All steps completed (or skipped), execute the action
            if (existingPending.currentStep >= existingPending.totalSteps || 
                existingPending.currentStep < existingPending.totalSteps) {
              // FIX 4: Properly merge all data sources on final execution
              actionToExecute = 'CREATE_CATALOGUE_ITEM'
              paramsToExecute = {
                // Original command parameters
                partNumber: existingPending.context?.partNumber || existingPending.context?.item,
                name: existingPending.context?.name || existingPending.context?.item,
                // Collected data from multi-step flow (spread first so context can override)
                ...collectedData,
                // Calculate sell price if both unitCost and markup are provided
                sellPrice: collectedData.unitCost && collectedData.markup 
                  ? Number(collectedData.unitCost) * (1 + Number(collectedData.markup) / 100)
                  : undefined,
                // Ensure we don't lose any context
                ...existingPending.context
              }
              conversationManager.clearPendingCommand()
              setPendingCommand(null)
            }
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
                  // Calculate sell price if both unitCost and markup are provided
                  sellPrice: alreadyKnown.unitCost && alreadyKnown.markup 
                    ? Number(alreadyKnown.unitCost) * (1 + Number(alreadyKnown.markup) / 100)
                    : undefined
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
        } else {
          // Try to extract missing parameters from the user's response
          const interpretation = await interpretCommand(command)
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
        command // Pass original command for fallback parsing
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

        <Tabs defaultValue="inventory" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-5 mb-6">
            <TabsTrigger value="inventory" className="gap-2">
              <Package size={16} />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="equipment" className="gap-2">
              <Gear size={16} />
              Equipment
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-2">
              <User size={16} />
              Suppliers
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

          <TabsContent value="inventory">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Inventory Overview</h2>
              <p className="text-sm text-muted-foreground">
                {stockLevelsArray.length} items across {new Set(stockLevelsArray.map(i => i.location)).size} locations
              </p>
            </div>
            <InventoryTable items={stockLevelsArray} />
          </TabsContent>

          <TabsContent value="equipment">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Customer Equipment</h2>
              <p className="text-sm text-muted-foreground">
                {equipmentArray.length} equipment items for {customersArray.length} customers
              </p>
            </div>
            <EquipmentView equipment={equipmentArray} />
          </TabsContent>

          <TabsContent value="suppliers">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Suppliers</h2>
              <p className="text-sm text-muted-foreground">
                {suppliersArray.length} suppliers registered
              </p>
            </div>
            <SuppliersView suppliers={suppliersArray} />
          </TabsContent>

          <TabsContent value="jobs">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Work Orders</h2>
              <p className="text-sm text-muted-foreground">
                {jobsArray.length} jobs for {customersArray.length} customers
              </p>
            </div>
            <JobsView jobs={jobsArray} />
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
