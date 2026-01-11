import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
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
  // Legacy state
  const [inventory, setInventory] = useKV<InventoryItem[]>('inventory', [])
  const [locations, setLocations] = useKV<Location[]>('locations', [])
  const [customers, setCustomers] = useKV<Customer[]>('customers', [])
  const [jobs, setJobs] = useKV<Job[]>('jobs', [])
  const [commandLogs, setCommandLogs] = useKV<CommandLog[]>('command-logs', [])
  
  // New comprehensive state
  const [catalogue, setCatalogue] = useKV<CatalogueItem[]>('catalogue', [])
  const [stockLevels, setStockLevels] = useKV<StockLevel[]>('stock-levels', [])
  const [suppliers, setSuppliers] = useKV<Supplier[]>('suppliers', [])
  const [equipment, setEquipment] = useKV<Equipment[]>('equipment', [])
  const [installedParts, setInstalledParts] = useKV<InstalledPart[]>('installed-parts', [])
  const [purchaseOrders, setPurchaseOrders] = useKV<PurchaseOrder[]>('purchase-orders', [])

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
          if (commandLower === 'yes' || commandLower === 'add it' || commandLower.includes('yes')) {
            // User confirmed, execute the pending action
            actionToExecute = 'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK'
            paramsToExecute = existingPending.context || {}
            conversationManager.clearPendingCommand()
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
        } else {
          // Try to extract missing parameters from the user's response
          const interpretation = await interpretCommand(command, conversationManager.getContext())
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
        
        setPendingCommand(null) // Clear UI pending command
      } else {
        // Normal new command flow
        const interpretation = await interpretCommand(command, conversationManager.getContext())

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
      }

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
      if (result.needsInput && result.missingFields && result.prompt) {
        const pending = conversationManager.createPendingCommand(
          actionToExecute,
          paramsToExecute,
          result.missingFields,
          result.prompt
        )
        pending.pendingAction = result.pendingAction
        pending.context = result.context
        setPendingCommand(pending)
        
        toast.info('Need more information')
        setIsProcessing(false)
        return
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
                {inventoryArray.length} items across {new Set(inventoryArray.map(i => i.location)).size} locations
              </p>
            </div>
            <InventoryTable items={inventoryArray} />
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
