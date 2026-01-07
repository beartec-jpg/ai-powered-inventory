import { Router, Response } from 'express';
import { stockService } from '../services/stockService';
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
      const { warehouseId, productId } = req.query as any;

      let stocks;
      if (warehouseId && productId) {
        const stock = await stockService.getStock(productId, warehouseId);
        stocks = stock ? [stock] : [];
      } else if (productId) {
        stocks = await stockService.getProductStock(productId);
      } else if (warehouseId) {
        stocks = await stockService.getWarehouseStock(warehouseId);
      } else {
        // Get low stock items as default
        stocks = await stockService.getLowStockItems();
      }

      return successResponse(res, stocks, 'Stock retrieved successfully');
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
    const stocks = await stockService.getLowStockItems();

    return successResponse(res, stocks, 'Low stock items retrieved successfully');
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

      const stocks = await stockService.getWarehouseStock(warehouseId);

      return successResponse(res, stocks, 'Warehouse stock retrieved successfully');
    } catch (error: any) {
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
      const stocks = await stockService.getProductStock(productId);
      return successResponse(res, stocks, 'Product stock summary retrieved successfully');
    } catch (error: any) {
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
      const userId = req.user?.id || 'system';

      const stock = await stockService.adjustStock(
        productId,
        warehouseId,
        quantity,
        reason,
        notes,
        userId
      );

      return createdResponse(res, stock, 'Stock adjusted successfully');
    } catch (error: any) {
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

      const transfer = await stockService.transferStock({
        productId,
        fromWarehouseId,
        toWarehouseId,
        quantity,
        notes,
      });

      return createdResponse(res, transfer, 'Stock transferred successfully');
    } catch (error: any) {
      console.error('Transfer stock error:', error);
      return internalServerErrorResponse(res, 'Failed to transfer stock');
    }
  }
);

export default router;
