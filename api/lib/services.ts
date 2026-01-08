import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from './db';
import { products, stocks, warehouses, stockMovements, suppliers, productSuppliers } from './schema';

export interface ProductFilters {
  active?: boolean;
  category?: string;
  page?: number;
  pageSize?: number;
}

export async function getProducts(filters: ProductFilters = {}) {
  try {
    const { page = 1, pageSize = 20 } = filters;
    let conditions = [];

    if (filters.active !== undefined) {
      conditions.push(eq(products.active, filters.active));
    }
    if (filters.category) {
      conditions.push(eq(products.category, filters.category));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const result = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereClause);

    return {
      data: result,
      pagination: {
        page,
        pageSize,
        total: Number(countResult.count),
        totalPages: Math.ceil(Number(countResult.count) / pageSize),
      },
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

export async function getProductById(id: string) {
  try {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    return product || null;
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
}

export async function createProduct(data: any) {
  try {
    const [product] = await db
      .insert(products)
      .values(data)
      .returning();

    return product;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
}

export async function updateProduct(id: string, data: any) {
  try {
    const [product] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    return product;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
}

export async function deleteProduct(id: string) {
  try {
    await db
      .delete(products)
      .where(eq(products.id, id));

    return { success: true };
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

export async function getCategories() {
  try {
    const result = await db
      .selectDistinct({ category: products.category })
      .from(products)
      .where(eq(products.active, true))
      .orderBy(products.category);

    return result.map(r => r.category);
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
}

export interface StockFilters {
  warehouseId?: string;
  productId?: string;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
}

export async function getStock(filters: StockFilters = {}) {
  try {
    const { page = 1, pageSize = 20 } = filters;
    let conditions = [];

    if (filters.warehouseId) {
      conditions.push(eq(stocks.warehouseId, filters.warehouseId));
    }
    if (filters.productId) {
      conditions.push(eq(stocks.productId, filters.productId));
    }
    if (filters.lowStock) {
      conditions.push(sql`${stocks.available} <= ${stocks.reorderLevel}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({
        id: stocks.id,
        productId: stocks.productId,
        warehouseId: stocks.warehouseId,
        quantity: stocks.quantity,
        reserved: stocks.reserved,
        available: stocks.available,
        reorderLevel: stocks.reorderLevel,
        lastCounted: stocks.lastCounted,
        product: products,
        warehouse: warehouses,
      })
      .from(stocks)
      .leftJoin(products, eq(stocks.productId, products.id))
      .leftJoin(warehouses, eq(stocks.warehouseId, warehouses.id))
      .where(whereClause)
      .orderBy(desc(stocks.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(stocks)
      .where(whereClause);

    return {
      data: result,
      pagination: {
        page,
        pageSize,
        total: Number(countResult.count),
        totalPages: Math.ceil(Number(countResult.count) / pageSize),
      },
    };
  } catch (error) {
    console.error('Error fetching stock:', error);
    throw error;
  }
}

export async function getLowStockItems() {
  try {
    const result = await db
      .select({
        id: stocks.id,
        productId: stocks.productId,
        warehouseId: stocks.warehouseId,
        available: stocks.available,
        reorderLevel: stocks.reorderLevel,
        product: products,
        warehouse: warehouses,
      })
      .from(stocks)
      .leftJoin(products, eq(stocks.productId, products.id))
      .leftJoin(warehouses, eq(stocks.warehouseId, warehouses.id))
      .where(sql`${stocks.available} <= ${stocks.reorderLevel}`)
      .orderBy(desc(stocks.available));

    return result;
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    throw error;
  }
}

export async function getWarehouseStock(warehouseId: string) {
  try {
    const result = await db
      .select({
        id: stocks.id,
        productId: stocks.productId,
        quantity: stocks.quantity,
        reserved: stocks.reserved,
        available: stocks.available,
        reorderLevel: stocks.reorderLevel,
        product: products,
      })
      .from(stocks)
      .leftJoin(products, eq(stocks.productId, products.id))
      .where(eq(stocks.warehouseId, warehouseId))
      .orderBy(desc(products.name));

    return result;
  } catch (error) {
    console.error('Error fetching warehouse stock:', error);
    throw error;
  }
}

export async function getProductStockSummary(productId: string) {
  try {
    const result = await db
      .select({
        warehouseId: stocks.warehouseId,
        quantity: stocks.quantity,
        reserved: stocks.reserved,
        available: stocks.available,
        warehouse: warehouses,
      })
      .from(stocks)
      .leftJoin(warehouses, eq(stocks.warehouseId, warehouses.id))
      .where(eq(stocks.productId, productId));

    return result;
  } catch (error) {
    console.error('Error fetching product stock summary:', error);
    throw error;
  }
}

export async function adjustStock(data: any) {
  try {
    const { productId, warehouseId, quantity, movementType, reference, notes } = data;

    // Update stock
    const [stock] = await db
      .select()
      .from(stocks)
      .where(
        and(
          eq(stocks.productId, productId),
          eq(stocks.warehouseId, warehouseId)
        )
      )
      .limit(1);

    if (!stock) {
      throw new Error('Stock not found');
    }

    const newQuantity = stock.quantity + quantity;
    const newAvailable = newQuantity - stock.reserved;

    await db
      .update(stocks)
      .set({
        quantity: newQuantity,
        available: newAvailable,
        updatedAt: new Date(),
      })
      .where(eq(stocks.id, stock.id));

    // Record movement
    await db
      .insert(stockMovements)
      .values({
        id: crypto.randomUUID(),
        productId,
        quantity,
        movementType,
        reference,
        notes,
      });

    return { success: true };
  } catch (error) {
    console.error('Error adjusting stock:', error);
    throw error;
  }
}

export async function transferStock(data: any) {
  try {
    const { productId, fromWarehouseId, toWarehouseId, quantity, initiatedBy, notes } = data;

    // This is a simplified version - in production you'd want transactions
    // Decrease from source warehouse
    await adjustStock({
      productId,
      warehouseId: fromWarehouseId,
      quantity: -quantity,
      movementType: 'TRANSFER',
      notes: `Transfer to ${toWarehouseId}`,
    });

    // Increase in destination warehouse
    await adjustStock({
      productId,
      warehouseId: toWarehouseId,
      quantity: quantity,
      movementType: 'TRANSFER',
      notes: `Transfer from ${fromWarehouseId}`,
    });

    return { success: true };
  } catch (error) {
    console.error('Error transferring stock:', error);
    throw error;
  }
}