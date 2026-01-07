import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/client';
import { products } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  category: string;
  unitPrice: number;
  unit?: string;
}

export interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string;
  category?: string;
  unitPrice?: number;
  unit?: string;
  active?: boolean;
}

export class InventoryService {
  /**
   * Create a new product
   */
  async createProduct(input: CreateProductInput) {
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

  /**
   * Get product by ID
   */
  async getProductById(id: string) {
    const [product] = await db.select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    return product;
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string) {
    const [product] = await db.select()
      .from(products)
      .where(eq(products.sku, sku))
      .limit(1);

    return product;
  }

  /**
   * Get all products with pagination
   */
  async getAllProducts(limit = 50, offset = 0) {
    const allProducts = await db.select()
      .from(products)
      .where(eq(products.active, true))
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    return allProducts;
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(category: string, limit = 50, offset = 0) {
    const categoryProducts = await db.select()
      .from(products)
      .where(and(
        eq(products.category, category),
        eq(products.active, true)
      ))
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    return categoryProducts;
  }

  /**
   * Search products by name or SKU
   */
  async searchProducts(searchTerm: string, limit = 50, offset = 0) {
    // Simple search - in production, consider full-text search
    const results = await db.select()
      .from(products)
      .where(
        and(
          eq(products.active, true)
        )
      )
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    // Filter in memory for simple LIKE behavior
    return results.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  /**
   * Update product
   */
  async updateProduct(id: string, input: UpdateProductInput) {
    const [updatedProduct] = await db.update(products)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    return updatedProduct;
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(id: string) {
    const [deletedProduct] = await db.update(products)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    return deletedProduct;
  }

  /**
   * Validate SKU uniqueness
   */
  async validateSku(sku: string, excludeId?: string) {
    const [existing] = await db.select()
      .from(products)
      .where(eq(products.sku, sku))
      .limit(1);

    if (!existing) return true;
    if (excludeId && existing.id === excludeId) return true;
    
    return false;
  }

  /**
   * Get all unique categories
   */
  async getCategories() {
    const allProducts = await db.select({
      category: products.category,
    })
      .from(products)
      .where(eq(products.active, true))
      .orderBy(products.category);

    // Get unique categories
    const uniqueCategories = Array.from(new Set(allProducts.map(p => p.category)));
    return uniqueCategories;
  }
}

export const inventoryService = new InventoryService();
