/**
 * Safe KV helper for defensive client-side key-value storage
 * 
 * This module provides a defensive wrapper around the Spark KV system that:
 * 1. Tries window.ho.setKey if available (Spark native)
 * 2. Falls back to HTTP POST to /_spark/kv/:key (server endpoint)
 * 3. Falls back to localStorage if both fail
 * 4. Always returns a resolved value and never allows uncaught rejections
 * 
 * This ensures the UI never aborts when the KV endpoint is missing.
 */

export interface SetKeyResult {
  ok: boolean
  fallback?: 'http' | 'localStorage' | 'none'
  error?: string
}

/**
 * Safely set a key-value pair using available KV mechanisms
 * 
 * @param key - The key to set
 * @param value - The value to store (will be JSON stringified)
 * @returns Promise that always resolves with status information
 */
export async function setKeySafe(key: string, value: unknown): Promise<SetKeyResult> {
  // Strategy 1: Try window.ho.setKey if available
  try {
    if (typeof window !== 'undefined' && window.ho && typeof window.ho.setKey === 'function') {
      await window.ho.setKey(key, value)
      return { ok: true, fallback: 'none' }
    }
  } catch (error) {
    console.warn('[kv-safe] window.ho.setKey failed:', error)
    // Continue to next fallback
  }

  // Strategy 2: Try HTTP POST to /_spark/kv/:key
  // Note: Using POST to match Spark KV convention
  try {
    const response = await fetch(`/_spark/kv/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    })

    if (response.ok) {
      return { ok: true, fallback: 'http' }
    } else {
      console.warn('[kv-safe] HTTP POST failed with status:', response.status)
      // Continue to next fallback
    }
  } catch (error) {
    console.warn('[kv-safe] HTTP POST error:', error)
    // Continue to next fallback
  }

  // Strategy 3: Fall back to localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const serialized = JSON.stringify(value)
      window.localStorage.setItem(key, serialized)
      return { ok: true, fallback: 'localStorage' }
    }
  } catch (error) {
    console.error('[kv-safe] localStorage fallback failed:', error)
    return {
      ok: false,
      fallback: 'localStorage',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // All strategies failed
  return {
    ok: false,
    error: 'All KV storage mechanisms failed',
  }
}

/**
 * Safely get a value from KV storage
 * 
 * @param key - The key to retrieve
 * @returns Promise that always resolves with the value or null
 */
export async function getKeySafe(key: string): Promise<unknown> {
  // Strategy 1: Try window.ho.getKey if available
  try {
    if (typeof window !== 'undefined' && window.ho && typeof window.ho.getKey === 'function') {
      return await window.ho.getKey(key)
    }
  } catch (error) {
    console.warn('[kv-safe] window.ho.getKey failed:', error)
    // Continue to next fallback
  }

  // Strategy 2: Try HTTP GET from /_spark/kv/:key
  try {
    const response = await fetch(`/_spark/kv/${encodeURIComponent(key)}`)
    if (response.ok) {
      const data = await response.json()
      return data.value
    }
  } catch (error) {
    console.warn('[kv-safe] HTTP GET error:', error)
    // Continue to next fallback
  }

  // Strategy 3: Fall back to localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const serialized = window.localStorage.getItem(key)
      if (serialized !== null) {
        try {
          return JSON.parse(serialized)
        } catch (parseError) {
          console.error('[kv-safe] Failed to parse localStorage data:', parseError)
          // Data is corrupted, remove it and return null
          window.localStorage.removeItem(key)
          return null
        }
      }
    }
  } catch (error) {
    console.error('[kv-safe] localStorage retrieval failed:', error)
  }

  // Nothing found
  return null
}

// Type augmentation for window.ho
declare global {
  interface Window {
    ho?: {
      setKey?: (key: string, value: unknown) => Promise<void>
      getKey?: (key: string) => Promise<unknown>
    }
  }
}
