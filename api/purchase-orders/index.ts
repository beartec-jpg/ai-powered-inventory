import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db.js';
import { purchaseOrders, suppliers } from '../lib/schema.js';
import { eq, desc, and, ilike } from 'drizzle-orm';
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

// Helper to generate PO number
function generatePONumber(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${timestamp}-${random}`;
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
    // GET /api/purchase-orders?search=term - Search purchase orders by PO number
    if (req.method === 'GET' && req.query.search) {
      const search = String(req.query.search).toLowerCase();
      
      const items = await db
        .select()
        .from(purchaseOrders)
        .where(ilike(purchaseOrders.poNumber, `%${search}%`))
        .orderBy(desc(purchaseOrders.createdAt));

      return successResponse(res, items, `Found ${items.length} purchase order(s)`);
    }

    // GET /api/purchase-orders?id=xyz - Get specific purchase order
    if (req.method === 'GET' && req.query.id) {
      const id = String(req.query.id);
      
      const items = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, id))
        .limit(1);

      if (items.length === 0) {
        return notFoundResponse(res, 'Purchase order not found');
      }

      return successResponse(res, items[0], 'Purchase order retrieved successfully');
    }

    // GET /api/purchase-orders?supplierId=xyz - Get orders by supplier
    if (req.method === 'GET' && req.query.supplierId) {
      const supplierId = String(req.query.supplierId);
      
      const items = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.supplierId, supplierId))
        .orderBy(desc(purchaseOrders.createdAt));

      return successResponse(res, items, `Found ${items.length} purchase order(s) for supplier`);
    }

    // GET /api/purchase-orders - List all purchase orders
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);
      const status = req.query.status as string;

      let query = db.select().from(purchaseOrders);

      if (status) {
        query = query.where(eq(purchaseOrders.status, status));
      }

      const items = await query
        .orderBy(desc(purchaseOrders.createdAt))
        .limit(perPage)
        .offset((page - 1) * perPage);
      
      // Get total count
      const countResult = await db.select().from(purchaseOrders);
      
      return paginatedResponse(
        res,
        items,
        page,
        perPage,
        countResult.length,
        'Purchase orders retrieved successfully'
      );
    }

    // POST /api/purchase-orders - Create new purchase order
    if (req.method === 'POST') {
      const { supplierId, status, expectedDate, notes, poNumber } = req.body;

      // Validate required fields
      if (!supplierId) {
        return badRequestResponse(res, 'Missing required field: supplierId');
      }

      // Verify supplier exists
      const supplier = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);

      if (supplier.length === 0) {
        return badRequestResponse(res, 'Supplier not found');
      }

      // Validate status if provided
      const validStatuses = ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'RECEIVED', 'COMPLETED', 'CANCELLED'];
      if (status && !validStatuses.includes(status)) {
        return badRequestResponse(
          res,
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        );
      }

      // Generate PO number if not provided
      const finalPONumber = poNumber || generatePONumber();

      // Check if PO number already exists
      const existingPO = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.poNumber, finalPONumber))
        .limit(1);

      if (existingPO.length > 0) {
        return badRequestResponse(
          res,
          `Purchase order with number "${finalPONumber}" already exists`
        );
      }

      const newPO = {
        id: generateId(),
        poNumber: finalPONumber,
        supplierId,
        status: status || 'DRAFT',
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        receivedDate: null,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(purchaseOrders).values(newPO);

      return createdResponse(res, newPO, 'Purchase order created successfully');
    }

    // PUT /api/purchase-orders - Update purchase order
    if (req.method === 'PUT') {
      const { id, status, expectedDate, receivedDate, notes } = req.body;

      if (!id) {
        return badRequestResponse(res, 'Purchase order ID is required');
      }

      // Check if PO exists
      const existing = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, id))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Purchase order not found');
      }

      // Validate status if provided
      const validStatuses = ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'RECEIVED', 'COMPLETED', 'CANCELLED'];
      if (status && !validStatuses.includes(status)) {
        return badRequestResponse(
          res,
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        );
      }

      const updates: any = {
        updatedAt: new Date(),
      };

      if (status !== undefined) updates.status = status;
      if (expectedDate !== undefined) updates.expectedDate = expectedDate ? new Date(expectedDate) : null;
      if (receivedDate !== undefined) updates.receivedDate = receivedDate ? new Date(receivedDate) : null;
      if (notes !== undefined) updates.notes = notes;

      await db.update(purchaseOrders).set(updates).where(eq(purchaseOrders.id, id));

      const updated = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, id))
        .limit(1);

      return successResponse(res, updated[0], 'Purchase order updated successfully');
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Purchase orders endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
