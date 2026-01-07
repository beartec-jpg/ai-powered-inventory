import { eq, and, lt, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { stocks, products, warehouses, stockMovements } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

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
    const [stock] = await db.select()
      .from(stocks)
      .where(
        and(
          eq(stocks.productId, productId),
          eq(stocks.warehouseId, warehouseId)
        )
      )
      .limit(1);

    return stock;
  }

  /**
   * Get all stock for a product across warehouses
   */
  async getProductStock(productId: string) {
    const stockList = await db.select({
      stock: stocks,
      warehouse: warehouses,
      product: products,
    })
      .from(stocks)
      .innerJoin(warehouses, eq(stocks.warehouseId, warehouses.id))
      .innerJoin(products, eq(stocks.productId, products.id))
      .where(eq(stocks.productId, productId));

    return stockList;
  }

  /**
   * Get all stock in a warehouse
   */
  async getWarehouseStock(warehouseId: string) {
    const stockList = await db.select({
      stock: stocks,
      product: products,
    })
      .from(stocks)
      .innerJoin(products, eq(stocks.productId, products.id))
      .where(eq(stocks.warehouseId, warehouseId));

    return stockList;
  }

  /**
   * Create or update stock entry
   */
  async upsertStock(input: CreateStockInput) {
    const existing = await this.getStock(input.productId, input.warehouseId);

    if (existing) {
      const available = input.quantity - (existing.reserved || 0);
      const [updated] = await db.update(stocks)
        .set({
          quantity: input.quantity,
          available,
          reorderLevel: input.reorderLevel || existing.reorderLevel,
          updatedAt: new Date(),
        })
        .where(eq(stocks.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await db.insert(stocks).values({
      id: uuidv4(),
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      reserved: 0,
      available: input.quantity,
      reorderLevel: input.reorderLevel || 10,
    }).returning();

    return created;
  }

  /**
   * Adjust stock quantity
   */
  async adjustStock(
    productId: string,
    warehouseId: string,
    quantityChange: number,
    movementType: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'RETURN' | 'TRANSFER' | 'DAMAGE' | 'LOSS',
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

    // Update stock
    const [updatedStock] = await db.update(stocks)
      .set({
        quantity: newQuantity,
        available: newAvailable,
        updatedAt: new Date(),
      })
      .where(eq(stocks.id, stock.id))
      .returning();

    // Record movement
    await db.insert(stockMovements).values({
      id: uuidv4(),
      productId,
      quantity: quantityChange,
      movementType,
      reference: reference || null,
      notes: notes || null,
    });

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
      'TRANSFER',
      `Transfer to ${input.toWarehouseId}`,
      input.notes
    );

    // Increase in destination
    await this.adjustStock(
      input.productId,
      input.toWarehouseId,
      input.quantity,
      'TRANSFER',
      `Transfer from ${input.fromWarehouseId}`,
      input.notes
    );

    return { success: true };
  }

  /**
   * Get low stock items (below reorder level)
   */
  async getLowStockItems() {
    const lowStock = await db.select({
      stock: stocks,
      product: products,
      warehouse: warehouses,
    })
      .from(stocks)
      .innerJoin(products, eq(stocks.productId, products.id))
      .innerJoin(warehouses, eq(stocks.warehouseId, warehouses.id))
      .where(sql`${stocks.available} <= ${stocks.reorderLevel}`);

    return lowStock;
  }

  /**
   * Get stock movements for a product
   */
  async getStockMovements(productId: string, limit = 50) {
    const movements = await db.select()
      .from(stockMovements)
      .where(eq(stockMovements.productId, productId))
      .orderBy(sql`${stockMovements.createdAt} DESC`)
      .limit(limit);

    return movements;
  }
}

export const stockService = new StockService();
