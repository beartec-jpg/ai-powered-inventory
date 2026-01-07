import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { warehouses, stocks, products } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

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
    const [warehouse] = await db.insert(warehouses).values({
      id: uuidv4(),
      name: input.name,
      location: input.location,
      capacity: input.capacity,
      active: true,
    }).returning();

    return warehouse;
  }

  /**
   * Get warehouse by ID
   */
  async getWarehouseById(id: string) {
    const [warehouse] = await db.select()
      .from(warehouses)
      .where(eq(warehouses.id, id))
      .limit(1);

    return warehouse;
  }

  /**
   * Get warehouse by name
   */
  async getWarehouseByName(name: string) {
    const [warehouse] = await db.select()
      .from(warehouses)
      .where(eq(warehouses.name, name))
      .limit(1);

    return warehouse;
  }

  /**
   * Get all warehouses
   */
  async getAllWarehouses() {
    const allWarehouses = await db.select()
      .from(warehouses)
      .where(eq(warehouses.active, true))
      .orderBy(desc(warehouses.createdAt));

    return allWarehouses;
  }

  /**
   * Update warehouse
   */
  async updateWarehouse(id: string, input: UpdateWarehouseInput) {
    const [updatedWarehouse] = await db.update(warehouses)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(warehouses.id, id))
      .returning();

    return updatedWarehouse;
  }

  /**
   * Delete warehouse (soft delete)
   */
  async deleteWarehouse(id: string) {
    const [deletedWarehouse] = await db.update(warehouses)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(warehouses.id, id))
      .returning();

    return deletedWarehouse;
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
    const result = await db.select({
      totalQuantity: sql<number>`COALESCE(SUM(${stocks.quantity}), 0)`,
    })
      .from(stocks)
      .where(eq(stocks.warehouseId, warehouseId));

    const totalQuantity = result[0]?.totalQuantity || 0;
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
    const stockItems = await db.select({
      stock: stocks,
      product: products,
    })
      .from(stocks)
      .innerJoin(products, eq(stocks.productId, products.id))
      .where(eq(stocks.warehouseId, warehouseId));

    return stockItems;
  }
}

export const warehouseService = new WarehouseService();
