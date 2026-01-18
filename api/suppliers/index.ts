import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db.js';
import { suppliers } from '../lib/schema.js';
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
    // GET /api/suppliers?search=term - Search suppliers
    if (req.method === 'GET' && req.query.search) {
      const search = String(req.query.search).toLowerCase();
      
      const items = await db
        .select()
        .from(suppliers)
        .where(
          or(
            ilike(suppliers.name, `%${search}%`),
            ilike(suppliers.email, `%${search}%`),
            ilike(suppliers.city, `%${search}%`)
          )
        )
        .orderBy(desc(suppliers.createdAt));

      return successResponse(res, items, `Found ${items.length} supplier(s)`);
    }

    // GET /api/suppliers?id=xyz - Get specific supplier
    if (req.method === 'GET' && req.query.id) {
      const id = String(req.query.id);
      
      const items = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, id))
        .limit(1);

      if (items.length === 0) {
        return notFoundResponse(res, 'Supplier not found');
      }

      return successResponse(res, items[0], 'Supplier retrieved successfully');
    }

    // GET /api/suppliers - List all suppliers
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);

      const items = await db
        .select()
        .from(suppliers)
        .orderBy(desc(suppliers.createdAt))
        .limit(perPage)
        .offset((page - 1) * perPage);
      
      // Get total count
      const countResult = await db.select().from(suppliers);
      
      return paginatedResponse(
        res,
        items,
        page,
        perPage,
        countResult.length,
        'Suppliers retrieved successfully'
      );
    }

    // POST /api/suppliers - Create new supplier
    if (req.method === 'POST') {
      const { name, email, phone, address, city, country } = req.body;

      // Validate required fields
      if (!name) {
        return badRequestResponse(res, 'Missing required field: name');
      }

      // Check if supplier with same name already exists
      const existing = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.name, name))
        .limit(1);

      if (existing.length > 0) {
        return badRequestResponse(
          res,
          `Supplier with name "${name}" already exists`
        );
      }

      const newSupplier = {
        id: generateId(),
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        country: country || null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(suppliers).values(newSupplier);

      return createdResponse(res, newSupplier, 'Supplier created successfully');
    }

    // PUT /api/suppliers - Update supplier
    if (req.method === 'PUT') {
      const { id, name, email, phone, address, city, country, active } = req.body;

      if (!id) {
        return badRequestResponse(res, 'Supplier ID is required');
      }

      // Check if supplier exists
      const existing = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, id))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Supplier not found');
      }

      const updates: Partial<typeof suppliers.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email || null;
      if (phone !== undefined) updates.phone = phone || null;
      if (address !== undefined) updates.address = address || null;
      if (city !== undefined) updates.city = city || null;
      if (country !== undefined) updates.country = country || null;
      if (active !== undefined) updates.active = active;

      await db.update(suppliers).set(updates).where(eq(suppliers.id, id));

      const updated = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, id))
        .limit(1);

      return successResponse(res, updated[0], 'Supplier updated successfully');
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Suppliers endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
