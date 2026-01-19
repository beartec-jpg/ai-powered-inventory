import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { InventoryItem, StockLevel } from '@/lib/types'
import { Package, MapPin, PencilSimple, X, Check } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface InventoryCardProps {
  item: InventoryItem | StockLevel
  isExpanded: boolean
  onExpand: () => void
  onCollapse: () => void
  onUpdate?: (id: string, updates: Partial<InventoryItem | StockLevel>) => void
}

export function InventoryCard({ item, isExpanded, onExpand, onCollapse, onUpdate }: InventoryCardProps) {
  // Support both InventoryItem (minQuantity) and StockLevel (no minQuantity)
  const minQuantity = 'minQuantity' in item ? item.minQuantity : undefined
  const isLowStock = minQuantity ? item.quantity < minQuantity : item.quantity < 10
  const isOutOfStock = item.quantity === 0

  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(item.name)
  const [editedLocation, setEditedLocation] = useState(item.location)
  const [editedQuantity, setEditedQuantity] = useState(item.quantity.toString())
  const [showMobileModal, setShowMobileModal] = useState(false)

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(item.id, {
        name: editedName,
        location: editedLocation,
        quantity: parseInt(editedQuantity, 10) || 0,
      })
    }
    setIsEditing(false)
    setShowMobileModal(false)
  }

  const handleCancel = () => {
    setEditedName(item.name)
    setEditedLocation(item.location)
    setEditedQuantity(item.quantity.toString())
    setIsEditing(false)
  }

  const handleCardClick = () => {
    if (!isExpanded && !isEditing) {
      onExpand()
    }
  }

  // On mobile, we'll show a modal when clicking the card
  const handleMobileCardClick = () => {
    if (!isExpanded && !isEditing) {
      setShowMobileModal(true)
    }
  }

  // Condensed card view
  const condensedView = (
    <Card 
      className={`p-4 transition-all cursor-pointer ${
        isExpanded 
          ? 'border-accent shadow-xl shadow-accent/20' 
          : 'hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10'
      }`}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Package size={20} weight="duotone" />
          </div>
          <div>
            <h3 className="font-mono font-semibold text-foreground">
              {item.partNumber}
            </h3>
            <p className="text-sm text-muted-foreground">{item.name}</p>
          </div>
        </div>
        <Badge 
          variant={isOutOfStock ? 'destructive' : isLowStock ? 'outline' : 'secondary'}
          className={isLowStock && !isOutOfStock ? 'border-yellow-500 text-yellow-500' : ''}
        >
          {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
        </Badge>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin size={16} />
          <span className="text-sm font-mono">{item.location}</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-accent">
            {item.quantity}
          </div>
          <div className="text-xs text-muted-foreground">units</div>
        </div>
      </div>
    </Card>
  )

  // Expanded card view with edit functionality
  const expandedView = (
    <Card 
      className="p-6 border-accent shadow-2xl shadow-accent/20 bg-card"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <Package size={28} weight="duotone" />
          </div>
          <div>
            <h3 className="font-mono font-semibold text-foreground text-lg">
              {item.partNumber}
            </h3>
            <p className="text-muted-foreground">{item.name}</p>
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
          <Button 
            size="sm" 
            variant="ghost"
            onClick={onCollapse}
          >
            <X size={20} />
          </Button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Item Name</Label>
            <Input
              id="edit-name"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder="Item name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-location">Location</Label>
            <Input
              id="edit-location"
              value={editedLocation}
              onChange={(e) => setEditedLocation(e.target.value)}
              placeholder="Location"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-quantity">Quantity</Label>
            <Input
              id="edit-quantity"
              type="number"
              value={editedQuantity}
              onChange={(e) => setEditedQuantity(e.target.value)}
              placeholder="Quantity"
            />
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
            <div className="text-sm text-muted-foreground mb-1">Location</div>
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-accent" />
              <span className="font-mono font-semibold">{item.location}</span>
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Quantity</div>
            <div className="text-3xl font-mono font-bold text-accent">
              {item.quantity} <span className="text-sm text-muted-foreground">units</span>
            </div>
          </div>
          {minQuantity && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Min Quantity</div>
              <div className="font-mono">{minQuantity} units</div>
            </div>
          )}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Status</div>
            <Badge 
              variant={isOutOfStock ? 'destructive' : isLowStock ? 'outline' : 'secondary'}
              className={isLowStock && !isOutOfStock ? 'border-yellow-500 text-yellow-500' : ''}
            >
              {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
            </Badge>
          </div>
        </div>
      )}
    </Card>
  )

  // Mobile modal view
  const mobileModal = (
    <Dialog open={showMobileModal} onOpenChange={setShowMobileModal}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package size={24} weight="duotone" className="text-primary" />
            <div>
              <div className="font-mono">{item.partNumber}</div>
              <div className="text-sm font-normal text-muted-foreground">{item.name}</div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {isEditing ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mobile-edit-name">Item Name</Label>
              <Input
                id="mobile-edit-name"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Item name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-edit-location">Location</Label>
              <Input
                id="mobile-edit-location"
                value={editedLocation}
                onChange={(e) => setEditedLocation(e.target.value)}
                placeholder="Location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-edit-quantity">Quantity</Label>
              <Input
                id="mobile-edit-quantity"
                type="number"
                value={editedQuantity}
                onChange={(e) => setEditedQuantity(e.target.value)}
                placeholder="Quantity"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Location</div>
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-accent" />
                <span className="font-mono font-semibold">{item.location}</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Quantity</div>
              <div className="text-3xl font-mono font-bold text-accent">
                {item.quantity} <span className="text-sm text-muted-foreground">units</span>
              </div>
            </div>
            {minQuantity && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Min Quantity</div>
                <div className="font-mono">{minQuantity} units</div>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <Badge 
                variant={isOutOfStock ? 'destructive' : isLowStock ? 'outline' : 'secondary'}
                className={isLowStock && !isOutOfStock ? 'border-yellow-500 text-yellow-500' : ''}
              >
                {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
              </Badge>
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
        onClick={handleMobileCardClick}
      >
        {condensedView}
      </motion.div>

      {/* Mobile modal */}
      {mobileModal}
    </>
  )
}

interface InventoryTableProps {
  items: (InventoryItem | StockLevel)[]
  onUpdate?: (id: string, updates: Partial<InventoryItem | StockLevel>) => void
}

export function InventoryTable({ items, onUpdate }: InventoryTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package size={48} className="mx-auto mb-4 opacity-50" />
        <p>No inventory items yet</p>
        <p className="text-sm mt-2">Try: "add 100 units of widget-A to warehouse-1"</p>
      </div>
    )
  }

  // Support both lastUpdated (InventoryItem) and updatedAt (StockLevel)
  const sortedItems = [...items].sort((a, b) => {
    // If one item is expanded, it should be first
    if (a.id === expandedId) return -1
    if (b.id === expandedId) return 1
    
    const aTime = 'lastUpdated' in a ? a.lastUpdated : a.updatedAt
    const bTime = 'lastUpdated' in b ? b.lastUpdated : b.updatedAt
    return bTime - aTime
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence>
        {sortedItems.map((item) => {
          const isExpanded = item.id === expandedId
          return (
            <motion.div
              key={item.id}
              layout
              className={isExpanded ? 'md:col-span-2 lg:col-span-3' : ''}
            >
              <InventoryCard
                item={item}
                isExpanded={isExpanded}
                onExpand={() => setExpandedId(item.id)}
                onCollapse={() => setExpandedId(null)}
                onUpdate={onUpdate}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
