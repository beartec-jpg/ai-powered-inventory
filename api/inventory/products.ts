import { VercelRequest, VercelResponse } from '@vercel/node';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  notFoundResponse,
  badRequestResponse,
  internalServerErrorResponse,
  setCorsHeaders,
} from '../lib/utils';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
} from '../lib/services';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET /api/inventory/products - List all products
    if (req.method === 'GET' && !req.query.id) {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 30;
      const category = req.query.category as string;
      const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
      const search = req.query.search as string;

      const result = await getProducts({
        category,
        active,
        page,
        pageSize: perPage
      });

      return paginatedResponse(
        res,
        result.data,
        page,
        perPage,
        result.pagination.total,
        'Products retrieved successfully'
      );
    }

    // GET /api/inventory/products?id=xyz - Get product by ID
    if (req.method === 'GET' && req.query.id) {
      const id = req.query.id as string;
      
      try {
        const product = await getProductById(id);
        return successResponse(res, product, 'Product retrieved successfully');
      } catch (error: any) {
        return notFoundResponse(res, error.message || 'Product not found');
      }
    }

    // GET /api/inventory/products?categories=true - Get categories
    if (req.method === 'GET' && req.query.categories === 'true') {
      const categories = await getCategories();
      return successResponse(res, categories, 'Categories retrieved successfully');
    }

    // POST /api/inventory/products - Create new product
    if (req.method === 'POST') {
      const { sku, name, description, category, unitPrice, unit } = req.body;

      // Validate required fields
      if (!sku || !name || !category || unitPrice === undefined) {
        return badRequestResponse(
          res,
          'Missing required fields: sku, name, category, unitPrice'
        );
      }

      try {
        const product = await createProduct({
          sku,
          name,
          description,
          category,
          unitPrice,
          unit,
        });
        return createdResponse(res, product, 'Product created successfully');
      } catch (error: any) {
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          return res.status(409).json({
            success: false,
            error: 'Conflict',
            message: 'A product with this SKU already exists',
          });
        }
        throw error;
      }
    }

    // PUT /api/inventory/products - Update product
    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;

      if (!id) {
        return badRequestResponse(res, 'Product ID is required');
      }

      try {
        const product = await updateProduct(id, updateData);
        return successResponse(res, product, 'Product updated successfully');
      } catch (error: any) {
        return notFoundResponse(res, error.message || 'Product not found');
      }
    }

    // DELETE /api/inventory/products - Delete product (soft delete)
    if (req.method === 'DELETE') {
      const id = req.query.id as string;

      if (!id) {
        return badRequestResponse(res, 'Product ID is required');
      }

      try {
        const product = await deleteProduct(id);
        return successResponse(res, product, 'Product deleted successfully');
      } catch (error: any) {
        return notFoundResponse(res, error.message || 'Product not found');
      }
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Products endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
