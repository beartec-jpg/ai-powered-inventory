import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db.js';
import { catalogueItems } from '../lib/schema.js';
import { eq, ilike, desc, and } from 'drizzle-orm';
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
    // GET /api/catalogue/items? search=term - Search catalogue items
    if (req.method === 'GET' && req.query.search) {
      const search = String(req.query.search).toLowerCase();
      
      const items = await db
        .select()
        .from(catalogueItems)
        .where(and(
          eq(catalogueItems.userId, userId),
          ilike(catalogueItems.name, `%${search}%`)
        ))
        .orderBy(desc(catalogueItems.updatedAt));

      return successResponse(res, items, `Found ${items.length} item(s) in catalogue`);
    }

    // GET /api/catalogue/items - List all catalogue items
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);

      const items = await db
        .select()
        .from(catalogueItems)
        .where(eq(catalogueItems.userId, userId))
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

    // POST /api/catalogue/items - Create new catalogue item
    if (req.method === 'POST') {
      const { 
        partNumber, 
        name, 
        description, 
        manufacturer, 
        category,
        subcategory,
        unitCost,
        markup,
        sellPrice,
        isStocked,
        minQuantity,
        preferredSupplierName 
      } = req.body;

      // Validate required fields
      if (!partNumber || !name) {
        return badRequestResponse(
          res,
          'Missing required fields: partNumber, name'
        );
      }

      // Check if item with same part number already exists for this user
      const existing = await db
        .select()
        .from(catalogueItems)
        .where(and(
          eq(catalogueItems.userId, userId),
          eq(catalogueItems.partNumber, partNumber)
        ))
        .limit(1);

      if (existing.length > 0) {
        return badRequestResponse(
          res,
          `Item with part number "${partNumber}" already exists in your catalogue`
        );
      }

      const newItem = {
        id: generateId(),
        userId,
        partNumber,
        name,
        description: description || null,
        manufacturer: manufacturer || null,
        category: category || null,
        subcategory: subcategory || null,
        unitCost: unitCost || null,
        markup: markup || null,
        sellPrice: sellPrice || null,
        isStocked: Boolean(isStocked),
        minQuantity: minQuantity || null,
        preferredSupplierName: preferredSupplierName || null,
        attributes: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(catalogueItems).values(newItem);

      return createdResponse(res, newItem, 'Catalogue item created successfully');
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Catalogue items endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
