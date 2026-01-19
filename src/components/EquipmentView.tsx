import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Equipment } from '@/lib/types'
import { Gear, PencilSimple, X, Check, User, MapPin, Wrench, Calendar } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigation } from '@/contexts/NavigationContext'

interface EquipmentCardProps {
  equipment: Equipment
  isExpanded?: boolean
  onExpand?: () => void
  onCollapse?: () => void
  onUpdate?: (id: string, updates: Partial<Equipment>) => void
}

function EquipmentCard({ equipment, isExpanded = false, onExpand, onCollapse, onUpdate }: EquipmentCardProps) {
  const { expandEntity } = useNavigation()
  const [isEditing, setIsEditing] = useState(false)
  const [showMobileModal, setShowMobileModal] = useState(false)

  // Edit state
  const [editedName, setEditedName] = useState(equipment.name)
  const [editedType, setEditedType] = useState(equipment.type)
  const [editedManufacturer, setEditedManufacturer] = useState(equipment.manufacturer || '')
  const [editedModel, setEditedModel] = useState(equipment.model || '')
  const [editedSerialNumber, setEditedSerialNumber] = useState(equipment.serialNumber || '')
  const [editedLocation, setEditedLocation] = useState(equipment.location || '')
  const [editedTechnicalNotes, setEditedTechnicalNotes] = useState(equipment.technicalNotes || '')

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(equipment.id, {
        name: editedName,
        type: editedType,
        manufacturer: editedManufacturer || undefined,
        model: editedModel || undefined,
        serialNumber: editedSerialNumber || undefined,
        location: editedLocation || undefined,
        technicalNotes: editedTechnicalNotes || undefined,
      })
    }
    setIsEditing(false)
    setShowMobileModal(false)
  }

  const handleCancel = () => {
    setEditedName(equipment.name)
    setEditedType(equipment.type)
    setEditedManufacturer(equipment.manufacturer || '')
    setEditedModel(equipment.model || '')
    setEditedSerialNumber(equipment.serialNumber || '')
    setEditedLocation(equipment.location || '')
    setEditedTechnicalNotes(equipment.technicalNotes || '')
    setIsEditing(false)
  }

  const handleCardClick = () => {
    if (!isExpanded && !isEditing && onExpand) {
      onExpand()
    }
  }

  const handleCustomerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    expandEntity(equipment.customerId, 'customer', 'customers')
  }
  const contractTypeColors: Record<string, string> = {
    none: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
    breakdown: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    maintenance: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    full_cover: 'bg-green-500/20 text-green-400 border-green-500/50',
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
            <Gear size={20} weight="duotone" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {equipment.name}
            </h3>
            <button
              onClick={handleCustomerClick}
              className="text-sm text-accent hover:underline cursor-pointer"
            >
              {equipment.customerName}
            </button>
            <p className="text-xs text-muted-foreground">{equipment.type}</p>
          </div>
        </div>
        {equipment.contractType && equipment.contractType !== 'none' && (
          <Badge className={contractTypeColors[equipment.contractType]}>
            {equipment.contractType.replace('_', ' ')}
          </Badge>
        )}
      </div>

      <div className="space-y-2 text-sm">
        {equipment.manufacturer && (
          <div>
            <span className="text-muted-foreground">Manufacturer:</span>{' '}
            <span className="font-medium">{equipment.manufacturer}</span>
          </div>
        )}
        {equipment.model && (
          <div>
            <span className="text-muted-foreground">Model:</span>{' '}
            <span className="font-medium">{equipment.model}</span>
          </div>
        )}
        {equipment.serialNumber && (
          <div>
            <span className="text-muted-foreground">Serial:</span>{' '}
            <span className="font-mono text-xs">{equipment.serialNumber}</span>
          </div>
        )}
        {equipment.location && (
          <div>
            <span className="text-muted-foreground">Location:</span>{' '}
            <span>{equipment.location}</span>
          </div>
        )}
      </div>

      {equipment.nextServiceDue && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Next Service Due: {new Date(equipment.nextServiceDue).toLocaleDateString()}
          </div>
        </div>
      )}
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
            <Gear size={28} weight="duotone" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg">
              {equipment.name}
            </h3>
            <button
              onClick={handleCustomerClick}
              className="text-sm text-accent hover:underline cursor-pointer"
            >
              {equipment.customerName}
            </button>
            <p className="text-sm text-muted-foreground">{equipment.type}</p>
            {equipment.contractType && equipment.contractType !== 'none' && (
              <Badge className={`${contractTypeColors[equipment.contractType]} mt-1`}>
                {equipment.contractType.replace('_', ' ')}
              </Badge>
            )}
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
            <div className="space-y-2">
              <Label>Equipment Name</Label>
              <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={editedType} onChange={(e) => setEditedType(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Input value={editedManufacturer} onChange={(e) => setEditedManufacturer(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={editedModel} onChange={(e) => setEditedModel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input value={editedSerialNumber} onChange={(e) => setEditedSerialNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={editedLocation} onChange={(e) => setEditedLocation(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Technical Notes</Label>
              <Input value={editedTechnicalNotes} onChange={(e) => setEditedTechnicalNotes(e.target.value)} />
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
              <span>{equipment.customerName}</span>
            </button>
          </div>
          {equipment.manufacturer && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Manufacturer</div>
              <div className="flex items-center gap-2">
                <Wrench size={18} className="text-accent" />
                <span>{equipment.manufacturer}</span>
              </div>
            </div>
          )}
          {equipment.model && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Model</div>
              <span>{equipment.model}</span>
            </div>
          )}
          {equipment.serialNumber && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Serial Number</div>
              <span className="font-mono">{equipment.serialNumber}</span>
            </div>
          )}
          {equipment.location && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Location</div>
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-accent" />
                <span>{equipment.location}</span>
              </div>
            </div>
          )}
          {equipment.installDate && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Install Date</div>
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-accent" />
                <span>{new Date(equipment.installDate).toLocaleDateString()}</span>
              </div>
            </div>
          )}
          {equipment.warrantyExpiry && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Warranty Expiry</div>
              <span>{new Date(equipment.warrantyExpiry).toLocaleDateString()}</span>
            </div>
          )}
          {equipment.lastServiceDate && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Last Service</div>
              <span>{new Date(equipment.lastServiceDate).toLocaleDateString()}</span>
            </div>
          )}
          {equipment.nextServiceDue && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Next Service Due</div>
              <span className="font-semibold text-accent">
                {new Date(equipment.nextServiceDue).toLocaleDateString()}
              </span>
            </div>
          )}
          {equipment.technicalNotes && (
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground mb-2">Technical Notes</div>
              <div className="text-sm border-l-2 border-accent pl-3">
                {equipment.technicalNotes}
              </div>
            </div>
          )}
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
            <Gear size={24} weight="duotone" className="text-primary" />
            <div>
              <div>{equipment.name}</div>
              <button
                onClick={handleCustomerClick}
                className="text-sm font-normal text-accent hover:underline cursor-pointer"
              >
                {equipment.customerName}
              </button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {isEditing ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Equipment Name</Label>
              <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={editedType} onChange={(e) => setEditedType(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Input value={editedManufacturer} onChange={(e) => setEditedManufacturer(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={editedModel} onChange={(e) => setEditedModel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input value={editedSerialNumber} onChange={(e) => setEditedSerialNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={editedLocation} onChange={(e) => setEditedLocation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Technical Notes</Label>
              <Input value={editedTechnicalNotes} onChange={(e) => setEditedTechnicalNotes(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Type</div>
              <div>{equipment.type}</div>
            </div>
            {equipment.contractType && equipment.contractType !== 'none' && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Contract</div>
                <Badge className={contractTypeColors[equipment.contractType]}>
                  {equipment.contractType.replace('_', ' ')}
                </Badge>
              </div>
            )}
            {equipment.manufacturer && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Manufacturer</div>
                <div>{equipment.manufacturer}</div>
              </div>
            )}
            {equipment.model && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Model</div>
                <div>{equipment.model}</div>
              </div>
            )}
            {equipment.serialNumber && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Serial Number</div>
                <div className="font-mono text-sm">{equipment.serialNumber}</div>
              </div>
            )}
            {equipment.location && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Location</div>
                <div>{equipment.location}</div>
              </div>
            )}
            {equipment.nextServiceDue && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Next Service Due</div>
                <div className="font-semibold text-accent">
                  {new Date(equipment.nextServiceDue).toLocaleDateString()}
                </div>
              </div>
            )}
            {equipment.technicalNotes && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Technical Notes</div>
                <div className="text-sm">{equipment.technicalNotes}</div>
              </div>
            )}
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

interface EquipmentViewProps {
  equipment: Equipment[]
  onUpdate?: (id: string, updates: Partial<Equipment>) => void
}

export function EquipmentView({ equipment, onUpdate }: EquipmentViewProps) {
  const { expandedEntityId, expandedEntityType } = useNavigation()
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null)

  if (equipment.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Gear size={48} className="mx-auto mb-4 opacity-50" />
        <p>No equipment tracked yet</p>
        <p className="text-sm mt-2">
          Try: "create equipment main boiler at ABC Manufacturing"
        </p>
      </div>
    )
  }

  const sortedEquipment = [...equipment].sort((a, b) => {
    // If one equipment is expanded, it should be first
    const expandedId = expandedEntityType === 'equipment' ? expandedEntityId : localExpandedId
    if (a.id === expandedId) return -1
    if (b.id === expandedId) return 1
    return a.customerName.localeCompare(b.customerName)
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence>
        {sortedEquipment.map((equip) => {
          const expandedId = expandedEntityType === 'equipment' ? expandedEntityId : localExpandedId
          const isExpanded = equip.id === expandedId
          return (
            <motion.div
              key={equip.id}
              layout
              className={isExpanded ? 'md:col-span-2 lg:col-span-3' : ''}
            >
              <EquipmentCard 
                equipment={equip} 
                isExpanded={isExpanded}
                onExpand={() => setLocalExpandedId(equip.id)}
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
