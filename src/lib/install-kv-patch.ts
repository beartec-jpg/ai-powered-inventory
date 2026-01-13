/**
 * KV Patch Installer
 * 
 * This module installs a defensive wrapper around window.ho.setKey
 * to prevent uncaught promise rejections when the KV endpoint is missing.
 * 
 * The patch is idempotent and can be called multiple times safely.
 * 
 * Custom Events:
 * - 'kv-operation-failed': Dispatched when all KV strategies fail
 *   - detail: { key: string, error: string, fallback?: string }
 * - 'kv-operation-success': Dispatched when a fallback strategy succeeds
 *   - detail: { key: string, fallback: 'http' | 'localStorage' }
 * 
 * Example usage to listen for failures:
 * ```typescript
 * window.addEventListener('kv-operation-failed', (e: CustomEvent) => {
 *   console.error('KV operation failed:', e.detail)
 *   // Show user notification or take corrective action
 * })
 * ```
 */

import { setKeySafe } from './kv-safe'

// Track if patch is already installed to avoid double-wrapping
let patchInstalled = false

/**
 * Install defensive KV patch on window.ho.setKey
 * 
 * This function wraps or creates window.ho.setKey to use setKeySafe
 * as a fallback when the original implementation fails.
 * 
 * The patch is idempotent and safe to call multiple times.
 */
export function installKVPatch(): void {
  // Skip if already installed
  if (patchInstalled) {
    console.log('[kv-patch] Already installed, skipping')
    return
  }

  // Ensure window is available (client-side only)
  if (typeof window === 'undefined') {
    console.warn('[kv-patch] Not in browser environment, skipping')
    return
  }

  // Initialize window.ho if it doesn't exist
  if (!window.ho) {
    window.ho = {}
  }

  // Store original setKey if it exists
  const originalSetKey = window.ho.setKey

  // Install patched setKey
  window.ho.setKey = async function patchedSetKey(key: string, value: unknown): Promise<void> {
    try {
      // If there's an original implementation, try it first
      if (originalSetKey && typeof originalSetKey === 'function') {
        await originalSetKey.call(window.ho, key, value)
        return
      }
    } catch (error) {
      // Original failed, log and fall through to safe implementation
      console.warn('[kv-patch] Original setKey failed, using safe fallback:', error)
    }

    // Use safe implementation as fallback
    const result = await setKeySafe(key, value)
    
    if (!result.ok) {
      // Even the safe implementation had issues
      // We log the error but don't throw to prevent uncaught rejections
      console.error('[kv-patch] setKeySafe returned error:', result.error)
      console.error('[kv-patch] KV operation failed for key:', key)
      
      // Dispatch a custom event so UI components can react to failures if needed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kv-operation-failed', {
          detail: { key, error: result.error, fallback: result.fallback }
        }))
      }
      
      // We still don't throw here to maintain the defensive contract
    } else if (result.fallback) {
      console.log(`[kv-patch] Using fallback storage: ${result.fallback}`)
      
      // Dispatch success event with fallback info
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kv-operation-success', {
          detail: { key, fallback: result.fallback }
        }))
      }
    }
  }

  // Mark as installed
  patchInstalled = true
  console.log('[kv-patch] KV patch installed successfully')
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
