/**
 * Safe KV wrapper that prevents uncaught promise rejections
 * 
 * This module provides a defensive wrapper around GitHub Spark's KV storage
 * that gracefully falls back to localStorage when the server endpoint is unavailable.
 * 
 * BACKGROUND:
 * - GitHub Spark's useKV hook attempts to write to /_spark/kv/* endpoints
 * - When these endpoints are missing (404), it throws uncaught promise rejections
 * - These crashes abort multi-step UI flows, making the app appear to hang
 * 
 * SOLUTION:
 * - Wrap KV operations to catch all errors
 * - Fall back to localStorage on failure
 * - Never throw unhandled rejections
 * - Always return success/error status objects
 */

interface KVResult {
  success: boolean
  error?: string
}

/**
 * Safe setKey implementation
 * Attempts multiple strategies in order:
 * 1. If window.ho.setKey exists and is the original, call it
 * 2. Fall back to fetch PUT to /_spark/kv/:key
 * 3. Fall back to localStorage
 * 
 * Never throws - always returns a result object
 */
export async function safeSetKey(key: string, value: any): Promise<KVResult> {
  // Strategy 1: Try original window.ho.setKey if it exists and hasn't been patched
  if (typeof window !== 'undefined' && (window as any).ho?.setKey) {
    const ho = (window as any).ho
    // Check if this is the original function (not our patch)
    if (!ho.setKey._isPatched) {
      try {
        await ho.setKey(key, value)
        return { success: true }
      } catch (error) {
        console.warn('[KV Safe] window.ho.setKey failed:', error)
        // Continue to fallback strategies
      }
    }
  }

  // Strategy 2: Try fetch PUT to /_spark/kv/:key
  try {
    const response = await fetch(`/_spark/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
    })

    if (response.ok) {
      return { success: true }
    } else {
      console.warn(`[KV Safe] Server returned ${response.status} for key ${key}`)
      // Continue to localStorage fallback
    }
  } catch (error) {
    console.warn('[KV Safe] Fetch to /_spark/kv failed:', error)
    // Continue to localStorage fallback
  }

  // Strategy 3: Fall back to localStorage
  try {
    const serialized = JSON.stringify(value)
    localStorage.setItem(`kv:${key}`, serialized)
    console.info(`[KV Safe] Stored key "${key}" in localStorage (fallback)`)
    return { success: true }
  } catch (error) {
    console.error('[KV Safe] All storage strategies failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Safe getKey implementation
 * Attempts multiple strategies in order:
 * 1. If window.ho.getKey exists and is the original, call it
 * 2. Fall back to fetch GET from /_spark/kv/:key
 * 3. Fall back to localStorage
 * 
 * Never throws - returns null on failure
 */
export async function safeGetKey(key: string): Promise<any> {
  // Strategy 1: Try original window.ho.getKey if it exists and hasn't been patched
  if (typeof window !== 'undefined' && (window as any).ho?.getKey) {
    const ho = (window as any).ho
    // Check if this is the original function (not our patch)
    if (!ho.getKey._isPatched) {
      try {
        return await ho.getKey(key)
      } catch (error) {
        console.warn('[KV Safe] window.ho.getKey failed:', error)
        // Continue to fallback strategies
      }
    }
  }

  // Strategy 2: Try fetch GET from /_spark/kv/:key
  try {
    const response = await fetch(`/_spark/kv/${encodeURIComponent(key)}`)
    if (response.ok) {
      return await response.json()
    } else if (response.status === 404) {
      // Key doesn't exist - this is OK, return null
      console.debug(`[KV Safe] Key "${key}" not found on server`)
    } else {
      console.warn(`[KV Safe] Server returned ${response.status} for key ${key}`)
    }
  } catch (error) {
    console.warn('[KV Safe] Fetch from /_spark/kv failed:', error)
  }

  // Strategy 3: Fall back to localStorage
  try {
    const serialized = localStorage.getItem(`kv:${key}`)
    if (serialized) {
      console.debug(`[KV Safe] Retrieved key "${key}" from localStorage (fallback)`)
      return JSON.parse(serialized)
    }
  } catch (error) {
    console.warn('[KV Safe] localStorage retrieval failed:', error)
  }

  // No value found in any storage
  return null
}
