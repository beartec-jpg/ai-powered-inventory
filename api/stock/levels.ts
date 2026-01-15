import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db.js';
import { stockLevels, catalogueItems } from '../lib/schema.js';
import { eq, or, ilike, desc, and, lt } from 'drizzle-orm';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  notFoundResponse,
  badRequestResponse,
  internalServerErrorResponse,
  setCorsHeaders,
} from '../lib/utils.js';

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

  try {
    // GET /api/stock/levels?search=term - Search stock levels
    if (req.method === 'GET' && req.query.search) {
      const search = String(req.query.search).toLowerCase();
      const location = req.query.location as string;
      
      let query = db
        .select()
        .from(stockLevels)
        .where(
          or(
            ilike(stockLevels.partNumber, `%${search}%`),
            ilike(stockLevels.name, `%${search}%`)
          )
        );

      if (location) {
        query = query.where(ilike(stockLevels.location, `%${location}%`));
      }

      const items = await query.orderBy(desc(stockLevels.updatedAt));

      return successResponse(res, items, `Found ${items.length} item(s) in stock`);
    }

    // GET /api/stock/levels?low=true - Get low stock items
    if (req.method === 'GET' && req.query.low === 'true') {
      // Join with catalogue items to get minQuantity
      const items = await db
        .select({
          id: stockLevels.id,
          catalogueItemId: stockLevels.catalogueItemId,
          partNumber: stockLevels.partNumber,
          name: stockLevels.name,
          location: stockLevels.location,
          quantity: stockLevels.quantity,
          lastMovementAt: stockLevels.lastMovementAt,
          lastCountedAt: stockLevels.lastCountedAt,
          updatedAt: stockLevels.updatedAt,
          minQuantity: catalogueItems.minQuantity,
        })
        .from(stockLevels)
        .innerJoin(catalogueItems, eq(stockLevels.catalogueItemId, catalogueItems.id))
        .where(
          and(
            // @ts-ignore - Drizzle typing issue with comparison
            lt(stockLevels.quantity, catalogueItems.minQuantity)
          )
        )
        .orderBy(desc(stockLevels.updatedAt));

      return successResponse(res, items, `Found ${items.length} low stock item(s)`);
    }

    // GET /api/stock/levels?id=xyz - Get specific stock level
    if (req.method === 'GET' && req.query.id) {
      const id = String(req.query.id);
      
      const items = await db
        .select()
        .from(stockLevels)
        .where(eq(stockLevels.id, id))
        .limit(1);

      if (items.length === 0) {
        return notFoundResponse(res, 'Stock level not found');
      }

      return successResponse(res, items[0], 'Stock level retrieved successfully');
    }

    // GET /api/stock/levels - List all stock levels
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);
      const location = req.query.location as string;

      let query = db
        .select()
        .from(stockLevels)
        .orderBy(desc(stockLevels.updatedAt));

      if (location) {
        query = query.where(ilike(stockLevels.location, `%${location}%`));
      }

      const items = await query.limit(perPage).offset((page - 1) * perPage);
      
      // Get total count
      const countResult = await db
        .select()
        .from(stockLevels);
      
      return paginatedResponse(
        res,
        items,
        page,
        perPage,
        countResult.length,
        'Stock levels retrieved successfully'
      );
    }

    // POST /api/stock/levels - Create or update stock level (receive stock)
    if (req.method === 'POST') {
      const { catalogueItemId, partNumber, name, location, quantity, action } = req.body;

      // Validate required fields
      if (!catalogueItemId || !partNumber || !location || quantity === undefined) {
        return badRequestResponse(
          res,
          'Missing required fields: catalogueItemId, partNumber, location, quantity'
        );
      }

      if (quantity < 0) {
        return badRequestResponse(res, 'Quantity cannot be negative');
      }

      // Check if stock level already exists for this item and location
      const existing = await db
        .select()
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.catalogueItemId, catalogueItemId),
            eq(stockLevels.location, location)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing stock level
        const currentQty = existing[0].quantity;
        const newQty = action === 'set' ? quantity : currentQty + quantity;

        if (newQty < 0) {
          return badRequestResponse(res, 'Insufficient stock quantity');
        }

        await db
          .update(stockLevels)
          .set({
            quantity: newQty,
            lastMovementAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(stockLevels.id, existing[0].id));

        const updated = await db
          .select()
          .from(stockLevels)
          .where(eq(stockLevels.id, existing[0].id))
          .limit(1);

        return successResponse(res, updated[0], `Stock ${action === 'set' ? 'set' : 'updated'} successfully`);
      }

      // Create new stock level
      const newItem = {
        id: generateId(),
        catalogueItemId,
        partNumber,
        name: name || partNumber,
        location,
        quantity,
        lastMovementAt: new Date(),
        lastCountedAt: null,
        updatedAt: new Date(),
      };

      await db.insert(stockLevels).values(newItem);

      return createdResponse(res, newItem, 'Stock level created successfully');
    }

    // PUT /api/stock/levels - Update stock level
    if (req.method === 'PUT') {
      const { id, quantity, lastCountedAt } = req.body;

      if (!id) {
        return badRequestResponse(res, 'Stock level ID is required');
      }

      // Check if item exists
      const existing = await db
        .select()
        .from(stockLevels)
        .where(eq(stockLevels.id, id))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Stock level not found');
      }

      const updates: any = {
        updatedAt: new Date(),
      };

      if (quantity !== undefined) {
        if (quantity < 0) {
          return badRequestResponse(res, 'Quantity cannot be negative');
        }
        updates.quantity = quantity;
        updates.lastMovementAt = new Date();
      }

      if (lastCountedAt !== undefined) {
        updates.lastCountedAt = lastCountedAt ? new Date(lastCountedAt) : null;
      }

      await db
        .update(stockLevels)
        .set(updates)
        .where(eq(stockLevels.id, id));

      const updated = await db
        .select()
        .from(stockLevels)
        .where(eq(stockLevels.id, id))
        .limit(1);

      return successResponse(res, updated[0], 'Stock level updated successfully');
    }

    // DELETE /api/stock/levels?id=xyz - Delete stock level
    if (req.method === 'DELETE') {
      const id = req.query.id as string;

      if (!id) {
        return badRequestResponse(res, 'Stock level ID is required');
      }

      // Check if item exists
      const existing = await db
        .select()
        .from(stockLevels)
        .where(eq(stockLevels.id, id))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Stock level not found');
      }

      // Hard delete stock level
      await db
        .delete(stockLevels)
        .where(eq(stockLevels.id, id));

      return successResponse(res, { id }, 'Stock level deleted successfully');
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Stock levels endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
