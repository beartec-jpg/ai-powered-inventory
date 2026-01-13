/**
 * Vercel Serverless Function for KV Endpoint
 * 
 * This is a TEMPORARY endpoint that handles /_spark/kv/[key] requests
 * to prevent 404 errors from aborting the UI flow during multi-step catalogue creation.
 * 
 * ⚠️ TODO: Replace this with proper persistent KV storage (Vercel KV, Neon PostgreSQL, etc.)
 * 
 * This endpoint:
 * - Accepts GET, PUT, POST, and DELETE requests at /api/_spark/kv/[key]
 * - Logs payloads for debugging
 * - Returns 200 OK to allow the client flow to continue
 * - Uses in-memory storage (not persistent across serverless function invocations)
 * 
 * ⚠️ LIMITATIONS:
 * - In-memory Map with basic size limit (1000 keys max)
 * - Data lost between serverless function invocations
 * - LRU eviction when size limit reached
 * - Not suitable for production use
 * 
 * For production, integrate with:
 * - Vercel KV (@vercel/kv)
 * - Neon PostgreSQL (add a kv_storage table)
 * - Any other persistent key-value store
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsHeaders } from '../../lib/utils'

// In-memory storage (TEMPORARY - not suitable for production)
// Data is lost between serverless function invocations
// WARNING: This Map will grow indefinitely and never release memory
const kvStore = new Map<string, unknown>()

// Basic safety limit to prevent unbounded memory growth
const MAX_KEYS = 1000

/**
 * Add a key to the store with basic size limiting
 */
function safeSet(key: string, value: unknown): void {
  // If we're at the limit and adding a new key, remove the oldest entry
  if (kvStore.size >= MAX_KEYS && !kvStore.has(key)) {
    const firstKey = kvStore.keys().next().value
    if (firstKey) {
      kvStore.delete(firstKey)
      console.warn(`[kv-shim] Reached max size (${MAX_KEYS}), removed oldest key: ${firstKey}`)
    }
  }
  kvStore.set(key, value)
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS
  setCorsHeaders(res)
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Extract key from query parameters
  const key = Array.isArray(req.query.key) ? req.query.key[0] : req.query.key
  
  if (!key) {
    return res.status(400).json({ 
      ok: false,
      error: 'Key parameter is required' 
    })
  }

  // Validate key to prevent path traversal attacks
  // Allow only alphanumeric characters, hyphens, underscores, and dots
  const keyPattern = /^[a-zA-Z0-9_.-]+$/
  if (!keyPattern.test(key)) {
    console.warn(`[kv-shim] Invalid key format: ${key}`)
    return res.status(400).json({
      ok: false,
      error: 'Key must contain only alphanumeric characters, hyphens, underscores, and dots'
    })
  }

  // Handle GET requests (retrieve value)
  if (req.method === 'GET') {
    const value = kvStore.get(key)
    
    if (value !== undefined) {
      console.log(`[kv-shim] GET /_spark/kv/${key} - Found`)
      return res.status(200).json({ value })
    } else {
      console.log(`[kv-shim] GET /_spark/kv/${key} - Not found`)
      return res.status(404).json({ error: 'Key not found' })
    }
  }

  // Handle PUT/POST requests (set value)
  if (req.method === 'PUT' || req.method === 'POST') {
    const body = req.body
    const value = body?.value
    
    console.log(`[kv-shim] ${req.method} /_spark/kv/${key}`)
    // Only log metadata to avoid exposing sensitive data
    console.log('[kv-shim] Payload size:', JSON.stringify(body).length, 'bytes')
    
    // Store in memory (TEMPORARY) with size limiting
    safeSet(key, value)
    
    // Return success
    return res.status(200).json({ 
      ok: true,
      message: 'Value stored (in-memory only - will be lost between invocations)',
      key,
    })
  }

  // Handle DELETE requests
  if (req.method === 'DELETE') {
    const existed = kvStore.has(key)
    kvStore.delete(key)
    
    console.log(`[kv-shim] DELETE /_spark/kv/${key} - ${existed ? 'Deleted' : 'Not found'}`)
    
    return res.status(200).json({ 
      ok: true,
      message: existed ? 'Key deleted' : 'Key not found',
    })
  }

  // Unsupported method
  return res.status(405).json({ error: 'Method not allowed' })
}
