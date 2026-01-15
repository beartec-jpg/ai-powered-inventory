/**
 * Custom hooks for fetching and managing inventory data from API
 * 
 * These hooks replace the useKV hooks and fetch data from the PostgreSQL database
 * via API endpoints. Data is now persistent and scoped per user.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client'
import type { CatalogueItem, StockLevel } from '@/lib/types'

/**
 * Hook to fetch and manage catalogue items
 */
export function useCatalogue() {
  const { userId } = useAuth()
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Fetch catalogue items from API
  const fetchCatalogue = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<CatalogueItem[]>('/api/inventory/catalogue', userId)
      setCatalogue(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch catalogue'))
      console.error('Failed to fetch catalogue:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Fetch on mount and when userId changes
  useEffect(() => {
    fetchCatalogue()
  }, [fetchCatalogue])

  // Refetch catalogue (for use after mutations)
  const refetch = useCallback(() => {
    return fetchCatalogue()
  }, [fetchCatalogue])

  return {
    catalogue,
    loading,
    error,
    refetch,
    setCatalogue, // Keep for optimistic updates
  }
}

/**
 * Hook to fetch and manage stock levels
 */
export function useStockLevels() {
  const { userId } = useAuth()
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Fetch stock levels from API
  const fetchStockLevels = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<StockLevel[]>('/api/stock/levels', userId)
      setStockLevels(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch stock levels'))
      console.error('Failed to fetch stock levels:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Fetch on mount and when userId changes
  useEffect(() => {
    fetchStockLevels()
  }, [fetchStockLevels])

  // Refetch stock levels (for use after mutations)
  const refetch = useCallback(() => {
    return fetchStockLevels()
  }, [fetchStockLevels])

  return {
    stockLevels,
    loading,
    error,
    refetch,
    setStockLevels, // Keep for optimistic updates
  }
}

/**
 * Hook to create a catalogue item
 */
export function useCreateCatalogueItem() {
  const { userId } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createItem = useCallback(async (item: Partial<CatalogueItem>) => {
    if (!userId) {
      throw new Error('User must be authenticated')
    }

    try {
      setLoading(true)
      setError(null)
      const result = await apiPost<CatalogueItem>('/api/inventory/catalogue', userId, item)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create catalogue item')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [userId])

  return {
    createItem,
    loading,
    error,
  }
}

/**
 * Hook to update a catalogue item
 */
export function useUpdateCatalogueItem() {
  const { userId } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateItem = useCallback(async (item: Partial<CatalogueItem> & { id: string }) => {
    if (!userId) {
      throw new Error('User must be authenticated')
    }

    try {
      setLoading(true)
      setError(null)
      const result = await apiPut<CatalogueItem>('/api/inventory/catalogue', userId, item)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update catalogue item')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [userId])

  return {
    updateItem,
    loading,
    error,
  }
}

/**
 * Hook to create or update a stock level
 */
export function useCreateStockLevel() {
  const { userId } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createStockLevel = useCallback(async (stock: Partial<StockLevel> & { 
    catalogueItemId: string
    partNumber: string
    location: string
    quantity: number
    action?: 'set' | 'add'
  }) => {
    if (!userId) {
      throw new Error('User must be authenticated')
    }

    try {
      setLoading(true)
      setError(null)
      const result = await apiPost<StockLevel>('/api/stock/levels', userId, stock)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create/update stock level')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [userId])

  return {
    createStockLevel,
    loading,
    error,
  }
}

/**
 * Hook to update a stock level
 */
export function useUpdateStockLevel() {
  const { userId } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateStockLevel = useCallback(async (stock: Partial<StockLevel> & { id: string }) => {
    if (!userId) {
      throw new Error('User must be authenticated')
    }

    try {
      setLoading(true)
      setError(null)
      const result = await apiPut<StockLevel>('/api/stock/levels', userId, stock)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update stock level')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [userId])

  return {
    updateStockLevel,
    loading,
    error,
  }
}
