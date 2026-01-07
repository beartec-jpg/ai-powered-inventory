import { Router, Response } from 'express';
import { warehouseService } from '../services/warehouseService';
import { AuthRequest } from '../types';
import {
  validate,
  warehouseCreateSchema,
  warehouseUpdateSchema,
  idParamSchema,
  paginationSchema,
} from '../utils/validators';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  notFoundResponse,
  conflictResponse,
  internalServerErrorResponse,
} from '../utils/responses';
import { authenticate, requireManager, requireAdmin } from '../middleware/auth';

const router = Router();

/**
 * GET /api/warehouse
 * List all warehouses
 */
router.get(
  '/',
  authenticate,
  validate(paginationSchema, 'query'),
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouses = await warehouseService.getAllWarehouses();
      return successResponse(res, warehouses, 'Warehouses retrieved successfully');
    } catch (error) {
      console.error('Get warehouses error:', error);
      return internalServerErrorResponse(res, 'Failed to retrieve warehouses');
    }
  }
);

/**
 * GET /api/warehouse/:id
 * Get warehouse details
 */
router.get(
  '/:id',
  authenticate,
  validate(idParamSchema, 'params'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const warehouse = await warehouseService.getWarehouseById(id);
      
      if (!warehouse) {
        return notFoundResponse(res, 'Warehouse not found');
      }
      
      return successResponse(res, warehouse, 'Warehouse retrieved successfully');
    } catch (error: any) {
      console.error('Get warehouse error:', error);
      return internalServerErrorResponse(res, 'Failed to retrieve warehouse');
    }
  }
);

/**
 * GET /api/warehouse/:id/utilization
 * Get warehouse capacity utilization
 */
router.get(
  '/:id/utilization',
  authenticate,
  validate(idParamSchema, 'params'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const utilization = await warehouseService.getWarehouseUtilization(id);
      return successResponse(res, utilization, 'Warehouse utilization retrieved successfully');
    } catch (error: any) {
      if (error.statusCode === 404) {
        return notFoundResponse(res, error.message);
      }
      console.error('Get warehouse utilization error:', error);
      return internalServerErrorResponse(res, 'Failed to retrieve warehouse utilization');
    }
  }
);

/**
 * GET /api/warehouse/:id/summary
 * Get warehouse stock summary
 */
router.get(
  '/:id/summary',
  authenticate,
  validate(idParamSchema, 'params'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const summary = await warehouseService.getWarehouseStockSummary(id);
      return successResponse(res, summary, 'Warehouse stock summary retrieved successfully');
    } catch (error: any) {
      if (error.statusCode === 404) {
        return notFoundResponse(res, error.message);
      }
      console.error('Get warehouse summary error:', error);
      return internalServerErrorResponse(res, 'Failed to retrieve warehouse summary');
    }
  }
);

/**
 * POST /api/warehouse
 * Create a new warehouse
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(warehouseCreateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouse = await warehouseService.createWarehouse(req.body);
      return createdResponse(res, warehouse, 'Warehouse created successfully');
    } catch (error: any) {
      if (error.statusCode === 409) {
        return conflictResponse(res, error.message);
      }
      console.error('Create warehouse error:', error);
      return internalServerErrorResponse(res, 'Failed to create warehouse');
    }
  }
);

/**
 * PUT /api/warehouse/:id
 * Update warehouse
 */
router.put(
  '/:id',
  authenticate,
  requireManager,
  validate(idParamSchema, 'params'),
  validate(warehouseUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const warehouse = await warehouseService.updateWarehouse(id, req.body);
      return successResponse(res, warehouse, 'Warehouse updated successfully');
    } catch (error: any) {
      if (error.statusCode === 404) {
        return notFoundResponse(res, error.message);
      }
      if (error.statusCode === 409) {
        return conflictResponse(res, error.message);
      }
      console.error('Update warehouse error:', error);
      return internalServerErrorResponse(res, 'Failed to update warehouse');
    }
  }
);

export default router;
