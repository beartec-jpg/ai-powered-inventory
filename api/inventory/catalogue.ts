import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db.js';
import { catalogueItems } from '../lib/schema.js';
import { eq, or, ilike, desc, and } from 'drizzle-orm';
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
    // GET /api/inventory/catalogue?search=term - Search catalogue items
    if (req.method === 'GET' && req.query.search) {
      const search = String(req.query.search).toLowerCase();
      
      const items = await db
        .select()
        .from(catalogueItems)
        .where(
          and(
            eq(catalogueItems.userId, userId),
            or(
              ilike(catalogueItems.partNumber, `%${search}%`),
              ilike(catalogueItems.name, `%${search}%`),
              ilike(catalogueItems.description, `%${search}%`),
              ilike(catalogueItems.manufacturer, `%${search}%`)
            )
          )
        )
        .orderBy(desc(catalogueItems.updatedAt));

      return successResponse(res, items, `Found ${items.length} catalogue item(s)`);
    }

    // GET /api/inventory/catalogue?id=xyz - Get specific catalogue item
    if (req.method === 'GET' && req.query.id) {
      const id = String(req.query.id);
      
      const items = await db
        .select()
        .from(catalogueItems)
        .where(and(
          eq(catalogueItems.id, id),
          eq(catalogueItems.userId, userId)
        ))
        .limit(1);

      if (items.length === 0) {
        return notFoundResponse(res, 'Catalogue item not found');
      }

      return successResponse(res, items[0], 'Catalogue item retrieved successfully');
    }

    // GET /api/inventory/catalogue - List all catalogue items
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);
      const category = req.query.category as string;
      const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;

      // Build where conditions
      const conditions = [eq(catalogueItems.userId, userId)];
      if (category) {
        conditions.push(eq(catalogueItems.category, category));
      }
      if (active !== undefined) {
        conditions.push(eq(catalogueItems.active, active));
      }

      const items = await db
        .select()
        .from(catalogueItems)
        .where(and(...conditions))
        .orderBy(desc(catalogueItems.updatedAt))
        .limit(perPage)
        .offset((page - 1) * perPage);
      
      // Get total count for this user
      const countResult = await db
        .select()
        .from(catalogueItems)
        .where(eq(catalogueItems.userId, userId));
      
      return paginatedResponse(
        res,
        items,
        page,
        perPage,
        countResult.length,
        'Catalogue items retrieved successfully'
      );
    }

    // POST /api/inventory/catalogue - Create new catalogue item
    if (req.method === 'POST') {
      const { partNumber, name, description, manufacturer, category, subcategory, unitCost, markup, sellPrice, isStocked, minQuantity, preferredSupplierName, attributes } = req.body;

      // Validate required fields
      if (!partNumber || !name) {
        return badRequestResponse(
          res,
          'Missing required fields: partNumber, name'
        );
      }

      // Check if part number already exists for this user
      const existing = await db
        .select()
        .from(catalogueItems)
        .where(and(
          eq(catalogueItems.partNumber, partNumber),
          eq(catalogueItems.userId, userId)
        ))
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: `Catalogue item with part number ${partNumber} already exists`,
        });
      }

      // Calculate sell price if unitCost and markup provided
      let finalSellPrice = sellPrice;
      if (!finalSellPrice && unitCost && markup) {
        finalSellPrice = unitCost * (1 + markup / 100);
      }

      const newItem = {
        id: generateId(),
        userId, // Add userId to ensure user scoping
        partNumber,
        name,
        description: description || null,
        manufacturer: manufacturer || null,
        category: category || null,
        subcategory: subcategory || null,
        unitCost: unitCost || null,
        markup: markup || null,
        sellPrice: finalSellPrice || null,
        isStocked: isStocked || false,
        minQuantity: minQuantity || null,
        preferredSupplierName: preferredSupplierName || null,
        attributes: attributes ? JSON.stringify(attributes) : null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(catalogueItems).values(newItem);

      return createdResponse(res, newItem, 'Catalogue item created successfully');
    }

    // PUT /api/inventory/catalogue - Update catalogue item
    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;

      if (!id) {
        return badRequestResponse(res, 'Catalogue item ID is required');
      }

      // Check if item exists and belongs to this user
      const existing = await db
        .select()
        .from(catalogueItems)
        .where(and(
          eq(catalogueItems.id, id),
          eq(catalogueItems.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Catalogue item not found');
      }

      // Calculate sell price if unitCost and markup updated
      if (updateData.unitCost !== undefined && updateData.markup !== undefined) {
        updateData.sellPrice = updateData.unitCost * (1 + updateData.markup / 100);
      }

      // Prepare update object
      const updates: any = {
        ...updateData,
        updatedAt: new Date(),
      };

      // Handle attributes serialization
      if (updates.attributes && typeof updates.attributes === 'object') {
        updates.attributes = JSON.stringify(updates.attributes);
      }

      await db
        .update(catalogueItems)
        .set(updates)
        .where(and(
          eq(catalogueItems.id, id),
          eq(catalogueItems.userId, userId)
        ));

      const updated = await db
        .select()
        .from(catalogueItems)
        .where(and(
          eq(catalogueItems.id, id),
          eq(catalogueItems.userId, userId)
        ))
        .limit(1);

      return successResponse(res, updated[0], 'Catalogue item updated successfully');
    }

    // DELETE /api/inventory/catalogue?id=xyz - Delete catalogue item (soft delete)
    if (req.method === 'DELETE') {
      const id = req.query.id as string;

      if (!id) {
        return badRequestResponse(res, 'Catalogue item ID is required');
      }

      // Check if item exists and belongs to this user
      const existing = await db
        .select()
        .from(catalogueItems)
        .where(and(
          eq(catalogueItems.id, id),
          eq(catalogueItems.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Catalogue item not found');
      }

      // Soft delete by setting active to false
      await db
        .update(catalogueItems)
        .set({ active: false, updatedAt: new Date() })
        .where(and(
          eq(catalogueItems.id, id),
          eq(catalogueItems.userId, userId)
        ));

      return successResponse(res, { id }, 'Catalogue item deleted successfully');
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Catalogue endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
