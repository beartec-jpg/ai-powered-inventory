import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/db.js';
import { jobs } from '../lib/schema.js';
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

// Helper to generate job numbers
function generateJobNumber(): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JOB-${timestamp}-${random}`;
}

// Helper to serialize partsUsed with error handling
function serializePartsUsed(partsUsed: any): string | null {
  if (!partsUsed) return null;
  try {
    return JSON.stringify(partsUsed);
  } catch (error) {
    throw new Error('Invalid partsUsed format. Must be a valid JSON serializable array.');
  }
}

// Helper function to get jobs with user scoping and search
async function getJobs(userId: string, search?: string, customerId?: string, status?: string, page: number = 1, perPage: number = 30) {
  const conditions = [eq(jobs.userId, userId)];
  
  if (search) {
    conditions.push(
      or(
        ilike(jobs.jobNumber, `%${search}%`),
        ilike(jobs.customerName, `%${search}%`),
        ilike(jobs.description, `%${search}%`),
        ilike(jobs.equipmentName, `%${search}%`)
      )!
    );
  }

  if (customerId) {
    conditions.push(eq(jobs.customerId, customerId));
  }

  if (status) {
    conditions.push(eq(jobs.status, status));
  }

  return db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.createdAt))
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
    // GET /api/jobs?search=term - Search jobs
    if (req.method === 'GET' && req.query.search) {
      const search = String(req.query.search).toLowerCase();
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);
      const customerId = req.query.customerId as string | undefined;
      const status = req.query.status as string | undefined;
      
      const items = await getJobs(userId, search, customerId, status, page, perPage);

      return successResponse(res, items, `Found ${items.length} job(s)`);
    }

    // GET /api/jobs?id=xyz - Get specific job
    if (req.method === 'GET' && req.query.id) {
      const id = String(req.query.id);
      
      const items = await db
        .select()
        .from(jobs)
        .where(and(
          eq(jobs.id, id),
          eq(jobs.userId, userId)
        ))
        .limit(1);

      if (items.length === 0) {
        return notFoundResponse(res, 'Job not found');
      }

      return successResponse(res, items[0], 'Job retrieved successfully');
    }

    // GET /api/jobs - List all jobs
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 30, 100);
      const customerId = req.query.customerId as string | undefined;
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;

      const conditions = [eq(jobs.userId, userId)];
      if (customerId) {
        conditions.push(eq(jobs.customerId, customerId));
      }
      if (status) {
        conditions.push(eq(jobs.status, status));
      }
      if (type) {
        conditions.push(eq(jobs.type, type));
      }

      const items = await db
        .select()
        .from(jobs)
        .where(and(...conditions))
        .orderBy(desc(jobs.createdAt))
        .limit(perPage)
        .offset((page - 1) * perPage);
      
      // Get total count for this user
      const countResult = await db
        .select()
        .from(jobs)
        .where(eq(jobs.userId, userId));
      
      return paginatedResponse(
        res,
        items,
        page,
        perPage,
        countResult.length,
        'Jobs retrieved successfully'
      );
    }

    // POST /api/jobs - Create new job
    if (req.method === 'POST') {
      const { 
        jobNumber,
        customerId, 
        customerName, 
        siteAddressId, 
        siteAddress,
        equipmentId,
        equipmentName,
        type,
        priority,
        description,
        reportedFault,
        workRequired,
        assignedTo,
        assignedEngineerName,
        status,
        scheduledDate,
        scheduledTimeSlot,
        estimatedDuration,
        startedAt,
        completedAt,
        completedBy,
        workCarriedOut,
        findings,
        recommendations,
        partsUsed,
        labourHours,
        labourRate,
        partsCost,
        totalCost,
        customerSignature,
        signedByName,
        signedAt,
        followUpRequired,
        followUpNotes,
        notes,
        internalNotes
      } = req.body;

      // Validate required fields
      if (!customerId || !customerName || !type) {
        return badRequestResponse(res, 'Missing required fields: customerId, customerName, type');
      }

      // Validate type
      const validTypes = ['service', 'repair', 'installation', 'maintenance', 'quote', 'inspection'];
      if (!validTypes.includes(type)) {
        return badRequestResponse(res, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }

      // Validate priority if provided
      const validPriorities = ['low', 'normal', 'high', 'emergency'];
      if (priority && !validPriorities.includes(priority)) {
        return badRequestResponse(res, `Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
      }

      // Validate status if provided
      const validStatuses = ['quote', 'scheduled', 'dispatched', 'in_progress', 'on_hold', 'completed', 'invoiced', 'cancelled'];
      if (status && !validStatuses.includes(status)) {
        return badRequestResponse(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Serialize partsUsed with error handling
      let serializedPartsUsed: string | null = null;
      try {
        serializedPartsUsed = serializePartsUsed(partsUsed);
      } catch (error: any) {
        return badRequestResponse(res, error.message);
      }

      const newJob = {
        id: generateId(),
        userId, // Add userId for user scoping
        jobNumber: jobNumber || generateJobNumber(),
        customerId,
        customerName,
        siteAddressId: siteAddressId || null,
        siteAddress: siteAddress || null,
        equipmentId: equipmentId || null,
        equipmentName: equipmentName || null,
        type,
        priority: priority || 'normal',
        description: description || null,
        reportedFault: reportedFault || null,
        workRequired: workRequired || null,
        assignedTo: assignedTo || null,
        assignedEngineerName: assignedEngineerName || null,
        status: status || 'quote',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledTimeSlot: scheduledTimeSlot || null,
        estimatedDuration: estimatedDuration || null,
        startedAt: startedAt ? new Date(startedAt) : null,
        completedAt: completedAt ? new Date(completedAt) : null,
        completedBy: completedBy || null,
        workCarriedOut: workCarriedOut || null,
        findings: findings || null,
        recommendations: recommendations || null,
        partsUsed: serializedPartsUsed,
        labourHours: labourHours || null,
        labourRate: labourRate || null,
        partsCost: partsCost || null,
        totalCost: totalCost || null,
        customerSignature: customerSignature || null,
        signedByName: signedByName || null,
        signedAt: signedAt ? new Date(signedAt) : null,
        followUpRequired: followUpRequired || false,
        followUpNotes: followUpNotes || null,
        notes: notes || null,
        internalNotes: internalNotes || null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(jobs).values(newJob);

      return createdResponse(res, newJob, 'Job created successfully');
    }

    // PUT /api/jobs - Update job
    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;

      if (!id) {
        return badRequestResponse(res, 'Job ID is required');
      }

      // Check if job exists and belongs to this user
      const existing = await db
        .select()
        .from(jobs)
        .where(and(
          eq(jobs.id, id),
          eq(jobs.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Job not found');
      }

      // Validate type if provided
      const validTypes = ['service', 'repair', 'installation', 'maintenance', 'quote', 'inspection'];
      if (updateData.type && !validTypes.includes(updateData.type)) {
        return badRequestResponse(res, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }

      // Validate priority if provided
      const validPriorities = ['low', 'normal', 'high', 'emergency'];
      if (updateData.priority && !validPriorities.includes(updateData.priority)) {
        return badRequestResponse(res, `Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
      }

      // Validate status if provided
      const validStatuses = ['quote', 'scheduled', 'dispatched', 'in_progress', 'on_hold', 'completed', 'invoiced', 'cancelled'];
      if (updateData.status && !validStatuses.includes(updateData.status)) {
        return badRequestResponse(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Prepare update object
      const updates: any = {
        ...updateData,
        updatedAt: new Date(),
      };

      // Handle date fields
      if (updates.scheduledDate) updates.scheduledDate = new Date(updates.scheduledDate);
      if (updates.startedAt) updates.startedAt = new Date(updates.startedAt);
      if (updates.completedAt) updates.completedAt = new Date(updates.completedAt);
      if (updates.signedAt) updates.signedAt = new Date(updates.signedAt);

      // Handle partsUsed serialization with error handling
      if (updates.partsUsed && typeof updates.partsUsed === 'object') {
        try {
          updates.partsUsed = serializePartsUsed(updates.partsUsed);
        } catch (error: any) {
          return badRequestResponse(res, error.message);
        }
      }

      await db
        .update(jobs)
        .set(updates)
        .where(and(
          eq(jobs.id, id),
          eq(jobs.userId, userId)
        ));

      const updated = await db
        .select()
        .from(jobs)
        .where(and(
          eq(jobs.id, id),
          eq(jobs.userId, userId)
        ))
        .limit(1);

      return successResponse(res, updated[0], 'Job updated successfully');
    }

    // DELETE /api/jobs?id=xyz - Delete job (soft delete)
    if (req.method === 'DELETE') {
      const id = req.query.id as string;

      if (!id) {
        return badRequestResponse(res, 'Job ID is required');
      }

      // Check if job exists and belongs to this user
      const existing = await db
        .select()
        .from(jobs)
        .where(and(
          eq(jobs.id, id),
          eq(jobs.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return notFoundResponse(res, 'Job not found');
      }

      // Soft delete by setting active to false
      await db
        .update(jobs)
        .set({ active: false, updatedAt: new Date() })
        .where(and(
          eq(jobs.id, id),
          eq(jobs.userId, userId)
        ));

      return successResponse(res, { id }, 'Job deleted successfully');
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Jobs endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
