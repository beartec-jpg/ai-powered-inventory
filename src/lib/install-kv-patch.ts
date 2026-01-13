/**
 * KV Patch Installer
 * 
 * This module installs a defensive wrapper around window.ho.setKey
 * to prevent uncaught promise rejections when the KV endpoint is missing.
 * 
 * The patch is idempotent and can be called multiple times safely.
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
      // Even the safe implementation had issues, but we log instead of throwing
      console.error('[kv-patch] setKeySafe returned error:', result.error)
      // We don't throw here to prevent uncaught rejections
    } else if (result.fallback) {
      console.log(`[kv-patch] Using fallback storage: ${result.fallback}`)
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
