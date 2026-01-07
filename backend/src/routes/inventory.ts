import { Router, Response } from 'express';
import { InventoryService } from '../services/inventoryService';
import { AuthRequest } from '../types';
import {
  validate,
  productCreateSchema,
  productUpdateSchema,
  productListSchema,
  idParamSchema,
} from '../utils/validators';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  notFoundResponse,
  conflictResponse,
  internalServerErrorResponse,
} from '../utils/responses';
import { authenticate, requireManager } from '../middleware/auth';

const router = Router();

/**
 * GET /api/inventory
 * List all products with pagination and filtering
 */
router.get(
  '/',
  authenticate,
  validate(productListSchema, 'query'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { page, perPage, category, active, search } = req.query as any;

      const result = await InventoryService.getProducts(
        { category, active, search },
        { page: page || 1, perPage: perPage || 30 }
      );

      return paginatedResponse(
        res,
        result.products,
        page || 1,
        perPage || 30,
        result.total,
        'Products retrieved successfully'
      );
    } catch (error) {
      console.error('Get products error:', error);
      return internalServerErrorResponse(res, 'Failed to retrieve products');
    }
  }
);

/**
 * GET /api/inventory/categories
 * Get all product categories
 */
router.get('/categories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const categories = await InventoryService.getCategories();
    return successResponse(res, categories, 'Categories retrieved successfully');
  } catch (error) {
    console.error('Get categories error:', error);
    return internalServerErrorResponse(res, 'Failed to retrieve categories');
  }
});

/**
 * GET /api/inventory/:id
 * Get product details by ID
 */
router.get(
  '/:id',
  authenticate,
  validate(idParamSchema, 'params'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const product = await InventoryService.getProductById(id);
      return successResponse(res, product, 'Product retrieved successfully');
    } catch (error: any) {
      if (error.statusCode === 404) {
        return notFoundResponse(res, error.message);
      }
      console.error('Get product error:', error);
      return internalServerErrorResponse(res, 'Failed to retrieve product');
    }
  }
);

/**
 * POST /api/inventory
 * Create a new product
 */
router.post(
  '/',
  authenticate,
  requireManager,
  validate(productCreateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const product = await InventoryService.createProduct(req.body);
      return createdResponse(res, product, 'Product created successfully');
    } catch (error: any) {
      if (error.statusCode === 409) {
        return conflictResponse(res, error.message);
      }
      console.error('Create product error:', error);
      return internalServerErrorResponse(res, 'Failed to create product');
    }
  }
);

/**
 * PUT /api/inventory/:id
 * Update a product
 */
router.put(
  '/:id',
  authenticate,
  requireManager,
  validate(idParamSchema, 'params'),
  validate(productUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const product = await InventoryService.updateProduct(id, req.body);
      return successResponse(res, product, 'Product updated successfully');
    } catch (error: any) {
      if (error.statusCode === 404) {
        return notFoundResponse(res, error.message);
      }
      console.error('Update product error:', error);
      return internalServerErrorResponse(res, 'Failed to update product');
    }
  }
);

/**
 * DELETE /api/inventory/:id
 * Delete a product (soft delete)
 */
router.delete(
  '/:id',
  authenticate,
  requireManager,
  validate(idParamSchema, 'params'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const product = await InventoryService.deleteProduct(id);
      return successResponse(res, product, 'Product deleted successfully');
    } catch (error: any) {
      if (error.statusCode === 404) {
        return notFoundResponse(res, error.message);
      }
      console.error('Delete product error:', error);
      return internalServerErrorResponse(res, 'Failed to delete product');
    }
  }
);

export default router;
