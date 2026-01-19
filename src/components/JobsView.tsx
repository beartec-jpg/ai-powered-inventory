import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Job } from '@/lib/types'
import { FileText, PencilSimple, X, Check, User, Gear, Calendar, Package } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigation } from '@/contexts/NavigationContext'

interface JobCardProps {
  job: Job
  isExpanded?: boolean
  onExpand?: () => void
  onCollapse?: () => void
  onUpdate?: (id: string, updates: Partial<Job>) => void
}

export function JobCard({ job, isExpanded = false, onExpand, onCollapse, onUpdate }: JobCardProps) {
  const { expandEntity } = useNavigation()
  const [isEditing, setIsEditing] = useState(false)
  const [showMobileModal, setShowMobileModal] = useState(false)

  // Edit state
  const [editedDescription, setEditedDescription] = useState(job.description || '')
  const [editedReportedFault, setEditedReportedFault] = useState(job.reportedFault || '')
  const [editedWorkRequired, setEditedWorkRequired] = useState(job.workRequired || '')
  const [editedWorkCarriedOut, setEditedWorkCarriedOut] = useState(job.workCarriedOut || '')
  const [editedFindings, setEditedFindings] = useState(job.findings || '')
  const [editedNotes, setEditedNotes] = useState(job.notes || '')

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(job.id, {
        description: editedDescription || undefined,
        reportedFault: editedReportedFault || undefined,
        workRequired: editedWorkRequired || undefined,
        workCarriedOut: editedWorkCarriedOut || undefined,
        findings: editedFindings || undefined,
        notes: editedNotes || undefined,
      })
    }
    setIsEditing(false)
    setShowMobileModal(false)
  }

  const handleCancel = () => {
    setEditedDescription(job.description || '')
    setEditedReportedFault(job.reportedFault || '')
    setEditedWorkRequired(job.workRequired || '')
    setEditedWorkCarriedOut(job.workCarriedOut || '')
    setEditedFindings(job.findings || '')
    setEditedNotes(job.notes || '')
    setIsEditing(false)
  }

  const handleCardClick = () => {
    if (!isExpanded && !isEditing && onExpand) {
      onExpand()
    }
  }

  const handleCustomerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    expandEntity(job.customerId, 'customer', 'customers')
  }

  const handleEquipmentClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (job.equipmentId) {
      expandEntity(job.equipmentId, 'equipment', 'equipment')
    }
  }
  const statusColors: Record<string, string> = {
    quote: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
    scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    dispatched: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    in_progress: 'bg-accent/20 text-accent border-accent/50',
    on_hold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    completed: 'bg-green-500/20 text-green-400 border-green-500/50',
    invoiced: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    cancelled: 'bg-destructive/20 text-destructive border-destructive/50',
  }

  // Condensed view
  const condensedView = (
    <Card 
      className={`p-4 transition-all ${
        isExpanded 
          ? 'border-accent shadow-xl shadow-accent/20' 
          : 'hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 cursor-pointer'
      }`}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <FileText size={20} weight="duotone" />
          </div>
          <div>
            <h3 className="font-mono font-semibold text-foreground">
              Job #{job.jobNumber}
            </h3>
            <button
              onClick={handleCustomerClick}
              className="text-sm text-accent hover:underline cursor-pointer"
            >
              {job.customerName}
            </button>
            {job.equipmentName && (
              <button
                onClick={handleEquipmentClick}
                className="text-xs text-muted-foreground hover:text-accent hover:underline cursor-pointer block"
              >
                Equipment: {job.equipmentName}
              </button>
            )}
          </div>
        </div>
        <Badge className={statusColors[job.status] || statusColors.quote}>
          {job.status.replace('_', ' ')}
        </Badge>
      </div>

      {job.description && (
        <p className="text-sm text-muted-foreground mb-2">{job.description}</p>
      )}

      <div className="mt-4 pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
          Parts Used ({job.partsUsed.length} items)
        </div>
        {job.partsUsed.length > 0 ? (
          <div className="space-y-1">
            {job.partsUsed.slice(0, 3).map((part) => (
              <div key={part.id} className="flex justify-between items-center text-sm">
                <span className="font-mono">{part.partNumber}</span>
                <span className="text-muted-foreground">×{part.quantity}</span>
              </div>
            ))}
            {job.partsUsed.length > 3 && (
              <div className="text-xs text-muted-foreground italic">
                +{job.partsUsed.length - 3} more items
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic">No parts recorded yet</div>
        )}
        <div className="text-xs text-muted-foreground mt-3">
          Created {new Date(job.createdAt).toLocaleDateString()}
        </div>
      </div>
    </Card>
  )

  // Expanded view
  const expandedView = (
    <Card 
      className="p-6 border-accent shadow-2xl shadow-accent/20 bg-card"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <FileText size={28} weight="duotone" />
          </div>
          <div>
            <h3 className="font-mono font-semibold text-foreground text-lg">
              Job #{job.jobNumber}
            </h3>
            <button
              onClick={handleCustomerClick}
              className="text-sm text-accent hover:underline cursor-pointer"
            >
              {job.customerName}
            </button>
            <Badge className={`${statusColors[job.status] || statusColors.quote} mt-1`}>
              {job.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing && onUpdate && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="gap-2"
            >
              <PencilSimple size={16} />
              Edit
            </Button>
          )}
          {onCollapse && (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={onCollapse}
            >
              <X size={20} />
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Input value={editedDescription} onChange={(e) => setEditedDescription(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Reported Fault</Label>
              <Input value={editedReportedFault} onChange={(e) => setEditedReportedFault(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Work Required</Label>
              <Input value={editedWorkRequired} onChange={(e) => setEditedWorkRequired(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Work Carried Out</Label>
              <Input value={editedWorkCarriedOut} onChange={(e) => setEditedWorkCarriedOut(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Findings</Label>
              <Input value={editedFindings} onChange={(e) => setEditedFindings(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Input value={editedNotes} onChange={(e) => setEditedNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} className="gap-2">
              <Check size={16} />
              Save
            </Button>
            <Button onClick={handleCancel} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Customer</div>
            <button
              onClick={handleCustomerClick}
              className="flex items-center gap-2 text-accent hover:underline cursor-pointer"
            >
              <User size={18} />
              <span>{job.customerName}</span>
            </button>
          </div>
          {job.equipmentName && job.equipmentId && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Equipment</div>
              <button
                onClick={handleEquipmentClick}
                className="flex items-center gap-2 text-accent hover:underline cursor-pointer"
              >
                <Gear size={18} />
                <span>{job.equipmentName}</span>
              </button>
            </div>
          )}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Type</div>
            <span className="capitalize">{job.type}</span>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Priority</div>
            <span className="capitalize">{job.priority}</span>
          </div>
          {job.description && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-1">Description</div>
              <div className="text-sm">{job.description}</div>
            </div>
          )}
          {job.reportedFault && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-1">Reported Fault</div>
              <div className="text-sm">{job.reportedFault}</div>
            </div>
          )}
          {job.workRequired && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-1">Work Required</div>
              <div className="text-sm">{job.workRequired}</div>
            </div>
          )}
          {job.workCarriedOut && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-1">Work Carried Out</div>
              <div className="text-sm border-l-2 border-accent pl-3">{job.workCarriedOut}</div>
            </div>
          )}
          {job.findings && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-1">Findings</div>
              <div className="text-sm">{job.findings}</div>
            </div>
          )}
          {job.scheduledDate && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Scheduled Date</div>
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-accent" />
                <span>{new Date(job.scheduledDate).toLocaleDateString()}</span>
              </div>
            </div>
          )}
          {job.completedAt && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Completed</div>
              <span>{new Date(job.completedAt).toLocaleDateString()}</span>
            </div>
          )}
          <div className="md:col-span-2">
            <div className="text-sm text-muted-foreground mb-2">Parts Used ({job.partsUsed.length})</div>
            {job.partsUsed.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {job.partsUsed.map((part) => (
                  <div key={part.id} className="flex items-center justify-between border border-border rounded p-2">
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-accent" />
                      <span className="font-mono text-sm">{part.partNumber}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">×{part.quantity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic">No parts recorded yet</div>
            )}
          </div>
          {job.notes && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-2">Notes</div>
              <div className="text-sm border-l-2 border-accent pl-3">
                {job.notes}
              </div>
            </div>
          )}
          <div className="md:col-span-2">
            <div className="text-xs text-muted-foreground">
              Created {new Date(job.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}
    </Card>
  )

  // Mobile modal
  const mobileModal = (
    <Dialog open={showMobileModal} onOpenChange={setShowMobileModal}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText size={24} weight="duotone" className="text-primary" />
            <div>
              <div className="font-mono">Job #{job.jobNumber}</div>
              <button
                onClick={handleCustomerClick}
                className="text-sm font-normal text-accent hover:underline cursor-pointer"
              >
                {job.customerName}
              </button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {isEditing ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editedDescription} onChange={(e) => setEditedDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reported Fault</Label>
              <Input value={editedReportedFault} onChange={(e) => setEditedReportedFault(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Work Required</Label>
              <Input value={editedWorkRequired} onChange={(e) => setEditedWorkRequired(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Work Carried Out</Label>
              <Input value={editedWorkCarriedOut} onChange={(e) => setEditedWorkCarriedOut(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Findings</Label>
              <Input value={editedFindings} onChange={(e) => setEditedFindings(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={editedNotes} onChange={(e) => setEditedNotes(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Badge className={statusColors[job.status] || statusColors.quote}>
              {job.status.replace('_', ' ')}
            </Badge>
            {job.equipmentName && job.equipmentId && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Equipment</div>
                <button
                  onClick={handleEquipmentClick}
                  className="text-accent hover:underline cursor-pointer"
                >
                  {job.equipmentName}
                </button>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground mb-1">Type</div>
              <div className="capitalize">{job.type}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Priority</div>
              <div className="capitalize">{job.priority}</div>
            </div>
            {job.description && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Description</div>
                <div className="text-sm">{job.description}</div>
              </div>
            )}
            {job.reportedFault && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Reported Fault</div>
                <div className="text-sm">{job.reportedFault}</div>
              </div>
            )}
            {job.partsUsed.length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">Parts Used ({job.partsUsed.length})</div>
                <div className="space-y-1">
                  {job.partsUsed.map((part) => (
                    <div key={part.id} className="flex justify-between text-sm border border-border rounded p-2">
                      <span className="font-mono">{part.partNumber}</span>
                      <span className="text-muted-foreground">×{part.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {job.notes && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Notes</div>
                <div className="text-sm">{job.notes}</div>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Created {new Date(job.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}

        <DialogFooter>
          {isEditing ? (
            <>
              <Button onClick={handleSave} className="gap-2">
                <Check size={16} />
                Save
              </Button>
              <Button onClick={handleCancel} variant="outline">
                Cancel
              </Button>
            </>
          ) : (
            <>
              {onUpdate && (
                <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2">
                  <PencilSimple size={16} />
                  Edit
                </Button>
              )}
              <Button onClick={() => setShowMobileModal(false)} variant="ghost">
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <>
      {/* Desktop: inline expansion */}
      <motion.div
        className="hidden md:block"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        layout
      >
        {isExpanded ? expandedView : condensedView}
      </motion.div>

      {/* Mobile: condensed card that opens modal */}
      <motion.div
        className="md:hidden"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={() => !isExpanded && setShowMobileModal(true)}
      >
        {condensedView}
      </motion.div>

      {/* Mobile modal */}
      {mobileModal}
    </>
  )
}

interface JobsViewProps {
  jobs: Job[]
  onUpdate?: (id: string, updates: Partial<Job>) => void
}

export function JobsView({ jobs, onUpdate }: JobsViewProps) {
  const { expandedEntityId, expandedEntityType } = useNavigation()
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null)

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText size={48} className="mx-auto mb-4 opacity-50" />
        <p>No jobs created yet</p>
        <p className="text-sm mt-2">Try: "create job for ABC Manufacturing boiler service"</p>
      </div>
    )
  }

  const sortedJobs = [...jobs].sort((a, b) => {
    // If one job is expanded, it should be first
    const expandedId = expandedEntityType === 'job' ? expandedEntityId : localExpandedId
    if (a.id === expandedId) return -1
    if (b.id === expandedId) return 1
    return b.createdAt - a.createdAt
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence>
        {sortedJobs.map((job) => {
          const expandedId = expandedEntityType === 'job' ? expandedEntityId : localExpandedId
          const isExpanded = job.id === expandedId
          return (
            <motion.div
              key={job.id}
              layout
              className={isExpanded ? 'md:col-span-2 lg:col-span-3' : ''}
            >
              <JobCard 
                job={job} 
                isExpanded={isExpanded}
                onExpand={() => setLocalExpandedId(job.id)}
                onCollapse={() => setLocalExpandedId(null)}
                onUpdate={onUpdate}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
