import { Router, Response } from 'express';
import { inventoryService } from '../services/inventoryService';
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
      const { page, perPage, category, search } = req.query as any;
      
      const limit = perPage || 30;
      const offset = ((page || 1) - 1) * limit;

      let products;
      if (category) {
        products = await inventoryService.getProductsByCategory(category, limit, offset);
      } else if (search) {
        products = await inventoryService.searchProducts(search, limit, offset);
      } else {
        products = await inventoryService.getAllProducts(limit, offset);
      }

      return paginatedResponse(
        res,
        products,
        page || 1,
        perPage || 30,
        products.length, // Simplified - in production, get actual total
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
    const categories = await inventoryService.getCategories();
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
      const product = await inventoryService.getProductById(id);
      
      if (!product) {
        return notFoundResponse(res, 'Product not found');
      }
      
      return successResponse(res, product, 'Product retrieved successfully');
    } catch (error: any) {
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
      // Check SKU uniqueness
      const isUnique = await inventoryService.validateSku(req.body.sku);
      if (!isUnique) {
        return conflictResponse(res, 'Product with this SKU already exists');
      }
      
      const product = await inventoryService.createProduct(req.body);
      return createdResponse(res, product, 'Product created successfully');
    } catch (error: any) {
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
      
      // Check if product exists
      const existing = await inventoryService.getProductById(id);
      if (!existing) {
        return notFoundResponse(res, 'Product not found');
      }
      
      // Check SKU uniqueness if SKU is being updated
      if (req.body.sku) {
        const isUnique = await inventoryService.validateSku(req.body.sku, id);
        if (!isUnique) {
          return conflictResponse(res, 'Product with this SKU already exists');
        }
      }
      
      const product = await inventoryService.updateProduct(id, req.body);
      return successResponse(res, product, 'Product updated successfully');
    } catch (error: any) {
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
      
      // Check if product exists
      const existing = await inventoryService.getProductById(id);
      if (!existing) {
        return notFoundResponse(res, 'Product not found');
      }
      
      const product = await inventoryService.deleteProduct(id);
      return successResponse(res, product, 'Product deleted successfully');
    } catch (error: any) {
      console.error('Delete product error:', error);
      return internalServerErrorResponse(res, 'Failed to delete product');
    }
  }
);

export default router;
