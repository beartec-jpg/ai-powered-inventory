import { VercelResponse } from '@vercel/node';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Send a successful response
 */
export function successResponse<T>(
  res: VercelResponse,
  data: T,
  message?: string,
  statusCode: number = 200
): VercelResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
}

/**
 * Send a paginated successful response
 */
export function paginatedResponse<T>(
  res: VercelResponse,
  data: T,
  page: number,
  perPage: number,
  total: number,
  message?: string
): VercelResponse {
  const totalPages = Math.ceil(total / perPage);
  
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    message,
    pagination: {
      page,
      perPage,
      total,
      totalPages,
    },
    timestamp: new Date().toISOString(),
  };
  return res.status(200).json(response);
}

/**
 * Send an error response
 */
export function errorResponse(
  res: VercelResponse,
  error: string,
  statusCode: number = 500,
  message?: string
): VercelResponse {
  const response: ApiResponse = {
    success: false,
    error,
    message,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
}

/**
 * Send a created response (201)
 */
export function createdResponse<T>(
  res: VercelResponse,
  data: T,
  message: string = 'Resource created successfully'
): VercelResponse {
  return successResponse(res, data, message, 201);
}

/**
 * Send a bad request response (400)
 */
export function badRequestResponse(
  res: VercelResponse,
  message: string = 'Bad Request'
): VercelResponse {
  return errorResponse(res, 'Bad Request', 400, message);
}

/**
 * Send an unauthorized response (401)
 */
export function unauthorizedResponse(
  res: VercelResponse,
  message: string = 'Authentication required'
): VercelResponse {
  return errorResponse(res, 'Unauthorized', 401, message);
}

/**
 * Send a forbidden response (403)
 */
export function forbiddenResponse(
  res: VercelResponse,
  message: string = 'You do not have permission to access this resource'
): VercelResponse {
  return errorResponse(res, 'Forbidden', 403, message);
}

/**
 * Send a not found response (404)
 */
export function notFoundResponse(
  res: VercelResponse,
  message: string = 'The requested resource was not found'
): VercelResponse {
  return errorResponse(res, 'Not Found', 404, message);
}

/**
 * Send a conflict response (409)
 */
export function conflictResponse(
  res: VercelResponse,
  message: string = 'Conflict'
): VercelResponse {
  return errorResponse(res, 'Conflict', 409, message);
}

/**
 * Send an internal server error response (500)
 */
export function internalServerErrorResponse(
  res: VercelResponse,
  message: string = 'An unexpected error occurred'
): VercelResponse {
  return errorResponse(res, 'Internal Server Error', 500, message);
}

/**
 * Enable CORS for Vercel functions
 */
export function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

/**
 * Validate command response structure
 */
export function validateCommandResponse(response: Record<string, any>): Record<string, any> {
  // Constants
  const DEFAULT_CONFIDENCE = 0.5;

  // Create a copy to avoid mutating the input
  const validated = { ...response };

  // Ensure action is valid
  const validActions = [
    'ADJUST_STOCK',
    'TRANSFER_STOCK',
    'CREATE_PRODUCT',
    'UPDATE_PRODUCT',
    'QUERY_INVENTORY',
  ];

  if (!validActions.includes(validated.action)) {
    validated.action = 'QUERY_INVENTORY';
  }

  // Ensure confidence is between 0 and 1
  if (typeof validated.confidence !== 'number' || validated.confidence < 0 || validated.confidence > 1) {
    validated.confidence = DEFAULT_CONFIDENCE;
  }

  // Ensure parameters is an object
  if (typeof validated.parameters !== 'object' || validated.parameters === null) {
    validated.parameters = {};
  }

  // Ensure reasoning is a string
  if (typeof validated.reasoning !== 'string') {
    validated.reasoning = 'Command parsed successfully';
  }

  // Ensure clarificationNeeded is string or undefined
  if (validated.clarificationNeeded !== undefined && typeof validated.clarificationNeeded !== 'string') {
    delete validated.clarificationNeeded;
  }

  return validated;
}
