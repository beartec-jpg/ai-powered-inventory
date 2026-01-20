import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db.js';
import { activities, users } from '../lib/schema.js';
import { eq, desc, and, SQL } from 'drizzle-orm';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  badRequestResponse,
  internalServerErrorResponse,
  setCorsHeaders,
} from '../lib/utils.js';
import { extractClerkUserId } from '../lib/auth-helper.js';

// Helper to generate IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check if DATABASE_URL is configured
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      success: false,
      error: 'Database Not Configured',
      message: 'DATABASE_URL environment variable is not set. Please configure your database connection.',
    });
  }

  // Extract and verify user authentication
  const clerkUserId = extractClerkUserId(req);
  if (!clerkUserId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.',
    });
  }

  try {
    // GET /api/activities - List all activities (audit log)
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);
      const entityType = req.query.entityType as string;
      const entityId = req.query.entityId as string;

      // Build where conditions
      const conditions: SQL<unknown>[] = [];
      
      if (entityType) {
        conditions.push(eq(activities.entityType, entityType));
      }

      if (entityId) {
        conditions.push(eq(activities.entityId, entityId));
      }

      const items = await db
        .select()
        .from(activities)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(activities.createdAt))
        .limit(perPage)
        .offset((page - 1) * perPage);
      
      // Get total count
      const countResult = await db.select().from(activities);
      
      return paginatedResponse(
        res,
        items,
        page,
        perPage,
        countResult.length,
        'Activities retrieved successfully'
      );
    }

    // POST /api/activities - Create new activity (audit log entry)
    if (req.method === 'POST') {
      const { userId, action, entityType, entityId, oldValue, newValue, details } = req.body;

      // Validate required fields
      if (!userId || !action || !entityType || !entityId) {
        return badRequestResponse(
          res,
          'Missing required fields: userId, action, entityType, entityId'
        );
      }

      // Verify user exists (legacy users table for activities)
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        return badRequestResponse(res, 'User not found');
      }

      const newActivity = {
        id: generateId(),
        userId,
        action,
        entityType,
        entityId,
        oldValue: oldValue || null,
        newValue: newValue || null,
        details: details || null,
        createdAt: new Date(),
      };

      await db.insert(activities).values(newActivity);

      return createdResponse(res, newActivity, 'Activity logged successfully');
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Activities endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
