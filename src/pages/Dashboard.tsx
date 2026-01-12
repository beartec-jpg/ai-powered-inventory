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
import { getFlow, processStepInput } from '@/lib/multi-step-flows'
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
  // We use fallback empty string for userId to satisfy hook rules, but check below
  const [inventory, setInventory] = useKV<InventoryItem[]>(`${userId || ''}-inventory`, [])
  const [locations, setLocations] = useKV<Location[]>(`${userId || ''}-locations`, [])
  const [customers, setCustomers] = useKV<Customer[]>(`${userId || ''}-customers`, [])
  const [jobs, setJobs] = useKV<Job[]>(`${userId || ''}-jobs`, [])
  const [commandLogs, setCommandLogs] = useKV<CommandLog[]>(`${userId || ''}-command-logs`, [])
  const [catalogue, setCatalogue] = useKV<CatalogueItem[]>(`${userId || ''}-catalogue`, [])
  const [stockLevels, setStockLevels] = useKV<StockLevel[]>(`${userId || ''}-stock-levels`, [])
  const [suppliers, setSuppliers] = useKV<Supplier[]>(`${userId || ''}-suppliers`, [])
  const [equipment, setEquipment] = useKV<Equipment[]>(`${userId || ''}-equipment`, [])
  const [installedParts, setInstalledParts] = useKV<InstalledPart[]>(`${userId || ''}-installed-parts`, [])
  const [purchaseOrders, setPurchaseOrders] = useKV<PurchaseOrder[]>(`${userId || ''}-purchase-orders`, [])

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
        
        if (existingPending.pendingAction === 'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK') {
          // Check if this is a multi-step flow in progress
          if (existingPending.currentStep !== undefined && existingPending.totalSteps !== undefined) {
            // Multi-step flow in progress
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
            
            // Move to next step or complete
            if (existingPending.currentStep < existingPending.totalSteps) {
              // More steps to go
              const nextStep = existingPending.currentStep + 1
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
            } else {
              // All steps completed, execute the action
              actionToExecute = 'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK'
              paramsToExecute = {
                ...existingPending.context,
                collectedData,
                currentStep: existingPending.currentStep,
                totalSteps: existingPending.totalSteps
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
              const firstStep = flow.steps[0]
              
              const pending = conversationManager.createPendingCommand(
                'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK',
                existingPending.parameters,
                [],
                firstStep.prompt(itemName),
                'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK',
                existingPending.context,
                ['Skip'], // Always offer skip option
                1, // currentStep
                flow.steps.length, // totalSteps
                {} // collectedData
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
              // Ambiguous response, re-prompt
              toast.warning('Please reply with "yes" to add the item or "no" to cancel')
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
