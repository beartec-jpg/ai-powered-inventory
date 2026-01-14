import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CatalogueItem, StockLevel } from '@/lib/types'
import { Package, Tag, MapPin, CurrencyDollar } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface CatalogueItemCardProps {
  item: CatalogueItem
  stockLevels?: StockLevel[]
}

export function CatalogueItemCard({ item, stockLevels = [] }: CatalogueItemCardProps) {
  // Calculate total stock from provided stock levels (already filtered by parent)
  const totalStock = stockLevels.reduce((sum, s) => sum + s.quantity, 0)
  
  const hasStock = totalStock > 0
  const isLowStock = item.minQuantity ? totalStock < item.minQuantity : false
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-4 hover:border-accent/50 transition-all hover:shadow-lg hover:shadow-accent/10">
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
            variant={!hasStock ? 'outline' : isLowStock ? 'outline' : 'secondary'}
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
              <span className="font-medium">Mfr:</span>
              <span className="truncate">{item.manufacturer}</span>
            </div>
          )}
          
          {/* Stock locations */}
          {stockLevels.length > 0 && (
            <div className="flex items-start gap-2 text-muted-foreground text-xs">
              <MapPin size={14} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {stockLevels.slice(0, 2).map((stock, idx) => (
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
          {item.unitCost !== undefined ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CurrencyDollar size={14} />
              <span className="text-xs">
                £{item.unitCost.toFixed(2)}
                {item.sellPrice !== undefined && (
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
    </motion.div>
  )
}
