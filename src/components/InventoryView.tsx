import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InventoryItem } from '@/lib/types'
import { Package, MapPin } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface InventoryCardProps {
  item: InventoryItem
}

export function InventoryCard({ item }: InventoryCardProps) {
  const isLowStock = item.minQuantity ? item.quantity < item.minQuantity : item.quantity < 10
  const isOutOfStock = item.quantity === 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-4 hover:border-accent/50 transition-all hover:shadow-lg hover:shadow-accent/10">
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
    </motion.div>
  )
}

interface InventoryTableProps {
  items: InventoryItem[]
}

export function InventoryTable({ items }: InventoryTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package size={48} className="mx-auto mb-4 opacity-50" />
        <p>No inventory items yet</p>
        <p className="text-sm mt-2">Try: "add 100 units of widget-A to warehouse-1"</p>
      </div>
    )
  }

  const sortedItems = [...items].sort((a, b) => b.lastUpdated - a.lastUpdated)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedItems.map((item) => (
        <InventoryCard key={item.id} item={item} />
      ))}
    </div>
  )
}
