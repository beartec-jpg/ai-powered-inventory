import { prisma } from '../lib/prisma';
import { Warehouse } from '@prisma/client';

export interface CreateWarehouseInput {
  name: string;
  location: string;
  capacity: number;
}

export interface UpdateWarehouseInput {
  name?: string;
  location?: string;
  capacity?: number;
  active?: boolean;
}

class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class WarehouseService {
  /**
   * Get warehouses with pagination
   */
  static async getWarehouses(
    page: number = 1,
    perPage: number = 30,
    activeOnly: boolean = false
  ): Promise<{ warehouses: Warehouse[]; total: number }> {
    const where = activeOnly ? { active: true } : {};

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.warehouse.count({ where }),
    ]);

    return { warehouses, total };
  }

  /**
   * Get warehouse by ID
   */
  static async getWarehouseById(id: string): Promise<Warehouse> {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    return warehouse;
  }

  /**
   * Get warehouse by name
   */
  static async getWarehouseByName(name: string): Promise<Warehouse | null> {
    return prisma.warehouse.findUnique({
      where: { name },
    });
  }

  /**
   * Get all warehouses
   */
  static async getAllWarehouses(): Promise<Warehouse[]> {
    return prisma.warehouse.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new warehouse
   */
  static async createWarehouse(data: CreateWarehouseInput): Promise<Warehouse> {
    // Check if name already exists
    const existing = await prisma.warehouse.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new ConflictError('Warehouse with this name already exists');
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: data.name,
        location: data.location,
        capacity: data.capacity,
        active: true,
      },
    });

    return warehouse;
  }

  /**
   * Update warehouse
   */
  static async updateWarehouse(id: string, data: UpdateWarehouseInput): Promise<Warehouse> {
    // Check if warehouse exists
    const existingWarehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!existingWarehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    // If updating name, check if new name is unique
    if (data.name && data.name !== existingWarehouse.name) {
      const nameExists = await prisma.warehouse.findUnique({
        where: { name: data.name },
      });

      if (nameExists) {
        throw new ConflictError('Warehouse with this name already exists');
      }
    }

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data,
    });

    return warehouse;
  }

  /**
   * Delete warehouse (soft delete)
   */
  static async deleteWarehouse(id: string): Promise<Warehouse> {
    // Check if warehouse exists
    const existingWarehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!existingWarehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: { active: false },
    });

    return warehouse;
  }

  /**
   * Get warehouse capacity utilization
   */
  static async getWarehouseUtilization(warehouseId: string): Promise<any> {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    // Get total quantity of items in warehouse
    const result = await prisma.stock.aggregate({
      where: { warehouseId },
      _sum: {
        quantity: true,
      },
    });

    const totalQuantity = result._sum.quantity || 0;
    const utilization = warehouse.capacity > 0 ? (totalQuantity / warehouse.capacity) * 100 : 0;

    return {
      warehouse,
      totalQuantity,
      capacity: warehouse.capacity,
      utilization: Math.round(utilization * 100) / 100, // Round to 2 decimals
      availableCapacity: warehouse.capacity - totalQuantity,
    };
  }

  /**
   * Get warehouse stock summary
   */
  static async getWarehouseStockSummary(warehouseId: string): Promise<any> {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    const stocks = await prisma.stock.findMany({
      where: { warehouseId },
      include: {
        product: true,
      },
    });

    return {
      warehouse,
      stocks,
      totalItems: stocks.length,
      totalQuantity: stocks.reduce((sum, stock) => sum + stock.quantity, 0),
      totalAvailable: stocks.reduce((sum, stock) => sum + stock.available, 0),
      totalReserved: stocks.reduce((sum, stock) => sum + stock.reserved, 0),
    };
  }
}

// Export instance for compatibility with inventoryIntelligence.ts
export const warehouseService = {
  getWarehouseByName: (name: string) => WarehouseService.getWarehouseByName(name),
  getAllWarehouses: () => WarehouseService.getAllWarehouses(),
  getWarehouseById: (id: string) => WarehouseService.getWarehouseById(id),
  getWarehouseUtilization: (warehouseId: string) => WarehouseService.getWarehouseUtilization(warehouseId),
};
