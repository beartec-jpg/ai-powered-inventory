import { Router, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthRequest } from '../types';
import { validate, registerSchema, loginSchema } from '../utils/validators';
import {
  successResponse,
  createdResponse,
  badRequestResponse,
  unauthorizedResponse,
  internalServerErrorResponse,
} from '../utils/responses';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', validate(registerSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    const result = await AuthService.register(email, password, name, role);

    return createdResponse(
      res,
      {
        user: result.user,
        token: result.tokens.token,
        refreshToken: result.tokens.refreshToken,
      },
      'User registered successfully'
    );
  } catch (error: any) {
    if (error.statusCode === 409) {
      return badRequestResponse(res, error.message);
    }
    console.error('Registration error:', error);
    return internalServerErrorResponse(res, 'Failed to register user');
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', validate(loginSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    const result = await AuthService.login(email, password);

    return successResponse(
      res,
      {
        user: result.user,
        token: result.tokens.token,
        refreshToken: result.tokens.refreshToken,
      },
      'Login successful'
    );
  } catch (error: any) {
    if (error.statusCode === 401) {
      return unauthorizedResponse(res, error.message);
    }
    console.error('Login error:', error);
    return internalServerErrorResponse(res, 'Failed to login');
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return badRequestResponse(res, 'Refresh token is required');
    }

    const tokens = await AuthService.refreshToken(refreshToken);

    return successResponse(
      res,
      {
        token: tokens.token,
        refreshToken: tokens.refreshToken,
      },
      'Token refreshed successfully'
    );
  } catch (error: any) {
    if (error.statusCode === 401) {
      return unauthorizedResponse(res, error.message);
    }
    console.error('Token refresh error:', error);
    return internalServerErrorResponse(res, 'Failed to refresh token');
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  // In a JWT system, logout is typically handled client-side by removing the token
  // For server-side logout, you would need to implement token blacklisting
  return successResponse(res, null, 'Logout successful');
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return unauthorizedResponse(res, 'User not authenticated');
    }

    const user = await AuthService.getUserById(req.user.id);

    if (!user) {
      return unauthorizedResponse(res, 'User not found');
    }

    return successResponse(res, user);
  } catch (error) {
    console.error('Get user error:', error);
    return internalServerErrorResponse(res, 'Failed to get user information');
  }
});

export default router;
