import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db.js';
import { customers } from '../lib/schema.js';
import { eq, ilike, desc, or, and } from 'drizzle-orm';
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

// Helper function to get customers with user scoping and search
async function getCustomers(userId: string, search?: string, page: number = 1, perPage: number = 30) {
  const conditions = [eq(customers.userId, userId)];
  
  if (search) {
    conditions.push(
      or(
        ilike(customers.name, `%${search}%`),
        ilike(customers.email, `%${search}%`),
        ilike(customers.contactName, `%${search}%`),
        ilike(customers.accountNumber, `%${search}%`)
      )!
    );
  }

  return db
    .select()
    .from(customers)
    .where(and(...conditions))
    .orderBy(desc(customers.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);
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
    // GET /api/customers?search=term - Search customers
    if (req.method === 'GET' && req.query.search) {
      const search = String(req.query.search).toLowerCase();
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);
      
      const items = await getCustomers(userId, search, page, perPage);

      return successResponse(res, items, `Found ${items.length} customer(s)`);
    }

    // GET /api/customers?id=xyz - Get specific customer
    if (req.method === 'GET' && req.query.id) {
      const id = String(req.query.id);
      
      const items = await db
        .select()
        .from(customers)
        .where(and(
          eq(customers.id, id),
          eq(customers.userId, userId)
        ))
        .limit(1);

      if (items.length === 0) {
        return notFoundResponse(res, 'Customer not found');
      }

      return successResponse(res, items[0], 'Customer retrieved successfully');
    }

    // GET /api/customers - List all customers
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);
      const type = req.query.type as string;

      const conditions = [eq(customers.userId, userId)];
      if (type) {
        conditions.push(eq(customers.type, type));
      }

      const items = await db
        .select()
        .from(customers)
        .where(and(...conditions))
        .orderBy(desc(customers.createdAt))
        .limit(perPage)
        .offset((page - 1) * perPage);
      
      // Get total count for this user
      const countResult = await db
        .select()
        .from(customers)
        .where(eq(customers.userId, userId));
      
      return paginatedResponse(
        res,
        items,
        page,
        perPage,
        countResult.length,
        'Customers retrieved successfully'
      );
    }

    // POST /api/customers - Create new customer
    if (req.method === 'POST') {
      const { 
        name, 
        type, 
        contactName, 
        email, 
        phone, 
        mobile, 
        billingAddress, 
        accountNumber, 
        vatNumber, 
        paymentTerms, 
        notes, 
        tags 
      } = req.body;

      // Validate required fields
      if (!name || !type) {
        return badRequestResponse(res, 'Missing required fields: name, type');
      }

      // Validate type
      if (!['commercial', 'residential', 'industrial'].includes(type)) {
        return badRequestResponse(res, 'Invalid type. Must be one of: commercial, residential, industrial');
      }

      // Serialize tags with error handling
      let serializedTags: string | null = null;
      if (tags) {
        try {
          serializedTags = JSON.stringify(tags);
        } catch (error) {
          return badRequestResponse(res, 'Invalid tags format. Must be a valid JSON serializable array.');
        }
      }

      const newCustomer = {
        id: generateId(),
        userId, // Add userId for user scoping
        name,
        type,
        contactName: contactName || null,
        email: email || null,
        phone: phone || null,
        mobile: mobile || null,
        billingAddress: billingAddress || null,
        accountNumber: accountNumber || null,
        vatNumber: vatNumber || null,
        paymentTerms: paymentTerms || null,
        notes: notes || null,
        tags: serializedTags,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(customers).values(newCustomer);

      return createdResponse(res, newCustomer, 'Customer created successfully');
    }

    // PUT /api/customers - Update customer
    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;

      if (!id) {
        return badRequestResponse(res, 'Customer ID is required');
      }

      // Check if customer exists and belongs to this user
      const existing = await db
        .select()
        .from(customers)
        .where(and(
          eq(customers.id, id),
          eq(customers.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Customer not found');
      }

      // Validate type if provided
      if (updateData.type && !['commercial', 'residential', 'industrial'].includes(updateData.type)) {
        return badRequestResponse(res, 'Invalid type. Must be one of: commercial, residential, industrial');
      }

      // Prepare update object
      const updates: any = {
        ...updateData,
        updatedAt: new Date(),
      };

      // Handle tags serialization with error handling
      if (updates.tags && typeof updates.tags === 'object') {
        try {
          updates.tags = JSON.stringify(updates.tags);
        } catch (error) {
          return badRequestResponse(res, 'Invalid tags format. Must be a valid JSON serializable array.');
        }
      }

      await db
        .update(customers)
        .set(updates)
        .where(and(
          eq(customers.id, id),
          eq(customers.userId, userId)
        ));

      const updated = await db
        .select()
        .from(customers)
        .where(and(
          eq(customers.id, id),
          eq(customers.userId, userId)
        ))
        .limit(1);

      return successResponse(res, updated[0], 'Customer updated successfully');
    }

    // DELETE /api/customers?id=xyz - Delete customer (soft delete)
    if (req.method === 'DELETE') {
      const id = req.query.id as string;

      if (!id) {
        return badRequestResponse(res, 'Customer ID is required');
      }

      // Check if customer exists and belongs to this user
      const existing = await db
        .select()
        .from(customers)
        .where(and(
          eq(customers.id, id),
          eq(customers.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Customer not found');
      }

      // Soft delete by setting active to false
      await db
        .update(customers)
        .set({ active: false, updatedAt: new Date() })
        .where(and(
          eq(customers.id, id),
          eq(customers.userId, userId)
        ));

      return successResponse(res, { id }, 'Customer deleted successfully');
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Customers endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
