import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types';

/**
 * Send a successful response
 */
export function successResponse<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
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
  res: Response,
  data: T,
  page: number,
  perPage: number,
  total: number,
  message?: string
): Response {
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
  res: Response,
  error: string,
  statusCode: number = 500,
  message?: string
): Response {
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
  res: Response,
  data: T,
  message: string = 'Resource created successfully'
): Response {
  return successResponse(res, data, message, 201);
}

/**
 * Send a no content response (204)
 */
export function noContentResponse(res: Response): Response {
  return res.status(204).send();
}

/**
 * Send a bad request response (400)
 */
export function badRequestResponse(
  res: Response,
  error: string,
  message: string = 'Bad Request'
): Response {
  return errorResponse(res, error, 400, message);
}

/**
 * Send an unauthorized response (401)
 */
export function unauthorizedResponse(
  res: Response,
  error: string = 'Unauthorized',
  message: string = 'Authentication required'
): Response {
  return errorResponse(res, error, 401, message);
}

/**
 * Send a forbidden response (403)
 */
export function forbiddenResponse(
  res: Response,
  error: string = 'Forbidden',
  message: string = 'You do not have permission to access this resource'
): Response {
  return errorResponse(res, error, 403, message);
}

/**
 * Send a not found response (404)
 */
export function notFoundResponse(
  res: Response,
  error: string = 'Not Found',
  message: string = 'The requested resource was not found'
): Response {
  return errorResponse(res, error, 404, message);
}

/**
 * Send a conflict response (409)
 */
export function conflictResponse(
  res: Response,
  error: string,
  message: string = 'Conflict'
): Response {
  return errorResponse(res, error, 409, message);
}

/**
 * Send an internal server error response (500)
 */
export function internalServerErrorResponse(
  res: Response,
  error: string = 'Internal Server Error',
  message: string = 'An unexpected error occurred'
): Response {
  return errorResponse(res, error, 500, message);
}
