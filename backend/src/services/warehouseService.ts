import { prisma } from '../db/prisma';

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

export class WarehouseService {
  /**
   * Create a new warehouse
   */
  async createWarehouse(input: CreateWarehouseInput) {
    const warehouse = await prisma.warehouse.create({
      data: {
        name: input.name,
        location: input.location,
        capacity: input.capacity,
        active: true,
      },
    });

    return warehouse;
  }

  /**
   * Get warehouse by ID
   */
  async getWarehouseById(id: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    return warehouse;
  }

  /**
   * Get warehouse by name
   */
  async getWarehouseByName(name: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { name },
    });

    return warehouse;
  }

  /**
   * Get all warehouses
   */
  async getAllWarehouses() {
    const warehouses = await prisma.warehouse.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    return warehouses;
  }

  /**
   * Update warehouse
   */
  async updateWarehouse(id: string, input: UpdateWarehouseInput) {
    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: input,
    });

    return warehouse;
  }

  /**
   * Delete warehouse (soft delete)
   */
  async deleteWarehouse(id: string) {
    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: { active: false },
    });

    return warehouse;
  }

  /**
   * Get warehouse capacity utilization
   */
  async getWarehouseUtilization(warehouseId: string) {
    const warehouse = await this.getWarehouseById(warehouseId);
    if (!warehouse) {
      throw new Error('Warehouse not found');
    }

    // Get total quantity of items in warehouse
    const result = await prisma.stock.aggregate({
      where: { warehouseId },
      _sum: {
        quantity: true,
      },
    });

    const totalQuantity = result._sum.quantity || 0;
    const utilization = warehouse.capacity > 0 
      ? (Number(totalQuantity) / warehouse.capacity) * 100 
      : 0;

    return {
      warehouse,
      totalQuantity: Number(totalQuantity),
      capacity: warehouse.capacity,
      utilization: Math.round(utilization * 100) / 100, // Round to 2 decimals
      availableCapacity: warehouse.capacity - Number(totalQuantity),
    };
  }

  /**
   * Get warehouse stock summary
   */
  async getWarehouseStockSummary(warehouseId: string) {
    const stockItems = await prisma.stock.findMany({
      where: { warehouseId },
      include: {
        product: true,
      },
    });

    return stockItems.map(s => ({
      stock: {
        id: s.id,
        productId: s.productId,
        warehouseId: s.warehouseId,
        quantity: s.quantity,
        reserved: s.reserved,
        available: s.available,
        reorderLevel: s.reorderLevel,
        lastCounted: s.lastCounted,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      },
      product: s.product,
    }));
  }
}

export const warehouseService = new WarehouseService();
