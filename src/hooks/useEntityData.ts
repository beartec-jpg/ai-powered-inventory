/**
 * Database-backed hooks for all entities
 * Replaces useKV with persistent PostgreSQL storage
 * 
 * These hooks follow the same pattern as useCatalogue() and useStockLevels()
 * in useInventoryData.ts, providing consistent data fetching with loading states
 * and error handling.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { apiGet, apiPost, apiPut } from '@/lib/api-client'
import type { Customer, Equipment, Job, Supplier, PurchaseOrder } from '@/lib/types'

/**
 * Hook to fetch and manage customers from database
 */
export function useCustomers() {
  const { userId } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchCustomers = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<Customer[]>('/api/customers', userId)
      setCustomers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch customers'))
      console.error('Failed to fetch customers:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const refetch = useCallback(() => {
    return fetchCustomers()
  }, [fetchCustomers])

  return {
    customers,
    loading,
    error,
    refetch,
    setCustomers, // Keep for optimistic updates
  }
}

/**
 * Hook to fetch and manage equipment from database
 */
export function useEquipment() {
  const { userId } = useAuth()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchEquipment = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<Equipment[]>('/api/equipment', userId)
      setEquipment(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch equipment'))
      console.error('Failed to fetch equipment:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchEquipment()
  }, [fetchEquipment])

  const refetch = useCallback(() => {
    return fetchEquipment()
  }, [fetchEquipment])

  return {
    equipment,
    loading,
    error,
    refetch,
    setEquipment, // Keep for optimistic updates
  }
}

/**
 * Hook to fetch and manage jobs from database
 */
export function useJobs() {
  const { userId } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchJobs = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<Job[]>('/api/jobs', userId)
      setJobs(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch jobs'))
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const refetch = useCallback(() => {
    return fetchJobs()
  }, [fetchJobs])

  return {
    jobs,
    loading,
    error,
    refetch,
    setJobs, // Keep for optimistic updates
  }
}

/**
 * Hook to fetch and manage suppliers from database
 */
export function useSuppliers() {
  const { userId } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSuppliers = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<Supplier[]>('/api/suppliers', userId)
      setSuppliers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch suppliers'))
      console.error('Failed to fetch suppliers:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const refetch = useCallback(() => {
    return fetchSuppliers()
  }, [fetchSuppliers])

  return {
    suppliers,
    loading,
    error,
    refetch,
    setSuppliers, // Keep for optimistic updates
  }
}

/**
 * Hook to fetch and manage purchase orders from database
 */
export function usePurchaseOrders() {
  const { userId } = useAuth()
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPurchaseOrders = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<PurchaseOrder[]>('/api/purchase-orders', userId)
      setPurchaseOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch purchase orders'))
      console.error('Failed to fetch purchase orders:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchPurchaseOrders()
  }, [fetchPurchaseOrders])

  const refetch = useCallback(() => {
    return fetchPurchaseOrders()
  }, [fetchPurchaseOrders])

  return {
    purchaseOrders,
    loading,
    error,
    refetch,
    setPurchaseOrders, // Keep for optimistic updates
  }
}
