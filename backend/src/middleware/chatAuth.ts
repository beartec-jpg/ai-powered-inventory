// Chat Authentication Middleware
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { chatConfig } from '../config/xaiConfig';
import { UserContext } from '../types/chat';

// Mock user for now - in production, this would extract from JWT
// This is a placeholder implementation
export function extractUserContext(req: Request): UserContext | null {
  // In production, decode JWT token from Authorization header
  // For now, return a mock user context
  const userId = req.headers['x-user-id'] as string;
  const role = (req.headers['x-user-role'] as string) || 'STAFF';
  const warehouseAccess = req.headers['x-warehouse-access']
    ? (req.headers['x-warehouse-access'] as string).split(',')
    : [];

  if (!userId) {
    return null;
  }

  return {
    userId,
    role,
    warehouseAccess,
    permissions: getPermissionsForRole(role),
  };
}

/**
 * Get permissions based on role
 */
function getPermissionsForRole(role: string): string[] {
  switch (role) {
    case 'ADMIN':
      return [
        'read_inventory',
        'write_inventory',
        'transfer_stock',
        'adjust_stock',
        'create_parts_list',
        'view_reports',
        'manage_users',
      ];
    case 'MANAGER':
      return [
        'read_inventory',
        'write_inventory',
        'transfer_stock',
        'adjust_stock',
        'create_parts_list',
        'view_reports',
      ];
    case 'STAFF':
      return ['read_inventory', 'write_inventory', 'transfer_stock', 'create_parts_list'];
    case 'VIEWER':
      return ['read_inventory'];
    default:
      return [];
  }
}

/**
 * Authenticate chat request
 */
export function authenticateChat(req: Request, res: Response, next: NextFunction): void {
  const userContext = extractUserContext(req);

  if (!userContext) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required to access chat',
    });
    return;
  }

  // Attach user context to request
  (req as any).userContext = userContext;
  next();
}

/**
 * Check if user has chat access
 */
export function checkChatAccess(req: Request, res: Response, next: NextFunction): void {
  const userContext = (req as any).userContext as UserContext;

  if (!userContext) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'User context not found',
    });
    return;
  }

  // All authenticated users have chat access
  // Could add additional checks here (e.g., subscription, feature flags)
  next();
}

/**
 * Rate limiter for chat endpoints
 */
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: chatConfig.rateLimitPerHour,
  message: {
    error: 'Too Many Requests',
    message: `You have exceeded the ${chatConfig.rateLimitPerHour} messages per hour limit`,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID as key
    const userContext = (req as any).userContext as UserContext;
    return userContext?.userId || req.ip || 'anonymous';
  },
});

/**
 * Validate conversation ownership
 */
export async function validateConversationAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userContext = (req as any).userContext as UserContext;
  const conversationId = req.params.conversationId || req.body.conversationId;

  if (!conversationId) {
    next();
    return;
  }

  // In production, verify conversation belongs to user via database query
  // For now, we trust the conversation ID
  next();
}

/**
 * Middleware to check xAI service availability
 */
export function checkXAIAvailability(req: Request, res: Response, next: NextFunction): void {
  // This would check if xAI service is configured and available
  // For now, we'll assume it's available if XAI_API_KEY is set
  if (!process.env.XAI_API_KEY) {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Chat service is not configured. Please contact administrator.',
    });
    return;
  }
  next();
}
