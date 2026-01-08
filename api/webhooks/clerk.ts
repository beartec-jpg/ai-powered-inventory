import { VercelRequest, VercelResponse } from '@vercel/node';
import { Webhook } from 'svix';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { userProfiles } from '../lib/schema.js';
import { successResponse, errorResponse } from '../lib/utils.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Clerk webhook handler for user synchronization
 * Endpoint: POST /api/webhooks/clerk
 * 
 * This webhook is triggered by Clerk when:
 * - A user is created (user.created)
 * - A user is updated (user.updated)
 * - A user is deleted (user.deleted)
 * 
 * Setup:
 * 1. Go to Clerk Dashboard > Webhooks
 * 2. Add endpoint: https://your-domain.com/api/webhooks/clerk
 * 3. Subscribe to: user.created, user.updated, user.deleted
 * 4. Copy the webhook secret to CLERK_WEBHOOK_SECRET env var
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  }

  try {
    // Verify webhook signature
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('CLERK_WEBHOOK_SECRET is not set');
      return errorResponse(res, 'Webhook secret not configured', 500);
    }

    // Get the Svix headers for verification
    const svixId = req.headers['svix-id'] as string;
    const svixTimestamp = req.headers['svix-timestamp'] as string;
    const svixSignature = req.headers['svix-signature'] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing Svix headers',
      });
    }

    // Create Svix instance
    const wh = new Webhook(webhookSecret);

    let evt: any;

    try {
      // Verify the webhook
      evt = wh.verify(JSON.stringify(req.body), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid webhook signature',
      });
    }

    // Handle different event types
    const { type, data } = evt;

    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      case 'user.updated':
        await handleUserUpdated(data);
        break;
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      default:
        console.log(`Unhandled webhook event type: ${type}`);
    }

    return successResponse(res, { received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return errorResponse(res, 'Failed to process webhook', 500);
  }
}

/**
 * Handle user.created event
 * Creates a new user profile in the database
 */
async function handleUserCreated(data: any) {
  const { id, email_addresses, first_name, last_name, phone_numbers } = data;

  const primaryEmail = email_addresses?.find((e: any) => e.id === data.primary_email_address_id)?.email_address;
  const primaryPhone = phone_numbers?.find((p: any) => p.id === data.primary_phone_number_id)?.phone_number;

  const fullName = [first_name, last_name].filter(Boolean).join(' ') || null;

  try {
    await db.insert(userProfiles).values({
      id: uuidv4(),
      clerkUserId: id,
      email: primaryEmail || '',
      fullName,
      phone: primaryPhone,
      role: 'VIEWER', // Default role for new users
      active: true,
    });

    console.log(`Created user profile for Clerk user: ${id}`);
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
}

/**
 * Handle user.updated event
 * Updates an existing user profile
 */
async function handleUserUpdated(data: any) {
  const { id, email_addresses, first_name, last_name, phone_numbers } = data;

  const primaryEmail = email_addresses?.find((e: any) => e.id === data.primary_email_address_id)?.email_address;
  const primaryPhone = phone_numbers?.find((p: any) => p.id === data.primary_phone_number_id)?.phone_number;

  const fullName = [first_name, last_name].filter(Boolean).join(' ') || null;

  try {
    await db
      .update(userProfiles)
      .set({
        email: primaryEmail || '',
        fullName,
        phone: primaryPhone,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.clerkUserId, id));

    console.log(`Updated user profile for Clerk user: ${id}`);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

/**
 * Handle user.deleted event
 * Marks user profile as inactive (soft delete)
 */
async function handleUserDeleted(data: any) {
  const { id } = data;

  try {
    await db
      .update(userProfiles)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.clerkUserId, id));

    console.log(`Deactivated user profile for Clerk user: ${id}`);
  } catch (error) {
    console.error('Error deactivating user profile:', error);
    throw error;
  }
}
