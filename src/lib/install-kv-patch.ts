/**
 * KV Patch Installer
 * 
 * Patches window.ho.setKey and window.ho.getKey at app startup to use safe wrappers
 * that never throw uncaught promise rejections.
 * 
 * WHY THIS IS NEEDED:
 * - GitHub Spark's useKV hook internally calls window.ho.setKey/getKey
 * - These methods throw when /_spark/kv/* endpoints return 404
 * - By patching at startup, we intercept ALL KV calls throughout the app
 * - This prevents crashes without requiring changes to every file that uses useKV
 * 
 * USAGE:
 * Call installKVPatch() once at app startup (in main.tsx) before rendering
 */

import { safeSetKey, safeGetKey } from './kv-safe'

/**
 * Install the safe KV wrapper by patching window.ho
 * 
 * This function:
 * - Waits for window.ho to be available (GitHub Spark may load it asynchronously)
 * - Patches setKey and getKey with safe wrappers
 * - Preserves the original functions as fallback
 * - Marks patched functions to prevent double-patching
 */
export function installKVPatch(): void {
  if (typeof window === 'undefined') {
    console.warn('[KV Patch] Cannot install - not in browser environment')
    return
  }

  // Function to apply the patch
  const applyPatch = () => {
    const ho = (window as any).ho

    if (!ho) {
      console.warn('[KV Patch] window.ho not found - waiting...')
      return false
    }

    // Check if already patched
    if (ho.setKey?._isPatched) {
      console.debug('[KV Patch] Already installed')
      return true
    }

    // Store original functions if they exist
    const originalSetKey = ho.setKey
    const originalGetKey = ho.getKey

    console.info('[KV Patch] Installing safe KV wrappers...')

    // Patch setKey
    ho.setKey = async function(key: string, value: any) {
      try {
        // Try original first if it exists
        if (originalSetKey && typeof originalSetKey === 'function') {
          try {
            await originalSetKey.call(ho, key, value)
            return
          } catch (error) {
            console.warn('[KV Patch] Original setKey failed, using safe fallback:', error)
          }
        }

        // Use safe wrapper
        const result = await safeSetKey(key, value)
        if (!result.success) {
          console.error('[KV Patch] Safe setKey failed:', result.error)
          // Don't throw - just log the error
        }
      } catch (error) {
        // This should never happen since safeSetKey doesn't throw,
        // but catch it anyway to be absolutely safe
        console.error('[KV Patch] Unexpected error in patched setKey:', error)
      }
    }
    // Mark as patched to prevent double-patching and identify in safe wrappers
    ho.setKey._isPatched = true

    // Patch getKey
    ho.getKey = async function(key: string) {
      try {
        // Try original first if it exists
        if (originalGetKey && typeof originalGetKey === 'function') {
          try {
            return await originalGetKey.call(ho, key)
          } catch (error) {
            console.warn('[KV Patch] Original getKey failed, using safe fallback:', error)
          }
        }

        // Use safe wrapper
        return await safeGetKey(key)
      } catch (error) {
        // This should never happen since safeGetKey doesn't throw,
        // but catch it anyway to be absolutely safe
        console.error('[KV Patch] Unexpected error in patched getKey:', error)
        return null
      }
    }
    // Mark as patched
    ho.getKey._isPatched = true

    console.info('[KV Patch] ✓ Safe KV wrappers installed successfully')
    return true
  }

  // Try to apply patch immediately
  if (applyPatch()) {
    return
  }

  // If window.ho isn't ready yet, wait for it
  // GitHub Spark may load asynchronously, so we poll with exponential backoff
  let attempts = 0
  const maxAttempts = 10
  const baseDelay = 100 // ms

  const pollForHo = () => {
    attempts++

    if (applyPatch()) {
      return // Success!
    }

    if (attempts >= maxAttempts) {
      console.warn('[KV Patch] window.ho never became available - patch not installed')
      console.warn('[KV Patch] KV operations may fail if /_spark/kv/* endpoints are missing')
      return
    }

    // Exponential backoff: 100ms, 200ms, 400ms, 800ms, ...
    const delay = baseDelay * Math.pow(2, attempts - 1)
    setTimeout(pollForHo, delay)
  }

  // Start polling
  setTimeout(pollForHo, baseDelay)
}
