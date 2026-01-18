import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db.js';
import { stockMovements, catalogueItems } from '../lib/schema.js';
import { eq, desc, and, ilike } from 'drizzle-orm';
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
  const userId = extractClerkUserId(req);
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.',
    });
  }

  try {
    // GET /api/stock/movements - List stock movements
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);
      const productId = req.query.productId as string;
      const movementType = req.query.movementType as string;

      // Build where conditions
      const conditions = [eq(catalogueItems.userId, userId)];
      
      if (productId) {
        conditions.push(eq(stockMovements.productId, productId));
      }

      if (movementType) {
        conditions.push(eq(stockMovements.movementType, movementType as any));
      }

      // Build query - need to join with catalogueItems to filter by userId
      const movements = await db
        .select({
          id: stockMovements.id,
          productId: stockMovements.productId,
          quantity: stockMovements.quantity,
          movementType: stockMovements.movementType,
          reference: stockMovements.reference,
          notes: stockMovements.notes,
          createdAt: stockMovements.createdAt,
        })
        .from(stockMovements)
        .innerJoin(catalogueItems, eq(stockMovements.productId, catalogueItems.id))
        .where(and(...conditions))
        .orderBy(desc(stockMovements.createdAt))
        .limit(perPage)
        .offset((page - 1) * perPage);

      // Get total count
      const countResult = await db
        .select()
        .from(stockMovements)
        .innerJoin(catalogueItems, eq(stockMovements.productId, catalogueItems.id))
        .where(eq(catalogueItems.userId, userId));

      return paginatedResponse(
        res,
        movements,
        page,
        perPage,
        countResult.length,
        'Stock movements retrieved successfully'
      );
    }

    // POST /api/stock/movements - Create new stock movement
    if (req.method === 'POST') {
      const { productId, quantity, movementType, reference, notes } = req.body;

      // Validate required fields
      if (!productId || quantity === undefined || !movementType) {
        return badRequestResponse(
          res,
          'Missing required fields: productId, quantity, movementType'
        );
      }

      // Validate movementType
      const validMovementTypes = ['INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'RETURN', 'TRANSFER', 'DAMAGE', 'LOSS'];
      if (!validMovementTypes.includes(movementType)) {
        return badRequestResponse(
          res,
          `Invalid movementType. Must be one of: ${validMovementTypes.join(', ')}`
        );
      }

      // Verify that the product (catalogueItem) belongs to this user
      const catalogueItem = await db
        .select()
        .from(catalogueItems)
        .where(and(
          eq(catalogueItems.id, productId),
          eq(catalogueItems.userId, userId)
        ))
        .limit(1);

      if (catalogueItem.length === 0) {
        return badRequestResponse(
          res,
          'Product not found or does not belong to this user'
        );
      }

      // Validate quantity
      const parsedQuantity = parseInt(quantity);
      if (isNaN(parsedQuantity)) {
        return badRequestResponse(res, 'Quantity must be a valid integer');
      }

      // Create new stock movement
      const newMovement = {
        id: generateId(),
        productId,
        quantity: parsedQuantity,
        movementType,
        reference: reference || null,
        notes: notes || null,
        createdAt: new Date(),
      };

      await db.insert(stockMovements).values(newMovement);

      return createdResponse(res, newMovement, 'Stock movement created successfully');
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Stock movements endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
