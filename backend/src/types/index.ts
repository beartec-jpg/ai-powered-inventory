import { Request } from 'express';
import { UserRole } from '@prisma/client';

// Extended Request with authenticated user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  token: string;
  refreshToken?: string;
}

// Product Types
export interface ProductCreateRequest {
  sku: string;
  name: string;
  description?: string;
  category: string;
  unitPrice: number;
  unit?: string;
}

export interface ProductUpdateRequest {
  name?: string;
  description?: string;
  category?: string;
  unitPrice?: number;
  unit?: string;
  active?: boolean;
}

export interface ProductListQuery {
  page?: number;
  perPage?: number;
  category?: string;
  active?: boolean;
  search?: string;
}

// Stock Types
export interface StockAdjustmentRequest {
  productId: string;
  warehouseId: string;
  quantity: number;
  reason: string;
  notes?: string;
}

export interface StockTransferRequest {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  notes?: string;
}

export interface StockQuery {
  warehouseId?: string;
  productId?: string;
  lowStock?: boolean;
}

// Warehouse Types
export interface WarehouseCreateRequest {
  name: string;
  location: string;
  capacity: number;
}

export interface WarehouseUpdateRequest {
  name?: string;
  location?: string;
  capacity?: number;
  active?: boolean;
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  perPage?: number;
}

// Error Types
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, message);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(404, message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}
