import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { CatalogueItem, StockLevel, Supplier } from '@/lib/types'
import { Package, Tag, MapPin, CurrencyDollar, PencilSimple, X, Check, Factory, User } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useNavigation } from '@/contexts/NavigationContext'

interface CatalogueItemCardProps {
  item: CatalogueItem
  stockLevels?: StockLevel[]
  suppliers?: Supplier[]
  isExpanded?: boolean
  onExpand?: () => void
  onCollapse?: () => void
  onUpdate?: (id: string, updates: Partial<CatalogueItem>) => void
}

export function CatalogueItemCard({ 
  item, 
  stockLevels = [], 
  suppliers = [],
  isExpanded = false,
  onExpand,
  onCollapse,
  onUpdate
}: CatalogueItemCardProps) {
  const { expandEntity } = useNavigation()
  const [isEditing, setIsEditing] = useState(false)
  const [showMobileModal, setShowMobileModal] = useState(false)
  
  // Edit state
  const [editedName, setEditedName] = useState(item.name)
  const [editedDescription, setEditedDescription] = useState(item.description || '')
  const [editedCategory, setEditedCategory] = useState(item.category || '')
  const [editedUnitCost, setEditedUnitCost] = useState(item.unitCost?.toString() || '')
  const [editedMarkup, setEditedMarkup] = useState(item.markup?.toString() || '')
  const [editedMinQuantity, setEditedMinQuantity] = useState(item.minQuantity?.toString() || '')
  
  // Calculate total stock from provided stock levels (already filtered by parent)
  const totalStock = stockLevels.reduce((sum, s) => sum + s.quantity, 0)
  
  const hasStock = totalStock > 0
  const isLowStock = item.minQuantity ? totalStock < item.minQuantity : false

  // Find supplier by ID or name
  const supplier = suppliers.find(s => 
    s.id === item.preferredSupplierId || s.name === item.preferredSupplierName
  )
  
  const handleSave = () => {
    if (onUpdate) {
      const unitCost = editedUnitCost ? parseFloat(editedUnitCost) : undefined
      const markup = editedMarkup ? parseFloat(editedMarkup) : undefined
      const sellPrice = unitCost && markup ? unitCost * (1 + markup / 100) : item.sellPrice
      
      onUpdate(item.id, {
        name: editedName,
        description: editedDescription || undefined,
        category: editedCategory || undefined,
        unitCost,
        markup,
        sellPrice,
        minQuantity: editedMinQuantity ? parseInt(editedMinQuantity, 10) : undefined,
      })
    }
    setIsEditing(false)
    setShowMobileModal(false)
  }

  const handleCancel = () => {
    setEditedName(item.name)
    setEditedDescription(item.description || '')
    setEditedCategory(item.category || '')
    setEditedUnitCost(item.unitCost?.toString() || '')
    setEditedMarkup(item.markup?.toString() || '')
    setEditedMinQuantity(item.minQuantity?.toString() || '')
    setIsEditing(false)
  }

  const handleCardClick = () => {
    if (!isExpanded && !isEditing && onExpand) {
      onExpand()
    }
  }

  const handleSupplierClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (supplier) {
      expandEntity(supplier.id, 'supplier', 'suppliers')
    }
  }

  // Condensed card view
  const condensedView = (
    <Card 
      className={`p-4 transition-all ${
        isExpanded 
          ? 'border-accent shadow-xl shadow-accent/20' 
          : 'hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 cursor-pointer'
      }`}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <Package size={20} weight="duotone" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-mono font-semibold text-foreground truncate">
              {item.partNumber}
            </h3>
            <p className="text-sm text-muted-foreground truncate">{item.name}</p>
          </div>
        </div>
        
        {/* Stock badge */}
        <Badge 
          variant={!hasStock ? 'outline' : isLowStock ?  'outline' : 'secondary'}
          className={`flex-shrink-0 ml-2 ${isLowStock && hasStock ? 'border-yellow-500 text-yellow-500' : ''}`}
        >
          {!hasStock ? 'No Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
        </Badge>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        {item.category && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tag size={14} className="flex-shrink-0" />
            <span className="truncate">{item.category}</span>
          </div>
        )}
        
        {item.manufacturer && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Factory size={14} className="flex-shrink-0" />
            <span className="truncate">{item.manufacturer}</span>
          </div>
        )}
        
        {/* Stock locations */}
        {stockLevels.length > 0 && (
          <div className="flex items-start gap-2 text-muted-foreground text-xs">
            <MapPin size={14} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {stockLevels.slice(0, 2).map((stock) => (
                <div key={stock.id} className="truncate">
                  {stock.location}: {stock.quantity}
                </div>
              ))}
              {stockLevels.length > 2 && (
                <div className="text-xs text-muted-foreground">
                  +{stockLevels.length - 2} more location{stockLevels.length - 2 > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        {item.unitCost !== undefined && item.unitCost !== null ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CurrencyDollar size={14} />
            <span className="text-xs">
              £{item.unitCost.toFixed(2)}
              {item.sellPrice !== undefined && item.sellPrice !== null && (
                <span className="ml-2 text-accent">→ £{item.sellPrice.toFixed(2)}</span>
              )}
            </span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No pricing</div>
        )}
        
        <div className="text-right">
          <div className="text-lg font-mono font-bold text-accent">
            {totalStock}
          </div>
          <div className="text-xs text-muted-foreground">total</div>
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
              <Label htmlFor="edit-name">Item Name</Label>
              <Input
                id="edit-name"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                value={editedCategory}
                onChange={(e) => setEditedCategory(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-unit-cost">Unit Cost (£)</Label>
              <Input
                id="edit-unit-cost"
                type="number"
                step="0.01"
                value={editedUnitCost}
                onChange={(e) => setEditedUnitCost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-markup">Markup (%)</Label>
              <Input
                id="edit-markup"
                type="number"
                step="0.1"
                value={editedMarkup}
                onChange={(e) => setEditedMarkup(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-min-quantity">Min Quantity</Label>
              <Input
                id="edit-min-quantity"
                type="number"
                value={editedMinQuantity}
                onChange={(e) => setEditedMinQuantity(e.target.value)}
              />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {item.description && (
            <div className="md:col-span-2 lg:col-span-3">
              <div className="text-sm text-muted-foreground mb-1">Description</div>
              <div className="text-sm">{item.description}</div>
            </div>
          )}
          {item.category && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Category</div>
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-accent" />
                <span>{item.category}</span>
              </div>
            </div>
          )}
          {item.manufacturer && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Manufacturer</div>
              <div className="flex items-center gap-2">
                <Factory size={18} className="text-accent" />
                <span>{item.manufacturer}</span>
              </div>
            </div>
          )}
          {supplier && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Supplier</div>
              <button
                onClick={handleSupplierClick}
                className="flex items-center gap-2 text-accent hover:underline cursor-pointer"
              >
                <User size={18} />
                <span>{supplier.name}</span>
              </button>
            </div>
          )}
          {item.unitCost !== undefined && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Unit Cost</div>
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-accent" />
                <span className="font-mono">£{item.unitCost.toFixed(2)}</span>
              </div>
            </div>
          )}
          {item.markup !== undefined && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Markup</div>
              <span className="font-mono">{item.markup.toFixed(1)}%</span>
            </div>
          )}
          {item.sellPrice !== undefined && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Sell Price</div>
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-accent" />
                <span className="font-mono font-bold">£{item.sellPrice.toFixed(2)}</span>
              </div>
            </div>
          )}
          {item.minQuantity !== undefined && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Min Quantity</div>
              <span className="font-mono">{item.minQuantity} units</span>
            </div>
          )}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Total Stock</div>
            <div className="text-2xl font-mono font-bold text-accent">
              {totalStock} <span className="text-sm text-muted-foreground">units</span>
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Status</div>
            <Badge 
              variant={!hasStock ? 'outline' : isLowStock ? 'outline' : 'secondary'}
              className={isLowStock && hasStock ? 'border-yellow-500 text-yellow-500' : ''}
            >
              {!hasStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
            </Badge>
          </div>
          {stockLevels.length > 0 && (
            <div className="md:col-span-2 lg:col-span-3">
              <div className="text-sm text-muted-foreground mb-2">Stock Locations</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {stockLevels.map((stock) => (
                  <div key={stock.id} className="flex items-center gap-2 text-sm">
                    <MapPin size={14} className="text-accent" />
                    <span>{stock.location}:</span>
                    <span className="font-mono font-semibold">{stock.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              <Label>Item Name</Label>
              <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={editedCategory} onChange={(e) => setEditedCategory(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editedDescription} onChange={(e) => setEditedDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unit Cost (£)</Label>
              <Input type="number" step="0.01" value={editedUnitCost} onChange={(e) => setEditedUnitCost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Markup (%)</Label>
              <Input type="number" step="0.1" value={editedMarkup} onChange={(e) => setEditedMarkup(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Min Quantity</Label>
              <Input type="number" value={editedMinQuantity} onChange={(e) => setEditedMinQuantity(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {item.description && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Description</div>
                <div className="text-sm">{item.description}</div>
              </div>
            )}
            {item.category && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Category</div>
                <div>{item.category}</div>
              </div>
            )}
            {item.manufacturer && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Manufacturer</div>
                <div>{item.manufacturer}</div>
              </div>
            )}
            {supplier && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Supplier</div>
                <button
                  onClick={handleSupplierClick}
                  className="text-accent hover:underline"
                >
                  {supplier.name}
                </button>
              </div>
            )}
            {item.unitCost !== undefined && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Unit Cost</div>
                <div className="font-mono">£{item.unitCost.toFixed(2)}</div>
              </div>
            )}
            {item.sellPrice !== undefined && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Sell Price</div>
                <div className="font-mono font-bold text-accent">£{item.sellPrice.toFixed(2)}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Stock</div>
              <div className="text-2xl font-mono font-bold text-accent">{totalStock} units</div>
            </div>
            {stockLevels.length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">Stock Locations</div>
                <div className="space-y-1">
                  {stockLevels.map((stock) => (
                    <div key={stock.id} className="flex justify-between text-sm">
                      <span>{stock.location}</span>
                      <span className="font-mono font-semibold">{stock.quantity}</span>
                    </div>
                  ))}
                </div>
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
