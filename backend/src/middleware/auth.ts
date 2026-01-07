import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthService } from '../services/authService';
import { AuthRequest, UnauthorizedError } from '../types';
import { unauthorizedResponse, forbiddenResponse } from '../utils/responses';

/**
 * Middleware to authenticate requests using JWT
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse(res, 'No token provided', 'Authentication token is required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = AuthService.verifyToken(token);

    // Validate user is still active
    const isValid = await AuthService.validateUser(payload.userId);

    if (!isValid) {
      return unauthorizedResponse(res, 'Invalid token', 'User account is inactive or does not exist');
    }

    // Attach user info to request
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse(res, error.message);
    }
    return unauthorizedResponse(res, 'Authentication failed');
  }
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return unauthorizedResponse(res, 'User not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      return forbiddenResponse(
        res,
        'Insufficient permissions',
        `This action requires one of the following roles: ${roles.join(', ')}`
      );
    }

    next();
  };
}

/**
 * Middleware to check if user is admin
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void | Response {
  return requireRole(UserRole.ADMIN)(req, res, next);
}

/**
 * Middleware to check if user is admin or manager
 */
export function requireManager(req: AuthRequest, res: Response, next: NextFunction): void | Response {
  return requireRole(UserRole.ADMIN, UserRole.MANAGER)(req, res, next);
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = AuthService.verifyToken(token);

      // Validate user is still active
      const isValid = await AuthService.validateUser(payload.userId);

      if (isValid) {
        req.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
        };
      }
    }
  } catch (error) {
    // Silently fail for optional auth
  }

  next();
}
