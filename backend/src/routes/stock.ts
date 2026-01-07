import { Router, Response } from 'express';
import { StockService } from '../services/stockService';
import { AuthRequest } from '../types';
import {
  validate,
  stockAdjustmentSchema,
  stockTransferSchema,
  stockQuerySchema,
  idParamSchema,
} from '../utils/validators';
import {
  successResponse,
  paginatedResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  internalServerErrorResponse,
} from '../utils/responses';
import { authenticate, requireManager } from '../middleware/auth';

const router = Router();

/**
 * GET /api/stock
 * List stock across all warehouses
 */
router.get(
  '/',
  authenticate,
  validate(stockQuerySchema, 'query'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { warehouseId, productId, lowStock, page, perPage } = req.query as any;

      const result = await StockService.getStock({
        warehouseId,
        productId,
        lowStock: lowStock === 'true',
        page: page || 1,
        perPage: perPage || 30,
      });

      return paginatedResponse(
        res,
        result.stocks,
        page || 1,
        perPage || 30,
        result.total,
        'Stock retrieved successfully'
      );
    } catch (error) {
      console.error('Get stock error:', error);
      return internalServerErrorResponse(res, 'Failed to retrieve stock');
    }
  }
);

/**
 * GET /api/stock/low
 * Get low stock items
 */
router.get('/low', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 30;

    const result = await StockService.getLowStockItems(page, perPage);

    return paginatedResponse(
      res,
      result.stocks,
      page,
      perPage,
      result.total,
      'Low stock items retrieved successfully'
    );
  } catch (error) {
    console.error('Get low stock error:', error);
    return internalServerErrorResponse(res, 'Failed to retrieve low stock items');
  }
});

/**
 * GET /api/stock/warehouse/:warehouseId
 * Get stock for a specific warehouse
 */
router.get(
  '/warehouse/:warehouseId',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { warehouseId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 30;

      const result = await StockService.getWarehouseStock(warehouseId, page, perPage);

      return paginatedResponse(
        res,
        result.stocks,
        page,
        perPage,
        result.total,
        'Warehouse stock retrieved successfully'
      );
    } catch (error: any) {
      if (error.statusCode === 404) {
        return notFoundResponse(res, error.message);
      }
      console.error('Get warehouse stock error:', error);
      return internalServerErrorResponse(res, 'Failed to retrieve warehouse stock');
    }
  }
);

/**
 * GET /api/stock/:productId
 * Get stock levels for a specific product
 */
router.get(
  '/:productId',
  authenticate,
  validate(idParamSchema, 'params'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { productId } = req.params;
      const summary = await StockService.getProductStockSummary(productId);
      return successResponse(res, summary, 'Product stock summary retrieved successfully');
    } catch (error: any) {
      if (error.statusCode === 404) {
        return notFoundResponse(res, error.message);
      }
      console.error('Get product stock error:', error);
      return internalServerErrorResponse(res, 'Failed to retrieve product stock');
    }
  }
);

/**
 * POST /api/stock/adjust
 * Adjust stock quantity
 */
router.post(
  '/adjust',
  authenticate,
  requireManager,
  validate(stockAdjustmentSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { productId, warehouseId, quantity, reason, notes } = req.body;
      const userId = req.user?.id;

      const stock = await StockService.adjustStock(
        productId,
        warehouseId,
        quantity,
        reason,
        notes,
        userId
      );

      return createdResponse(res, stock, 'Stock adjusted successfully');
    } catch (error: any) {
      if (error.statusCode === 404) {
        return notFoundResponse(res, error.message);
      }
      if (error.statusCode === 400) {
        return badRequestResponse(res, error.message);
      }
      console.error('Adjust stock error:', error);
      return internalServerErrorResponse(res, 'Failed to adjust stock');
    }
  }
);

/**
 * POST /api/stock/transfer
 * Transfer stock between warehouses
 */
router.post(
  '/transfer',
  authenticate,
  requireManager,
  validate(stockTransferSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { productId, fromWarehouseId, toWarehouseId, quantity, notes } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return badRequestResponse(res, 'User ID not found');
      }

      const transfer = await StockService.transferStock(
        productId,
        fromWarehouseId,
        toWarehouseId,
        quantity,
        notes,
        userId
      );

      return createdResponse(res, transfer, 'Stock transferred successfully');
    } catch (error: any) {
      if (error.statusCode === 404) {
        return notFoundResponse(res, error.message);
      }
      if (error.statusCode === 400) {
        return badRequestResponse(res, error.message);
      }
      console.error('Transfer stock error:', error);
      return internalServerErrorResponse(res, 'Failed to transfer stock');
    }
  }
);

export default router;
