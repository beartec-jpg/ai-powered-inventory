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

  // Complete list of all valid actions from classify-intent.ts and parse-command.ts
  const validActions = [
    // Stock Management (from classify-intent)
    'ADD_STOCK',
    'REMOVE_STOCK',
    'TRANSFER_STOCK',
    'COUNT_STOCK',
    'SEARCH_STOCK',
    'LOW_STOCK_REPORT',
    
    // Stock Management (from parse-command / executor)
    'RECEIVE_STOCK',
    'PUT_AWAY_STOCK',
    'USE_STOCK',
    'STOCK_COUNT',
    'SET_MIN_STOCK',
    
    // Catalogue Management
    'ADD_PRODUCT',
    'UPDATE_PRODUCT',
    'CREATE_PRODUCT',
    'CREATE_CATALOGUE_ITEM',
    'UPDATE_CATALOGUE_ITEM',
    'SEARCH_CATALOGUE',
    
    // Customer Management
    'ADD_CUSTOMER',
    'UPDATE_CUSTOMER',
    'CREATE_CUSTOMER',
    'ADD_SITE',
    'ADD_SITE_ADDRESS',
    'SEARCH_CUSTOMERS',
    
    // Equipment Management
    'ADD_EQUIPMENT',
    'CREATE_EQUIPMENT',
    'UPDATE_EQUIPMENT',
    'LIST_EQUIPMENT',
    'SEARCH_EQUIPMENT',
    'INSTALL_PART',
    'INSTALL_FROM_STOCK',
    'INSTALL_DIRECT_ORDER',
    'QUERY_EQUIPMENT_PARTS',
    'QUERY_CUSTOMER_PARTS',
    
    // Job Management
    'CREATE_JOB',
    'UPDATE_JOB',
    'SCHEDULE_JOB',
    'START_JOB',
    'COMPLETE_JOB',
    'ADD_PARTS_TO_JOB',
    'ADD_PART_TO_JOB',
    'LIST_JOBS',
    'SEARCH_JOBS',
    
    // Supplier & Order Management
    'ADD_SUPPLIER',
    'CREATE_SUPPLIER',
    'CREATE_ORDER',
    'CREATE_PURCHASE_ORDER',
    'RECEIVE_ORDER',
    'RECEIVE_PURCHASE_ORDER',
    
    // Special Actions
    'CREATE_CATALOGUE_ITEM_AND_ADD_STOCK',
    
    // Legacy & Fallback
    'ADJUST_STOCK',
    'QUERY_INVENTORY',
  ];

  if (!validActions.includes(validated.action)) {
    console.warn(`[validateCommandResponse] Unknown action: ${validated.action}, defaulting to QUERY_INVENTORY`);
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
