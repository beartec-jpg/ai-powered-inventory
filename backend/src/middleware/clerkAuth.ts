import { Request, Response, NextFunction } from 'express';
import { clerkMiddleware, requireAuth } from '@clerk/express';

/**
 * Clerk authentication middleware
 * Verifies Clerk tokens and attaches user info to request
 */
export const clerkAuth = clerkMiddleware();

/**
 * Require authentication middleware
 */
export const requireClerkAuth = requireAuth();

/**
 * Extract Clerk user information from request
 */
export interface ClerkUser {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export function getClerkUser(req: Request): ClerkUser | null {
  const auth = (req as any).auth;
  
  if (!auth || !auth.userId) {
    return null;
  }

  return {
    userId: auth.userId,
    email: auth.sessionClaims?.email as string | undefined,
    firstName: auth.sessionClaims?.firstName as string | undefined,
    lastName: auth.sessionClaims?.lastName as string | undefined,
  };
}

/**
 * Middleware to check if user has specific role
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = (req as any).auth;
    
    if (!auth || !auth.sessionClaims) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userRole = auth.sessionClaims.metadata?.role || 'STAFF';
    
    if (!roles.includes(userRole)) {
      res.status(403).json({ 
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}. Your role: ${userRole}`,
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication - doesn't fail if no auth token
 */
export function optionalClerkAuth(req: Request, _res: Response, next: NextFunction) {
  const auth = (req as any).auth;
  
  if (!auth || !auth.userId) {
    // No authentication, but continue anyway
    return next();
  }

  next();
}
