/**
 * Vercel Serverless API: /_spark/kv/[...key]
 * 
 * TEMPORARY KV storage endpoint to prevent 404 errors
 * 
 * BACKGROUND:
 * - GitHub Spark's useKV hook writes to /_spark/kv/* endpoints
 * - This app currently doesn't have these endpoints, causing 404 errors
 * - 404s trigger uncaught promise rejections that crash the UI flow
 * 
 * CURRENT IMPLEMENTATION:
 * - Accepts PUT, POST, GET requests
 * - Logs all operations for debugging
 * - Returns 200 OK to satisfy client expectations
 * - Does NOT persist data (logs only)
 * 
 * FUTURE IMPROVEMENTS:
 * This is a minimal shim. To add real persistence:
 * 1. Add a database (Redis, Vercel KV, or similar)
 * 2. Store key-value pairs in that database
 * 3. Implement GET to retrieve stored values
 * 4. Add authentication/authorization if needed
 * 5. Add rate limiting for production use
 * 
 * For now, this prevents crashes and allows the UI to function.
 * The client-side safe wrapper falls back to localStorage for actual persistence.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from '../../lib/utils.js';

/**
 * In-memory store for development
 * NOTE: This will reset on every cold start of the serverless function
 * Use a real database for production persistence
 */
const memoryStore: Map<string, any> = new Map();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS preflight
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract key from URL path
  // URL format: /_spark/kv/user_123-command-logs
  // req.query.key will be an array: ['user_123-command-logs'] or ['nested', 'path', 'key']
  const keyParts = req.query.key;
  const key = Array.isArray(keyParts) ? keyParts.join('/') : String(keyParts || '');

  if (!key) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Key parameter is required',
      timestamp: new Date().toISOString(),
    });
  }

  // Handle GET - retrieve value
  if (req.method === 'GET') {
    console.info(`[KV API] GET key: ${key}`);
    
    const value = memoryStore.get(key);
    if (value === undefined) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Key "${key}" not found`,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: value,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle PUT/POST - store value
  if (req.method === 'PUT' || req.method === 'POST') {
    const value = req.body;

    console.info(`[KV API] ${req.method} key: ${key}`);
    console.debug(`[KV API] Value:`, JSON.stringify(value).slice(0, 200)); // Log first 200 chars

    // Store in memory (temporary solution)
    memoryStore.set(key, value);

    // TODO: Replace with real database persistence
    // Example with Vercel KV (Redis):
    // await kv.set(key, value)
    
    return res.status(200).json({
      success: true,
      message: `Key "${key}" stored successfully`,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle DELETE - remove value
  if (req.method === 'DELETE') {
    console.info(`[KV API] DELETE key: ${key}`);
    
    const existed = memoryStore.has(key);
    memoryStore.delete(key);

    // TODO: Replace with real database deletion
    // Example with Vercel KV (Redis):
    // await kv.del(key)

    return res.status(200).json({
      success: true,
      message: existed 
        ? `Key "${key}" deleted successfully`
        : `Key "${key}" did not exist`,
      timestamp: new Date().toISOString(),
    });
  }

  // Method not allowed
  return res.status(405).json({
    success: false,
    error: 'Method Not Allowed',
    message: `Method ${req.method} is not supported. Use GET, PUT, POST, or DELETE.`,
    timestamp: new Date().toISOString(),
  });
}
