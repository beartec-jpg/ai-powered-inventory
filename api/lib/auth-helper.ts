import { VercelRequest } from '@vercel/node';

/**
 * Extract Clerk user ID from request headers
 * 
 * This helper extracts the authenticated user's Clerk ID from the request.
 * It checks the custom 'x-clerk-user-id' header that should be set by the frontend.
 * 
 * For production use, you should verify the JWT token from Clerk to ensure
 * the user ID hasn't been tampered with. For now, we trust the header.
 * 
 * @param req - Vercel request object
 * @returns Clerk user ID or null if not authenticated
 */
export function extractClerkUserId(req: VercelRequest): string | null {
  // Check for x-clerk-user-id header (set by frontend)
  const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;
  
  if (clerkUserId && typeof clerkUserId === 'string' && clerkUserId.trim()) {
    return clerkUserId.trim();
  }
  
  // TODO: For production, also verify the JWT token from Authorization header
  // const authHeader = req.headers.authorization;
  // if (authHeader && authHeader.startsWith('Bearer ')) {
  //   const token = authHeader.substring(7);
  //   // Verify token with Clerk's public key
  //   // const decoded = await verifyClerkToken(token);
  //   // return decoded.sub; // Clerk user ID
  // }
  
  return null;
}

/**
 * Check if request is authenticated
 * 
 * @param req - Vercel request object
 * @returns true if authenticated, false otherwise
 */
export function isAuthenticated(req: VercelRequest): boolean {
  return extractClerkUserId(req) !== null;
}
