import { PrismaClient, Stock, StockMovementType, TransferStatus, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../types';

const prisma = new PrismaClient();

export class StockService {
  /**
   * Get all stock across warehouses with optional filters
   */
  static async getStock(filters: {
    warehouseId?: string;
    productId?: string;
    lowStock?: boolean;
    page?: number;
    perPage?: number;
  }): Promise<{ stocks: Stock[]; total: number }> {
    const { warehouseId, productId, lowStock, page = 1, perPage = 30 } = filters;

    const where: Prisma.StockWhereInput = {};

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (productId) {
      where.productId = productId;
    }

    if (lowStock) {
      where.available = {
        lte: prisma.stock.fields.reorderLevel,
      };
    }

    const [stocks, total] = await Promise.all([
      prisma.stock.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          product: true,
          warehouse: true,
        },
        orderBy: [{ available: 'asc' }],
      }),
      prisma.stock.count({ where }),
    ]);

    return { stocks, total };
  }

  /**
   * Get stock for a specific warehouse
   */
  static async getWarehouseStock(
    warehouseId: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<{ stocks: Stock[]; total: number }> {
    // Verify warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    return this.getStock({ warehouseId, page, perPage });
  }

  /**
   * Get stock levels for a specific product
   */
  static async getProductStock(productId: string): Promise<Stock[]> {
    // Verify product exists
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

    return stocks;
  }

  /**
   * Adjust stock quantity
   */
  static async adjustStock(
    productId: string,
    warehouseId: string,
    quantity: number,
    reason: string,
    notes?: string,
    userId?: string
  ): Promise<Stock> {
    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Verify warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundError('Warehouse not found');
    }

    // Get or create stock entry
    let stock = await prisma.stock.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
    });

    const newQuantity = (stock?.quantity || 0) + quantity;

    if (newQuantity < 0) {
      throw new ValidationError('Resulting quantity cannot be negative');
    }

    const reserved = stock?.reserved || 0;
    const available = newQuantity - reserved;

    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update or create stock
      const updatedStock = await tx.stock.upsert({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId,
          },
        },
        create: {
          productId,
          warehouseId,
          quantity: newQuantity,
          reserved: 0,
          available: newQuantity,
        },
        update: {
          quantity: newQuantity,
          available: available,
        },
      });

      // Create stock movement record
      await tx.stockMovement.create({
        data: {
          productId,
          quantity,
          movementType: StockMovementType.ADJUSTMENT,
          reference: reason,
          notes: notes || `Stock adjustment: ${reason}`,
        },
      });

      // Create activity log if userId provided
      if (userId) {
        await tx.activity.create({
          data: {
            userId,
            action: 'ADJUST',
            entityType: 'Stock',
            entityId: updatedStock.id,
            oldValue: stock?.quantity.toString() || '0',
            newValue: newQuantity.toString(),
            details: `Adjusted stock by ${quantity} units. Reason: ${reason}`,
          },
        });
      }

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
    notes: string | undefined,
    userId: string
  ): Promise<any> {
    if (quantity <= 0) {
      throw new ValidationError('Transfer quantity must be positive');
    }

    if (fromWarehouseId === toWarehouseId) {
      throw new ValidationError('Source and destination warehouses must be different');
    }

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

    // Check if source warehouse has enough stock
    const sourceStock = await prisma.stock.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId: fromWarehouseId,
        },
      },
    });

    if (!sourceStock || sourceStock.available < quantity) {
      throw new ValidationError(
        `Insufficient stock in source warehouse. Available: ${sourceStock?.available || 0}, Required: ${quantity}`
      );
    }

    // Perform transfer in transaction
    const transfer = await prisma.$transaction(async (tx) => {
      // Decrease stock in source warehouse
      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: fromWarehouseId,
          },
        },
        data: {
          quantity: { decrement: quantity },
          available: { decrement: quantity },
        },
      });

      // Increase stock in destination warehouse
      await tx.stock.upsert({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: toWarehouseId,
          },
        },
        create: {
          productId,
          warehouseId: toWarehouseId,
          quantity: quantity,
          reserved: 0,
          available: quantity,
        },
        update: {
          quantity: { increment: quantity },
          available: { increment: quantity },
        },
      });

      // Create stock transfer record
      const stockTransfer = await tx.stockTransfer.create({
        data: {
          productId,
          fromWarehouseId,
          toWarehouseId,
          quantity,
          status: TransferStatus.COMPLETED,
          initiatedBy: userId,
          notes,
        },
        include: {
          product: true,
          fromWarehouse: true,
          toWarehouse: true,
        },
      });

      // Create stock movement records
      await tx.stockMovement.createMany({
        data: [
          {
            productId,
            quantity: -quantity,
            movementType: StockMovementType.TRANSFER,
            reference: stockTransfer.id,
            notes: `Transfer to ${toWarehouse.name}`,
          },
          {
            productId,
            quantity: quantity,
            movementType: StockMovementType.TRANSFER,
            reference: stockTransfer.id,
            notes: `Transfer from ${fromWarehouse.name}`,
          },
        ],
      });

      // Create activity log
      await tx.activity.create({
        data: {
          userId,
          action: 'TRANSFER',
          entityType: 'Stock',
          entityId: stockTransfer.id,
          details: `Transferred ${quantity} units of ${product.name} from ${fromWarehouse.name} to ${toWarehouse.name}`,
        },
      });

      return stockTransfer;
    });

    return transfer;
  }

  /**
   * Get low stock items
   */
  static async getLowStockItems(page: number = 1, perPage: number = 30): Promise<{ stocks: Stock[]; total: number }> {
    // Since we can't directly compare fields in Prisma, we'll fetch all and filter
    const allStocks = await prisma.stock.findMany({
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: [{ available: 'asc' }],
    });

    // Filter stocks where available <= reorderLevel
    const lowStocks = allStocks.filter((stock) => stock.available <= stock.reorderLevel);

    const total = lowStocks.length;
    const stocks = lowStocks.slice((page - 1) * perPage, page * perPage);

    return { stocks, total };
  }

  /**
   * Get stock summary for a product across all warehouses
   */
  static async getProductStockSummary(productId: string): Promise<{
    totalQuantity: number;
    totalAvailable: number;
    totalReserved: number;
    warehouseBreakdown: Stock[];
  }> {
    const stocks = await this.getProductStock(productId);

    const summary = stocks.reduce(
      (acc, stock) => ({
        totalQuantity: acc.totalQuantity + stock.quantity,
        totalAvailable: acc.totalAvailable + stock.available,
        totalReserved: acc.totalReserved + stock.reserved,
      }),
      { totalQuantity: 0, totalAvailable: 0, totalReserved: 0 }
    );

    return {
      ...summary,
      warehouseBreakdown: stocks,
    };
  }
}
