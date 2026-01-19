import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db.js';
import { equipment } from '../lib/schema.js';
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

// Helper function to get equipment with user scoping and search
async function getEquipment(userId: string, search?: string, customerId?: string, page: number = 1, perPage: number = 30) {
  const conditions = [eq(equipment.userId, userId)];
  
  if (search) {
    conditions.push(
      or(
        ilike(equipment.name, `%${search}%`),
        ilike(equipment.customerName, `%${search}%`),
        ilike(equipment.type, `%${search}%`),
        ilike(equipment.manufacturer, `%${search}%`),
        ilike(equipment.serialNumber, `%${search}%`)
      )!
    );
  }

  if (customerId) {
    conditions.push(eq(equipment.customerId, customerId));
  }

  return db
    .select()
    .from(equipment)
    .where(and(...conditions))
    .orderBy(desc(equipment.createdAt))
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
    // GET /api/equipment?search=term - Search equipment
    if (req.method === 'GET' && req.query.search) {
      const search = String(req.query.search).toLowerCase();
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);
      const customerId = req.query.customerId as string | undefined;
      
      const items = await getEquipment(userId, search, customerId, page, perPage);

      return successResponse(res, items, `Found ${items.length} equipment item(s)`);
    }

    // GET /api/equipment?id=xyz - Get specific equipment
    if (req.method === 'GET' && req.query.id) {
      const id = String(req.query.id);
      
      const items = await db
        .select()
        .from(equipment)
        .where(and(
          eq(equipment.id, id),
          eq(equipment.userId, userId)
        ))
        .limit(1);

      if (items.length === 0) {
        return notFoundResponse(res, 'Equipment not found');
      }

      return successResponse(res, items[0], 'Equipment retrieved successfully');
    }

    // GET /api/equipment - List all equipment
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);
      const customerId = req.query.customerId as string | undefined;
      const type = req.query.type as string | undefined;

      const conditions = [eq(equipment.userId, userId)];
      if (customerId) {
        conditions.push(eq(equipment.customerId, customerId));
      }
      if (type) {
        conditions.push(eq(equipment.type, type));
      }

      const items = await db
        .select()
        .from(equipment)
        .where(and(...conditions))
        .orderBy(desc(equipment.createdAt))
        .limit(perPage)
        .offset((page - 1) * perPage);
      
      // Get total count for this user
      const countResult = await db
        .select()
        .from(equipment)
        .where(eq(equipment.userId, userId));
      
      return paginatedResponse(
        res,
        items,
        page,
        perPage,
        countResult.length,
        'Equipment retrieved successfully'
      );
    }

    // POST /api/equipment - Create new equipment
    if (req.method === 'POST') {
      const { 
        customerId, 
        customerName, 
        siteAddressId, 
        name, 
        type, 
        manufacturer, 
        model, 
        serialNumber,
        location,
        accessNotes,
        installDate,
        warrantyExpiry,
        serviceInterval,
        lastServiceDate,
        nextServiceDue,
        contractType,
        contractExpiry,
        technicalNotes,
        qrCode
      } = req.body;

      // Validate required fields
      if (!customerId || !customerName || !name || !type) {
        return badRequestResponse(res, 'Missing required fields: customerId, customerName, name, type');
      }

      const newEquipment = {
        id: generateId(),
        userId, // Add userId for user scoping
        customerId,
        customerName,
        siteAddressId: siteAddressId || null,
        name,
        type,
        manufacturer: manufacturer || null,
        model: model || null,
        serialNumber: serialNumber || null,
        location: location || null,
        accessNotes: accessNotes || null,
        installDate: installDate ? new Date(installDate) : null,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        serviceInterval: serviceInterval || null,
        lastServiceDate: lastServiceDate ? new Date(lastServiceDate) : null,
        nextServiceDue: nextServiceDue ? new Date(nextServiceDue) : null,
        contractType: contractType || null,
        contractExpiry: contractExpiry ? new Date(contractExpiry) : null,
        technicalNotes: technicalNotes || null,
        qrCode: qrCode || null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(equipment).values(newEquipment);

      return createdResponse(res, newEquipment, 'Equipment created successfully');
    }

    // PUT /api/equipment - Update equipment
    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;

      if (!id) {
        return badRequestResponse(res, 'Equipment ID is required');
      }

      // Check if equipment exists and belongs to this user
      const existing = await db
        .select()
        .from(equipment)
        .where(and(
          eq(equipment.id, id),
          eq(equipment.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Equipment not found');
      }

      // Prepare update object
      const updates: any = {
        ...updateData,
        updatedAt: new Date(),
      };

      // Handle date fields
      if (updates.installDate) updates.installDate = new Date(updates.installDate);
      if (updates.warrantyExpiry) updates.warrantyExpiry = new Date(updates.warrantyExpiry);
      if (updates.lastServiceDate) updates.lastServiceDate = new Date(updates.lastServiceDate);
      if (updates.nextServiceDue) updates.nextServiceDue = new Date(updates.nextServiceDue);
      if (updates.contractExpiry) updates.contractExpiry = new Date(updates.contractExpiry);

      await db
        .update(equipment)
        .set(updates)
        .where(and(
          eq(equipment.id, id),
          eq(equipment.userId, userId)
        ));

      const updated = await db
        .select()
        .from(equipment)
        .where(and(
          eq(equipment.id, id),
          eq(equipment.userId, userId)
        ))
        .limit(1);

      return successResponse(res, updated[0], 'Equipment updated successfully');
    }

    // DELETE /api/equipment?id=xyz - Delete equipment (soft delete)
    if (req.method === 'DELETE') {
      const id = req.query.id as string;

      if (!id) {
        return badRequestResponse(res, 'Equipment ID is required');
      }

      // Check if equipment exists and belongs to this user
      const existing = await db
        .select()
        .from(equipment)
        .where(and(
          eq(equipment.id, id),
          eq(equipment.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Equipment not found');
      }

      // Soft delete by setting active to false
      await db
        .update(equipment)
        .set({ active: false, updatedAt: new Date() })
        .where(and(
          eq(equipment.id, id),
          eq(equipment.userId, userId)
        ));

      return successResponse(res, { id }, 'Equipment deleted successfully');
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Equipment endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
