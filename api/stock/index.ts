import { VercelRequest, VercelResponse } from '@vercel/node';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  notFoundResponse,
  badRequestResponse,
  internalServerErrorResponse,
  setCorsHeaders,
} from '../lib/utils.js';
import {
  getStock,
  getLowStockItems,
  getWarehouseStock,
  getProductStockSummary,
  adjustStock,
  transferStock,
} from '../lib/services.js';

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
    // GET /api/stock?low=true - Get low stock items
    if (req.method === 'GET' && req.query.low === 'true') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 30;

      const result = await getLowStockItems();

      return paginatedResponse(
        res,
        result,
        page,
        perPage,
        result.length,
        'Low stock items retrieved successfully'
      );
    }

    // GET /api/stock?warehouseId=xyz - Get stock for specific warehouse
    if (req.method === 'GET' && req.query.warehouseId) {
      const warehouseId = req.query.warehouseId as string;
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 30;

      try {
        const result = await getWarehouseStock(warehouseId);

        return paginatedResponse(
          res,
          result,
          page,
          perPage,
          result.length,
          'Warehouse stock retrieved successfully'
        );
      } catch (error: any) {
        return notFoundResponse(res, error.message || 'Warehouse not found');
      }
    }

    // GET /api/stock?productId=xyz - Get stock summary for specific product
    if (req.method === 'GET' && req.query.productId) {
      const productId = req.query.productId as string;

      try {
        const summary = await getProductStockSummary(productId);
        return successResponse(res, summary, 'Product stock summary retrieved successfully');
      } catch (error: any) {
        return notFoundResponse(res, error.message || 'Product not found');
      }
    }

    // GET /api/stock - List all stock with filters
    if (req.method === 'GET') {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 30;
      const warehouseId = req.query.warehouseId as string;
      const productId = req.query.productId as string;
      const lowStock = req.query.lowStock === 'true';

      const result = await getStock({
        warehouseId,
        productId,
        lowStock,
        page,
        pageSize: perPage
      });

      return paginatedResponse(
        res,
        result.data,
        page,
        perPage,
        result.pagination.total,
        'Stock retrieved successfully'
      );
    }

    // POST /api/stock - Adjust or transfer stock
    if (req.method === 'POST') {
      const { action, productId, warehouseId, quantity, reason, notes, fromWarehouseId, toWarehouseId, userId } = req.body;

      // Adjust stock
      if (action === 'adjust') {
        if (!productId || !warehouseId || quantity === undefined || !reason) {
          return badRequestResponse(
            res,
            'Missing required fields: productId, warehouseId, quantity, reason'
          );
        }

        try {
          const stock = await adjustStock({
            productId,
            warehouseId,
            quantity,
            movementType: reason,
            reference: userId,
            notes
          });

          return createdResponse(res, stock, 'Stock adjusted successfully');
        } catch (error: any) {
          if (error.message === 'Stock entry not found') {
            return notFoundResponse(res, error.message);
          }
          if (error.message === 'Insufficient stock quantity') {
            return badRequestResponse(res, error.message);
          }
          throw error;
        }
      }

      // Transfer stock
      if (action === 'transfer') {
        if (!productId || !fromWarehouseId || !toWarehouseId || !quantity) {
          return badRequestResponse(
            res,
            'Missing required fields: productId, fromWarehouseId, toWarehouseId, quantity'
          );
        }

        if (fromWarehouseId === toWarehouseId) {
          return badRequestResponse(
            res,
            'Source and destination warehouses must be different'
          );
        }

        try {
          const transfer = await transferStock({
            productId,
            fromWarehouseId,
            toWarehouseId,
            quantity,
            initiatedBy: userId,
            notes
          });

          return createdResponse(res, transfer, 'Stock transferred successfully');
        } catch (error: any) {
          if (error.message.includes('not found')) {
            return notFoundResponse(res, error.message);
          }
          if (error.message.includes('Insufficient')) {
            return badRequestResponse(res, error.message);
          }
          throw error;
        }
      }

      return badRequestResponse(
        res,
        'Invalid action. Supported actions: adjust, transfer'
      );
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not allowed on this endpoint`,
    });
  } catch (error) {
    console.error('Stock endpoint error:', error);
    return internalServerErrorResponse(
      res,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
