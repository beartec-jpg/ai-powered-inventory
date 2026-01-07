import Joi from 'joi';
import { UserRole } from '@prisma/client';

// Pagination validation
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(100).default(30),
});

// Auth validation schemas
export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password must not exceed 128 characters',
    'any.required': 'Password is required',
  }),
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name must not exceed 100 characters',
    'any.required': 'Name is required',
  }),
  role: Joi.string().valid(...Object.values(UserRole)).optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

// Product validation schemas
export const productCreateSchema = Joi.object({
  sku: Joi.string()
    .pattern(/^[A-Z0-9-]+$/)
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'SKU must contain only uppercase letters, numbers, and hyphens',
      'string.min': 'SKU must be at least 3 characters long',
      'string.max': 'SKU must not exceed 50 characters',
      'any.required': 'SKU is required',
    }),
  name: Joi.string().min(2).max(200).required().messages({
    'string.min': 'Product name must be at least 2 characters long',
    'string.max': 'Product name must not exceed 200 characters',
    'any.required': 'Product name is required',
  }),
  description: Joi.string().max(1000).optional().allow(''),
  category: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Category must be at least 2 characters long',
    'string.max': 'Category must not exceed 100 characters',
    'any.required': 'Category is required',
  }),
  unitPrice: Joi.number().positive().precision(2).required().messages({
    'number.positive': 'Unit price must be a positive number',
    'any.required': 'Unit price is required',
  }),
  unit: Joi.string().max(20).optional().default('pcs'),
});

export const productUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(200).optional(),
  description: Joi.string().max(1000).optional().allow(''),
  category: Joi.string().min(2).max(100).optional(),
  unitPrice: Joi.number().positive().precision(2).optional(),
  unit: Joi.string().max(20).optional(),
  active: Joi.boolean().optional(),
}).min(1);

export const productListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(100).default(30),
  category: Joi.string().optional(),
  active: Joi.boolean().optional(),
  search: Joi.string().max(100).optional(),
});

// Stock validation schemas
export const stockAdjustmentSchema = Joi.object({
  productId: Joi.string().required().messages({
    'any.required': 'Product ID is required',
  }),
  warehouseId: Joi.string().required().messages({
    'any.required': 'Warehouse ID is required',
  }),
  quantity: Joi.number().integer().required().messages({
    'any.required': 'Quantity is required',
  }),
  reason: Joi.string().min(3).max(200).required().messages({
    'string.min': 'Reason must be at least 3 characters long',
    'string.max': 'Reason must not exceed 200 characters',
    'any.required': 'Reason is required',
  }),
  notes: Joi.string().max(500).optional().allow(''),
});

export const stockTransferSchema = Joi.object({
  productId: Joi.string().required().messages({
    'any.required': 'Product ID is required',
  }),
  fromWarehouseId: Joi.string().required().messages({
    'any.required': 'Source warehouse ID is required',
  }),
  toWarehouseId: Joi.string().required().messages({
    'any.required': 'Destination warehouse ID is required',
  }),
  quantity: Joi.number().integer().positive().required().messages({
    'number.positive': 'Quantity must be a positive number',
    'any.required': 'Quantity is required',
  }),
  notes: Joi.string().max(500).optional().allow(''),
}).custom((value, helpers) => {
  if (value.fromWarehouseId === value.toWarehouseId) {
    return helpers.error('custom.sameWarehouse');
  }
  return value;
}, 'Warehouse validation').messages({
  'custom.sameWarehouse': 'Source and destination warehouses must be different',
});

export const stockQuerySchema = Joi.object({
  warehouseId: Joi.string().optional(),
  productId: Joi.string().optional(),
  lowStock: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(100).default(30),
});

// Warehouse validation schemas
export const warehouseCreateSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Warehouse name must be at least 2 characters long',
    'string.max': 'Warehouse name must not exceed 100 characters',
    'any.required': 'Warehouse name is required',
  }),
  location: Joi.string().min(5).max(300).required().messages({
    'string.min': 'Location must be at least 5 characters long',
    'string.max': 'Location must not exceed 300 characters',
    'any.required': 'Location is required',
  }),
  capacity: Joi.number().integer().positive().required().messages({
    'number.positive': 'Capacity must be a positive number',
    'any.required': 'Capacity is required',
  }),
});

export const warehouseUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  location: Joi.string().min(5).max(300).optional(),
  capacity: Joi.number().integer().positive().optional(),
  active: Joi.boolean().optional(),
}).min(1);

// Generic ID parameter validation
export const idParamSchema = Joi.object({
  id: Joi.string().required().messages({
    'any.required': 'ID parameter is required',
  }),
});

import { Request, Response, NextFunction } from 'express';

/**
 * Validation middleware factory
 */
export function validate(schema: Joi.Schema, property: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Replace request property with validated value
    req[property] = value;
    next();
  };
}
