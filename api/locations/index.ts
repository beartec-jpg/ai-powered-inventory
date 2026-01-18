import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db.js';
import { warehouses } from '../lib/schema.js';
import { eq, ilike, desc, or } from 'drizzle-orm';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  notFoundResponse,
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
  const userId = extractClerkUserId(req);
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.',
    });
  }

  try {
    // GET /api/locations?search=term - Search locations/warehouses
    if (req.method === 'GET' && req.query.search) {
      const search = String(req.query.search).toLowerCase();
      
      const items = await db
        .select()
        .from(warehouses)
        .where(
          or(
            ilike(warehouses.name, `%${search}%`),
            ilike(warehouses.location, `%${search}%`)
          )
        )
        .orderBy(desc(warehouses.createdAt));

      return successResponse(res, items, `Found ${items.length} location(s)`);
    }

    // GET /api/locations?id=xyz - Get specific location
    if (req.method === 'GET' && req.query.id) {
      const id = String(req.query.id);
      
      const items = await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, id))
        .limit(1);

      if (items.length === 0) {
        return notFoundResponse(res, 'Location not found');
      }

      return successResponse(res, items[0], 'Location retrieved successfully');
    }

    // GET /api/locations - List all locations
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);

      const items = await db
        .select()
        .from(warehouses)
        .orderBy(desc(warehouses.createdAt))
        .limit(perPage)
        .offset((page - 1) * perPage);
      
      // Get total count
      const countResult = await db.select().from(warehouses);
      
      return paginatedResponse(
        res,
        items,
        page,
        perPage,
        countResult.length,
        'Locations retrieved successfully'
      );
    }

    // POST /api/locations - Create new location
    if (req.method === 'POST') {
      const { name, location, capacity } = req.body;

      // Validate required fields
      if (!name || !location || !capacity) {
        return badRequestResponse(res, 'Missing required fields: name, location, capacity');
      }

      // Validate capacity is a number
      const capacityNum = parseInt(capacity);
      if (isNaN(capacityNum) || capacityNum <= 0) {
        return badRequestResponse(res, 'Capacity must be a positive number');
      }

      // Check if location with same name already exists
      const existing = await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.name, name))
        .limit(1);

      if (existing.length > 0) {
        return badRequestResponse(
          res,
          `Location with name "${name}" already exists`
        );
      }

      const newLocation = {
        id: generateId(),
        name,
        location,
        capacity: capacityNum,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(warehouses).values(newLocation);

      return createdResponse(res, newLocation, 'Location created successfully');
    }

    // PUT /api/locations - Update location
    if (req.method === 'PUT') {
      const { id, name, location, capacity, active } = req.body;

      if (!id) {
        return badRequestResponse(res, 'Location ID is required');
      }

      // Check if location exists
      const existing = await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, id))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Location not found');
      }

      const updates: Partial<typeof warehouses.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (name !== undefined) updates.name = name;
      if (location !== undefined) updates.location = location;
      if (capacity !== undefined) {
        const capacityNum = parseInt(capacity);
        if (isNaN(capacityNum) || capacityNum <= 0) {
          return badRequestResponse(res, 'Capacity must be a positive number');
        }
        updates.capacity = capacityNum;
      }
      if (active !== undefined) updates.active = active;

      await db.update(warehouses).set(updates).where(eq(warehouses.id, id));

      const updated = await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, id))
        .limit(1);

      return successResponse(res, updated[0], 'Location updated successfully');
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Locations endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
