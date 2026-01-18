import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './lib/db.js';
import { catalogueItems } from './lib/schema.js';
import { successResponse, internalServerErrorResponse, setCorsHeaders } from './lib/utils.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: 'Only GET method is allowed',
    });
  }

  try {
    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({
        success: false,
        error: 'Database Not Configured',
        message: 'DATABASE_URL environment variable is not set. Please configure your database connection.',
        databaseUrl: 'NOT_SET',
      });
    }

    // Test database connection by running a simple query
    const testQuery = await db.select().from(catalogueItems).limit(1);
    
    // If we get here, the connection is working
    return successResponse(res, {
      status: 'connected',
      message: 'Database connection successful',
      databaseUrl: 'SET (hidden for security)',
      testQueryResult: testQuery.length > 0 ? 'Data found' : 'No data yet',
      timestamp: new Date().toISOString(),
    }, 'Database connection test successful');
  } catch (error) {
    console.error('Database connection test error:', error);
    return internalServerErrorResponse(
      res,
      `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
