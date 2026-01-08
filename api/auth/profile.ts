import { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { userProfiles, warehouseAccesses, warehouses } from '../lib/schema';
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
  setCorsHeaders,
} from '../lib/utils';

/**
 * Get user profile with role and warehouse access
 * Endpoint: GET /api/auth/profile
 * 
 * Headers:
 *   Authorization: Bearer <clerk-token>
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     id: "uuid",
 *     clerk_user_id: "user_123",
 *     email: "user@example.com",
 *     full_name: "John Doe",
 *     role: "MANAGER",
 *     phone: "+1234567890",
 *     warehouse_access: [
 *       {
 *         warehouse_id: "warehouse-1",
 *         warehouse_name: "Main Warehouse",
 *         access_level: "EDIT"
 *       }
 *     ]
 *   }
 * }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  }

  try {
    // Get Clerk user ID from header (in production, verify the JWT token)
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse(res, 'No authorization token provided');
    }

    // Extract clerk_user_id from the token
    // In production, use Clerk's JWT verification here
    const clerkUserId = req.headers['x-clerk-user-id'] as string;
    
    if (!clerkUserId) {
      return unauthorizedResponse(res, 'Invalid authorization token');
    }

    // Fetch user profile
    const userProfileResult = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkUserId, clerkUserId))
      .limit(1);

    if (userProfileResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User profile not found. Please contact an administrator.',
      });
    }

    const userProfile = userProfileResult[0];

    // Fetch warehouse access
    const warehouseAccessResult = await db
      .select({
        warehouseId: warehouseAccesses.warehouseId,
        warehouseName: warehouses.name,
        accessLevel: warehouseAccesses.accessLevel,
      })
      .from(warehouseAccesses)
      .innerJoin(warehouses, eq(warehouseAccesses.warehouseId, warehouses.id))
      .where(eq(warehouseAccesses.userProfileId, userProfile.id));

    // Format response
    const response = {
      id: userProfile.id,
      clerk_user_id: userProfile.clerkUserId,
      email: userProfile.email,
      full_name: userProfile.fullName,
      role: userProfile.role,
      phone: userProfile.phone,
      warehouse_access: warehouseAccessResult.map((wa) => ({
        warehouse_id: wa.warehouseId,
        warehouse_name: wa.warehouseName,
        access_level: wa.accessLevel,
      })),
    };

    return successResponse(res, response);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return errorResponse(res, 'Failed to fetch user profile', 500);
  }
}
