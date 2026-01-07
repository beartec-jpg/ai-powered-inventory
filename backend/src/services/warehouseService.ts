import { PrismaClient, Warehouse, Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../types';

const prisma = new PrismaClient();

export class WarehouseService {
  /**
   * Get all warehouses with pagination
   */
  static async getWarehouses(
    page: number = 1,
    perPage: number = 30,
    activeOnly: boolean = false
  ): Promise<{ warehouses: Warehouse[]; total: number }> {
    const where: Prisma.WarehouseWhereInput = activeOnly ? { active: true } : {};

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { name: 'asc' },
        include: {
          stocks: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
          _count: {
            select: {
              stocks: true,
              accesses: true,
            },
          },
        },
      }),
      prisma.warehouse.count({ where }),
    ]);

    return { warehouses, total };
  }

  /**
   * Get warehouse by ID with detailed information
   */
  static async getWarehouseById(id: string): Promise<Warehouse> {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        stocks: {
          include: {
            product: true,
          },
          orderBy: {
            available: 'asc',
          },
        },
        accesses: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        transfersFrom: {
          include: {
            product: true,
            toWarehouse: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        transfersTo: {
          include: {
            product: true,
            fromWarehouse: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    return warehouse;
  }

  /**
   * Create a new warehouse
   */
  static async createWarehouse(data: {
    name: string;
    location: string;
    capacity: number;
  }): Promise<Warehouse> {
    // Check if warehouse name already exists
    const existingWarehouse = await prisma.warehouse.findUnique({
      where: { name: data.name },
    });

    if (existingWarehouse) {
      throw new ConflictError('Warehouse with this name already exists');
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: data.name,
        location: data.location,
        capacity: data.capacity,
      },
    });

    return warehouse;
  }

  /**
   * Update warehouse
   */
  static async updateWarehouse(
    id: string,
    data: {
      name?: string;
      location?: string;
      capacity?: number;
      active?: boolean;
    }
  ): Promise<Warehouse> {
    // Check if warehouse exists
    const existingWarehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!existingWarehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    // If updating name, check it's not taken
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
   * Get warehouse capacity utilization
   */
  static async getWarehouseUtilization(id: string): Promise<{
    warehouse: any;
    totalStock: number;
    capacity: number;
    utilizationPercent: number;
    availableCapacity: number;
  }> {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        stocks: true,
      },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    const totalStock = warehouse.stocks.reduce((sum: number, stock: any) => sum + stock.quantity, 0);
    const utilizationPercent = (totalStock / warehouse.capacity) * 100;
    const availableCapacity = warehouse.capacity - totalStock;

    return {
      warehouse,
      totalStock,
      capacity: warehouse.capacity,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      availableCapacity,
    };
  }

  /**
   * Get warehouse stock summary
   */
  static async getWarehouseStockSummary(id: string): Promise<{
    totalProducts: number;
    totalQuantity: number;
    totalAvailable: number;
    totalReserved: number;
    lowStockCount: number;
  }> {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        stocks: true,
      },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    const summary = warehouse.stocks.reduce(
      (acc, stock) => ({
        totalProducts: acc.totalProducts + 1,
        totalQuantity: acc.totalQuantity + stock.quantity,
        totalAvailable: acc.totalAvailable + stock.available,
        totalReserved: acc.totalReserved + stock.reserved,
        lowStockCount: acc.lowStockCount + (stock.available <= stock.reorderLevel ? 1 : 0),
      }),
      {
        totalProducts: 0,
        totalQuantity: 0,
        totalAvailable: 0,
        totalReserved: 0,
        lowStockCount: 0,
      }
    );

    return summary;
  }
}
