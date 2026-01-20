import { createContext, useContext, useState, ReactNode } from 'react'

export type TabValue = 'inventory' | 'catalogue' | 'suppliers' | 'customers' | 'equipment' | 'jobs' | 'history'

export type EntityType = 'catalogue' | 'supplier' | 'customer' | 'equipment' | 'job' | 'stock'

interface NavigationContextValue {
  selectedTab: TabValue
  setSelectedTab: (tab: TabValue) => void
  expandedEntityId: string | null
  expandedEntityType: EntityType | null
  expandEntity: (id: string, type: EntityType, switchToTab?: TabValue) => void
  collapseEntity: () => void
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [selectedTab, setSelectedTab] = useState<TabValue>('inventory')
  const [expandedEntityId, setExpandedEntityId] = useState<string | null>(null)
  const [expandedEntityType, setExpandedEntityType] = useState<EntityType | null>(null)

  const expandEntity = (id: string, type: EntityType, switchToTab?: TabValue) => {
    setExpandedEntityId(id)
    setExpandedEntityType(type)
    if (switchToTab) {
      setSelectedTab(switchToTab)
    }
  }

  const collapseEntity = () => {
    setExpandedEntityId(null)
    setExpandedEntityType(null)
  }

  return (
    <NavigationContext.Provider
      value={{
        selectedTab,
        setSelectedTab,
        expandedEntityId,
        expandedEntityType,
        expandEntity,
        collapseEntity,
      }}
    >
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider. Wrap your component tree with <NavigationProvider>.')
  }
  return context
}
