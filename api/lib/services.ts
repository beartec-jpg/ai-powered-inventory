import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from './db';
import { products, stocks, warehouses, users, stockMovements } from './schema';
import { v4 as uuidv4 } from 'uuid';

// Product Services
export async function getProducts(filters: {
  category?: string;
  active?: boolean;
  search?: string;
}, pagination: { page: number; perPage: number }) {
  const { page, perPage } = pagination;
  const offset = (page - 1) * perPage;

  let conditions = [];
  if (filters.active !== undefined) {
    conditions.push(eq(products.active, filters.active));
  }
  if (filters.category) {
    conditions.push(eq(products.category, filters.category));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [productList, totalCount] = await Promise.all([
    db.select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereClause)
  ]);

  // Filter by search in memory if needed
  let filteredProducts = productList;
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filteredProducts = productList.filter(p => 
      p.name.toLowerCase().includes(searchLower) || 
      p.sku.toLowerCase().includes(searchLower)
    );
  }

  return {
    products: filteredProducts,
    total: totalCount[0]?.count || 0,
  };
}

export async function getProductById(id: string) {
  const [product] = await db.select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) {
    throw new Error('Product not found');
  }

  return product;
}

export async function createProduct(input: {
  sku: string;
  name: string;
  description?: string;
  category: string;
  unitPrice: number;
  unit?: string;
}) {
  const [product] = await db.insert(products).values({
    id: uuidv4(),
    sku: input.sku,
    name: input.name,
    description: input.description || null,
    category: input.category,
    unitPrice: input.unitPrice,
    unit: input.unit || 'pcs',
    active: true,
  }).returning();

  return product;
}

export async function updateProduct(id: string, input: {
  name?: string;
  description?: string;
  category?: string;
  unitPrice?: number;
  unit?: string;
  active?: boolean;
}) {
  const [product] = await db.update(products)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();

  if (!product) {
    throw new Error('Product not found');
  }

  return product;
}

export async function deleteProduct(id: string) {
  const [product] = await db.update(products)
    .set({
      active: false,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();

  if (!product) {
    throw new Error('Product not found');
  }

  return product;
}

export async function getCategories() {
  const categoryList = await db.selectDistinct({ category: products.category })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(products.category);

  return categoryList.map(c => c.category);
}

// Stock Services
export async function getStock(filters: {
  warehouseId?: string;
  productId?: string;
  lowStock?: boolean;
}, pagination: { page: number; perPage: number }) {
  const { page, perPage } = pagination;
  const offset = (page - 1) * perPage;

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

  const [stockList, totalCount] = await Promise.all([
    db.select({
      stock: stocks,
      product: products,
      warehouse: warehouses,
    })
      .from(stocks)
      .innerJoin(products, eq(stocks.productId, products.id))
      .innerJoin(warehouses, eq(stocks.warehouseId, warehouses.id))
      .where(whereClause)
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(stocks)
      .where(whereClause)
  ]);

  return {
    stocks: stockList,
    total: totalCount[0]?.count || 0,
  };
}

export async function getLowStockItems(page: number, perPage: number) {
  return getStock({ lowStock: true }, { page, perPage });
}

export async function getWarehouseStock(warehouseId: string, page: number, perPage: number) {
  return getStock({ warehouseId }, { page, perPage });
}

export async function getProductStockSummary(productId: string) {
  const stockList = await db.select({
    stock: stocks,
    warehouse: warehouses,
  })
    .from(stocks)
    .innerJoin(warehouses, eq(stocks.warehouseId, warehouses.id))
    .where(eq(stocks.productId, productId));

  const totalQuantity = stockList.reduce((sum, item) => sum + (item.stock.quantity || 0), 0);
  const totalAvailable = stockList.reduce((sum, item) => sum + (item.stock.available || 0), 0);
  const totalReserved = stockList.reduce((sum, item) => sum + (item.stock.reserved || 0), 0);

  return {
    productId,
    totalQuantity,
    totalAvailable,
    totalReserved,
    warehouses: stockList,
  };
}

export async function adjustStock(
  productId: string,
  warehouseId: string,
  quantity: number,
  reason: string,
  notes?: string,
  userId?: string
) {
  // Get existing stock
  const [existingStock] = await db.select()
    .from(stocks)
    .where(
      and(
        eq(stocks.productId, productId),
        eq(stocks.warehouseId, warehouseId)
      )
    )
    .limit(1);

  if (!existingStock) {
    throw new Error('Stock entry not found');
  }

  const newQuantity = existingStock.quantity + quantity;
  const newAvailable = newQuantity - existingStock.reserved;

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
    .where(eq(stocks.id, existingStock.id))
    .returning();

  // Record movement
  await db.insert(stockMovements).values({
    id: uuidv4(),
    productId,
    quantity,
    movementType: 'ADJUSTMENT',
    reference: reason,
    notes: notes || null,
  });

  return updatedStock;
}

export async function transferStock(
  productId: string,
  fromWarehouseId: string,
  toWarehouseId: string,
  quantity: number,
  notes?: string,
  userId?: string
) {
  // Get source stock
  const [fromStock] = await db.select()
    .from(stocks)
    .where(
      and(
        eq(stocks.productId, productId),
        eq(stocks.warehouseId, fromWarehouseId)
      )
    )
    .limit(1);

  if (!fromStock || fromStock.available < quantity) {
    throw new Error('Insufficient stock in source warehouse');
  }

  // Decrease from source
  await adjustStock(
    productId,
    fromWarehouseId,
    -quantity,
    'TRANSFER',
    `Transfer to ${toWarehouseId}`,
    userId
  );

  // Increase in destination
  await adjustStock(
    productId,
    toWarehouseId,
    quantity,
    'TRANSFER',
    `Transfer from ${fromWarehouseId}`,
    userId
  );

  return { success: true };
}
