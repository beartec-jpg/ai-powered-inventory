import { useState, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CatalogueItemCard } from './CatalogueItemCard'
import type { CatalogueItem, StockLevel, Supplier } from '@/lib/types'
import { Package } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigation } from '@/contexts/NavigationContext'

interface CatalogueViewProps {
  catalogue: CatalogueItem[]
  stockLevels: StockLevel[]
  suppliers?: Supplier[]
  onUpdate?: (id: string, updates: Partial<CatalogueItem>) => void
}

export function CatalogueView({ catalogue, stockLevels, suppliers = [], onUpdate }: CatalogueViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const { expandedEntityId, expandedEntityType } = useNavigation()
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null)
  
  // Extract unique categories from catalogue items
  const categories = useMemo(() => {
    const cats = new Set<string>()
    catalogue.forEach(item => {
      if (item.category && item.category.trim()) {
        cats.add(item.category.trim())
      }
    })
    return Array.from(cats).sort()
  }, [catalogue])
  
  // Filter items by selected category
  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') {
      return catalogue
    }
    if (selectedCategory === 'uncategorized') {
      return catalogue.filter(item => !item.category || !item.category.trim())
    }
    return catalogue.filter(item => item.category?.trim() === selectedCategory)
  }, [catalogue, selectedCategory])
  
  // Group stock levels by catalogue item ID for efficient lookup
  const stockByItemId = useMemo(() => {
    const map = new Map<string, StockLevel[]>()
    stockLevels.forEach(stock => {
      const existing = map.get(stock.catalogueItemId) || []
      map.set(stock.catalogueItemId, [...existing, stock])
    })
    return map
  }, [stockLevels])
  
  // Sort items by name
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      // If one item is expanded, it should be first
      const expandedId = expandedEntityType === 'catalogue' ? expandedEntityId : localExpandedId
      if (a.id === expandedId) return -1
      if (b.id === expandedId) return 1
      return a.name.localeCompare(b.name)
    })
  }, [filteredItems, expandedEntityId, expandedEntityType, localExpandedId])
  
  if (catalogue.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package size={48} className="mx-auto mb-4 opacity-50" />
        <p>No catalogue items yet</p>
        <p className="text-sm mt-2">Try: "Add new item LED bulb cost 5 markup 35%"</p>
      </div>
    )
  }
  
  // All category options
  const allCategories = [
    { key: 'all', label: 'All' },
    { key: 'uncategorized', label: 'Uncategorized' },
    ...categories.map(cat => ({ key: cat, label: cat }))
  ]
  
  return (
    <div className="space-y-4">
      {/* Desktop: Tabs (md and above) */}
      <div className="hidden md:block">
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {allCategories.map(cat => (
              <TabsTrigger key={cat.key} value={cat.key}>
                {cat.label}
                {cat.key === 'all' && <span className="ml-2 text-xs">({catalogue.length})</span>}
                {cat.key === 'uncategorized' && (
                  <span className="ml-2 text-xs">
                    ({catalogue.filter(i => !i.category || !i.category.trim()).length})
                  </span>
                )}
                {cat.key !== 'all' && cat.key !== 'uncategorized' && (
                  <span className="ml-2 text-xs">
                    ({catalogue.filter(i => i.category?.trim() === cat.key).length})
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {/* Render TabsContent for each category - Radix requires matching TabsContent for each TabsTrigger */}
          {allCategories.map(cat => (
            <TabsContent key={cat.key} value={cat.key} className="mt-4">
              {sortedItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No items in this category</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {sortedItems.map(item => {
                      const expandedId = expandedEntityType === 'catalogue' ? expandedEntityId : localExpandedId
                      const isExpanded = item.id === expandedId
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          className={isExpanded ? 'md:col-span-2 lg:col-span-3' : ''}
                        >
                          <CatalogueItemCard
                            item={item}
                            stockLevels={stockByItemId.get(item.id) || []}
                            suppliers={suppliers}
                            isExpanded={isExpanded}
                            onExpand={() => setLocalExpandedId(item.id)}
                            onCollapse={() => setLocalExpandedId(null)}
                            onUpdate={onUpdate}
                          />
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
      
      {/* Mobile: Dropdown (below md) */}
      <div className="md:hidden space-y-4">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {allCategories.map(cat => (
              <SelectItem key={cat.key} value={cat.key}>
                {cat.label}
                {cat.key === 'all' && ` (${catalogue.length})`}
                {cat.key === 'uncategorized' && 
                  ` (${catalogue.filter(i => !i.category || !i.category.trim()).length})`}
                {cat.key !== 'all' && cat.key !== 'uncategorized' && 
                  ` (${catalogue.filter(i => i.category?.trim() === cat.key).length})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Items grid */}
        {sortedItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package size={32} className="mx-auto mb-2 opacity-50" />
            <p>No items in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence>
              {sortedItems.map(item => {
                const expandedId = expandedEntityType === 'catalogue' ? expandedEntityId : localExpandedId
                const isExpanded = item.id === expandedId
                return (
                  <motion.div
                    key={item.id}
                    layout
                  >
                    <CatalogueItemCard
                      item={item}
                      stockLevels={stockByItemId.get(item.id) || []}
                      suppliers={suppliers}
                      isExpanded={isExpanded}
                      onExpand={() => setLocalExpandedId(item.id)}
                      onCollapse={() => setLocalExpandedId(null)}
                      onUpdate={onUpdate}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
