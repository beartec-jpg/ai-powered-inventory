/**
 * Temporary KV Endpoint Shim
 * 
 * This is a TEMPORARY server-side route that accepts PUT/POST requests to /_spark/kv/*
 * to prevent 404 errors from aborting the UI flow during multi-step catalogue creation.
 * 
 * ⚠️ TODO: Replace this with proper persistent KV storage (database or cloud KV service)
 * 
 * This shim:
 * - Accepts PUT and POST requests at /_spark/kv/:key
 * - Logs the payload for debugging
 * - Returns 200 OK to allow the client flow to continue
 * - Does NOT persist data - values are lost on server restart
 * 
 * For production use, integrate with:
 * - Vercel KV (Redis)
 * - Neon PostgreSQL (add a kv_storage table)
 * - Any other persistent key-value store
 */

// In-memory storage (TEMPORARY - not suitable for production)
// Data is lost on server restart or during serverless function cold starts
const kvStore = new Map()

/**
 * Handle KV requests
 * 
 * This function can be used with Express, Next.js API routes, or Vercel serverless functions
 * 
 * @example Express
 * app.put('/_spark/kv/:key', handleKVRequest)
 * app.post('/_spark/kv/:key', handleKVRequest)
 * 
 * @example Next.js API Route (pages/api/_spark/kv/[key].js)
 * export default function handler(req, res) {
 *   return handleKVRequest(req, res)
 * }
 * 
 * @example Vercel Serverless (api/_spark/kv/[key].js)
 * module.exports = handleKVRequest
 */
function handleKVRequest(req, res) {
  // Extract key from URL
  const key = req.params?.key || req.query?.key || 'unknown'
  
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
    
    // Store in memory (TEMPORARY)
    kvStore.set(key, value)
    
    // Return success
    return res.status(200).json({ 
      ok: true,
      message: 'Value stored (in-memory only - will be lost on restart)',
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

module.exports = handleKVRequest
module.exports.handleKVRequest = handleKVRequest
