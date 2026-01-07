import { prisma } from '../db/prisma';
import { StockMovementType } from '@prisma/client';

export interface CreateStockInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  reorderLevel?: number;
}

export interface UpdateStockInput {
  quantity?: number;
  reserved?: number;
  reorderLevel?: number;
  lastCounted?: Date;
}

export interface StockTransferInput {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  notes?: string;
}

export class StockService {
  /**
   * Get stock by product and warehouse
   */
  async getStock(productId: string, warehouseId: string) {
    const stock = await prisma.stock.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
    });

    return stock;
  }

  /**
   * Get all stock for a product across warehouses
   */
  async getProductStock(productId: string) {
    const stockList = await prisma.stock.findMany({
      where: { productId },
      include: {
        warehouse: true,
        product: true,
      },
    });

    return stockList.map(s => ({
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
      warehouse: s.warehouse,
      product: s.product,
    }));
  }

  /**
   * Get all stock in a warehouse
   */
  async getWarehouseStock(warehouseId: string) {
    const stockList = await prisma.stock.findMany({
      where: { warehouseId },
      include: {
        product: true,
      },
    });

    return stockList;
  }

  /**
   * Create or update stock entry
   */
  async upsertStock(input: CreateStockInput) {
    const available = input.quantity; // Initially no reservations
    
    const stock = await prisma.stock.upsert({
      where: {
        productId_warehouseId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
      update: {
        quantity: input.quantity,
        available,
        reorderLevel: input.reorderLevel,
      },
      create: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        reserved: 0,
        available,
        reorderLevel: input.reorderLevel || 10,
      },
    });

    return stock;
  }

  /**
   * Adjust stock quantity
   */
  async adjustStock(
    productId: string,
    warehouseId: string,
    quantityChange: number,
    movementType: StockMovementType,
    reference?: string,
    notes?: string
  ) {
    const stock = await this.getStock(productId, warehouseId);
    
    if (!stock) {
      throw new Error('Stock entry not found');
    }

    const newQuantity = stock.quantity + quantityChange;
    const newAvailable = newQuantity - stock.reserved;

    if (newQuantity < 0) {
      throw new Error('Insufficient stock quantity');
    }

    // Update stock and create movement in a transaction
    const [updatedStock] = await prisma.$transaction([
      prisma.stock.update({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId,
          },
        },
        data: {
          quantity: newQuantity,
          available: newAvailable,
        },
      }),
      prisma.stockMovement.create({
        data: {
          productId,
          quantity: quantityChange,
          movementType,
          reference: reference || null,
          notes: notes || null,
        },
      }),
    ]);

    return updatedStock;
  }

  /**
   * Transfer stock between warehouses
   */
  async transferStock(input: StockTransferInput) {
    // Get source stock
    const fromStock = await this.getStock(input.productId, input.fromWarehouseId);
    if (!fromStock || fromStock.available < input.quantity) {
      throw new Error('Insufficient stock in source warehouse');
    }

    // Decrease from source
    await this.adjustStock(
      input.productId,
      input.fromWarehouseId,
      -input.quantity,
      StockMovementType.TRANSFER,
      `Transfer to ${input.toWarehouseId}`,
      input.notes
    );

    // Increase in destination
    await this.adjustStock(
      input.productId,
      input.toWarehouseId,
      input.quantity,
      StockMovementType.TRANSFER,
      `Transfer from ${input.fromWarehouseId}`,
      input.notes
    );

    return { success: true };
  }

  /**
   * Get low stock items (below reorder level)
   */
  async getLowStockItems() {
    const lowStock = await prisma.stock.findMany({
      where: {
        available: {
          lte: prisma.stock.fields.reorderLevel,
        },
      },
      include: {
        product: true,
        warehouse: true,
      },
    });

    return lowStock.map(s => ({
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
      warehouse: s.warehouse,
    }));
  }

  /**
   * Get stock movements for a product
   */
  async getStockMovements(productId: string, limit = 50) {
    const movements = await prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return movements;
  }
}

export const stockService = new StockService();
