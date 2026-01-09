import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { CommandInput } from '@/components/CommandInput'
import { CommandResponse, AIClarification } from '@/components/CommandResponse'
import { InventoryTable } from '@/components/InventoryView'
import { JobsView } from '@/components/JobsView'
import { CommandHistory } from '@/components/CommandHistory'
import { interpretCommand } from '@/lib/ai-commands'
import { executeCommand } from '@/lib/command-executor'
import { generateId } from '@/lib/ai-commands'
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
  PurchaseOrder
} from '@/lib/types'
import { Package, FileText, ClockCounterClockwise, Sparkle } from '@phosphor-icons/react'

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

  const handleCommand = async (command: string) => {
    setIsProcessing(true)
    setNeedsClarification(null)
    setLatestResponse(null)

    try {
      const interpretation = await interpretCommand(command)

      if (interpretation.confidence < 0.7 && interpretation.clarificationNeeded) {
        setNeedsClarification({
          message: interpretation.clarificationNeeded,
          interpretation: interpretation.interpretation
        })
        setIsProcessing(false)
        return
      }

      const result = await executeCommand(
        interpretation.action,
        interpretation.parameters,
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
        setPurchaseOrders
      )

      const log: CommandLog = {
        id: generateId(),
        command,
        action: interpretation.action,
        timestamp: Date.now(),
        success: result.success,
        result: result.message,
        data: result.data
      }

      setCommandLogs((current) => [...(current || []), log])
      setLatestResponse(log)

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-accent/20 text-accent">
              <Sparkle size={32} weight="fill" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                AI Stock Manager
              </h1>
              <p className="text-muted-foreground">
                Natural language inventory control
              </p>
            </div>
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

        {latestResponse && (
          <div className="mb-6">
            <CommandResponse log={latestResponse} />
          </div>
        )}

        <Separator className="my-8" />

        <Tabs defaultValue="inventory" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
            <TabsTrigger value="inventory" className="gap-2">
              <Package size={16} />
              Inventory
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

          <TabsContent value="jobs">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Jobs & Parts Lists</h2>
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
