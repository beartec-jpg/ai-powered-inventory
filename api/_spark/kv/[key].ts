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
 * For production, integrate with:
 * - Vercel KV (@vercel/kv)
 * - Neon PostgreSQL (add a kv_storage table)
 * - Any other persistent key-value store
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCorsHeaders } from '../../lib/utils.js'

// In-memory storage (TEMPORARY - not suitable for production)
// Data is lost between serverless function invocations
const kvStore = new Map<string, unknown>()

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
    console.log('[kv-shim] Payload:', JSON.stringify(body).substring(0, 200))
    
    // Store in memory (TEMPORARY)
    kvStore.set(key, value)
    
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
