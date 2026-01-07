import { prisma } from '../lib/prisma';
import { Stock, StockTransfer, StockMovementType, TransferStatus } from '@prisma/client';

export interface StockQueryParams {
  warehouseId?: string;
  productId?: string;
  lowStock?: boolean;
  page?: number;
  perPage?: number;
}

class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class BadRequestError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class StockService {
  /**
   * Get stock with filtering and pagination
   */
  static async getStock(params: StockQueryParams): Promise<{ stocks: any[]; total: number }> {
    const { warehouseId, productId, lowStock, page = 1, perPage = 30 } = params;

    const where: any = {};

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (productId) {
      where.productId = productId;
    }

    if (lowStock) {
      where.available = { lte: prisma.stock.fields.reorderLevel };
    }

    const [stocks, total] = await Promise.all([
      prisma.stock.findMany({
        where,
        include: {
          product: true,
          warehouse: true,
        },
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.stock.count({ where }),
    ]);

    return { stocks, total };
  }

  /**
   * Get low stock items
   */
  static async getLowStockItems(
    page: number = 1,
    perPage: number = 30
  ): Promise<{ stocks: any[]; total: number }> {
    // Get stocks where available is less than or equal to reorderLevel
    const stocks = await prisma.$queryRaw<any[]>`
      SELECT s.*, p.*, w.*
      FROM stocks s
      INNER JOIN products p ON s.product_id = p.id
      INNER JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.available <= s.reorder_level
      ORDER BY s.updated_at DESC
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `;

    const total = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count
      FROM stocks s
      WHERE s.available <= s.reorder_level
    `;

    return {
      stocks,
      total: Number(total[0]?.count || 0),
    };
  }

  /**
   * Get warehouse stock with pagination
   */
  static async getWarehouseStock(
    warehouseId: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<{ stocks: any[]; total: number }> {
    // Check if warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    const [stocks, total] = await Promise.all([
      prisma.stock.findMany({
        where: { warehouseId },
        include: {
          product: true,
          warehouse: true,
        },
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.stock.count({ where: { warehouseId } }),
    ]);

    return { stocks, total };
  }

  /**
   * Get product stock summary
   */
  static async getProductStockSummary(productId: string): Promise<any> {
    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const stocks = await prisma.stock.findMany({
      where: { productId },
      include: {
        warehouse: true,
      },
    });

    const totalQuantity = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
    const totalAvailable = stocks.reduce((sum, stock) => sum + stock.available, 0);
    const totalReserved = stocks.reduce((sum, stock) => sum + stock.reserved, 0);

    return {
      product,
      stocks,
      summary: {
        totalQuantity,
        totalAvailable,
        totalReserved,
        warehouseCount: stocks.length,
      },
    };
  }

  /**
   * Adjust stock quantity
   */
  static async adjustStock(
    productId: string,
    warehouseId: string,
    quantity: number,
    reason: StockMovementType,
    notes?: string,
    userId?: string
  ): Promise<Stock> {
    // Check if stock exists
    let stock = await prisma.stock.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
    });

    if (!stock) {
      // Create stock if it doesn't exist
      stock = await prisma.stock.create({
        data: {
          productId,
          warehouseId,
          quantity: 0,
          reserved: 0,
          available: 0,
          reorderLevel: 10,
        },
      });
    }

    const newQuantity = stock.quantity + quantity;
    const newAvailable = newQuantity - stock.reserved;

    if (newQuantity < 0) {
      throw new BadRequestError('Insufficient stock quantity');
    }

    // Update stock in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update stock
      const updatedStock = await tx.stock.update({
        where: { id: stock!.id },
        data: {
          quantity: newQuantity,
          available: newAvailable,
        },
      });

      // Record stock movement
      await tx.stockMovement.create({
        data: {
          productId,
          quantity,
          movementType: reason,
          reference: userId ? `Adjusted by user ${userId}` : undefined,
          notes: notes || undefined,
        },
      });

      return updatedStock;
    });

    return result;
  }

  /**
   * Transfer stock between warehouses
   */
  static async transferStock(
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    notes?: string,
    userId?: string
  ): Promise<StockTransfer> {
    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Verify warehouses exist
    const [fromWarehouse, toWarehouse] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: fromWarehouseId } }),
      prisma.warehouse.findUnique({ where: { id: toWarehouseId } }),
    ]);

    if (!fromWarehouse) {
      throw new NotFoundError('Source warehouse not found');
    }

    if (!toWarehouse) {
      throw new NotFoundError('Destination warehouse not found');
    }

    // Check stock availability
    const fromStock = await prisma.stock.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId: fromWarehouseId,
        },
      },
    });

    if (!fromStock || fromStock.available < quantity) {
      throw new BadRequestError('Insufficient stock in source warehouse');
    }

    if (!userId) {
      throw new BadRequestError('User ID is required for stock transfer');
    }

    // Perform transfer in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Decrease from source
      await tx.stock.update({
        where: { id: fromStock.id },
        data: {
          quantity: fromStock.quantity - quantity,
          available: fromStock.available - quantity,
        },
      });

      // Increase in destination (or create if doesn't exist)
      const toStock = await tx.stock.findUnique({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: toWarehouseId,
          },
        },
      });

      if (toStock) {
        await tx.stock.update({
          where: { id: toStock.id },
          data: {
            quantity: toStock.quantity + quantity,
            available: toStock.available + quantity,
          },
        });
      } else {
        await tx.stock.create({
          data: {
            productId,
            warehouseId: toWarehouseId,
            quantity,
            reserved: 0,
            available: quantity,
            reorderLevel: 10,
          },
        });
      }

      // Create stock movements for audit
      await tx.stockMovement.createMany({
        data: [
          {
            productId,
            quantity: -quantity,
            movementType: StockMovementType.TRANSFER,
            reference: `Transfer to ${toWarehouse.name}`,
            notes,
          },
          {
            productId,
            quantity,
            movementType: StockMovementType.TRANSFER,
            reference: `Transfer from ${fromWarehouse.name}`,
            notes,
          },
        ],
      });

      // Create stock transfer record
      const transfer = await tx.stockTransfer.create({
        data: {
          productId,
          fromWarehouseId,
          toWarehouseId,
          quantity,
          status: TransferStatus.COMPLETED,
          initiatedBy: userId,
          notes,
        },
      });

      return transfer;
    });

    return result;
  }
}

// Export instance for compatibility with inventoryIntelligence.ts
export const stockService = {
  getStock: (productId: string, warehouseId: string) =>
    prisma.stock.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
    }),
  getProductStock: async (productId: string) => {
    const stocks = await prisma.stock.findMany({
      where: { productId },
      include: {
        product: true,
        warehouse: true,
      },
    });
    return stocks.map((s) => ({ stock: s, product: s.product, warehouse: s.warehouse }));
  },
  getWarehouseStock: async (warehouseId: string) => {
    const stocks = await prisma.stock.findMany({
      where: { warehouseId },
      include: {
        product: true,
      },
    });
    return stocks.map((s) => ({ stock: s, product: s.product }));
  },
  getLowStockItems: async () => {
    const stocks = await prisma.$queryRaw<any[]>`
      SELECT s.*, p.*, w.*
      FROM stocks s
      INNER JOIN products p ON s.product_id = p.id
      INNER JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.available <= s.reorder_level
    `;
    return stocks.map((item) => ({
      stock: {
        id: item.id,
        productId: item.product_id,
        warehouseId: item.warehouse_id,
        quantity: item.quantity,
        available: item.available,
        reserved: item.reserved,
        reorderLevel: item.reorder_level,
      },
      product: {
        id: item.product_id,
        sku: item.sku,
        name: item.name,
        category: item.category,
      },
      warehouse: {
        id: item.warehouse_id,
        name: item.name,
        location: item.location,
      },
    }));
  },
  adjustStock: async (
    productId: string,
    warehouseId: string,
    quantityChange: number,
    movementType: StockMovementType,
    reference?: string,
    notes?: string
  ) => {
    return StockService.adjustStock(productId, warehouseId, quantityChange, movementType, notes, reference);
  },
  transferStock: async (input: {
    productId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
    notes?: string;
  }) => {
    return StockService.transferStock(
      input.productId,
      input.fromWarehouseId,
      input.toWarehouseId,
      input.quantity,
      input.notes,
      'system' // Default user for compatibility
    );
  },
  getStockMovements: async (productId: string, limit = 50) => {
    return prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
