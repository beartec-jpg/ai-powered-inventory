import { prisma } from '../db/prisma';

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
    const product = await prisma.product.create({
      data: {
        sku: input.sku,
        name: input.name,
        description: input.description || null,
        category: input.category,
        unitPrice: input.unitPrice,
        unit: input.unit || 'pcs',
        active: true,
      },
    });

    return product;
  }

  /**
   * Get product by ID
   */
  async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    return product;
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string) {
    const product = await prisma.product.findUnique({
      where: { sku },
    });

    return product;
  }

  /**
   * Get all products with pagination
   */
  async getAllProducts(limit = 50, offset = 0) {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return products;
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(category: string, limit = 50, offset = 0) {
    const products = await prisma.product.findMany({
      where: {
        category,
        active: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return products;
  }

  /**
   * Search products by name or SKU
   */
  async searchProducts(searchTerm: string, limit = 50, offset = 0) {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { sku: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return products;
  }

  /**
   * Update product
   */
  async updateProduct(id: string, input: UpdateProductInput) {
    const product = await prisma.product.update({
      where: { id },
      data: input,
    });

    return product;
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(id: string) {
    const product = await prisma.product.update({
      where: { id },
      data: { active: false },
    });

    return product;
  }

  /**
   * Validate SKU uniqueness
   */
  async validateSku(sku: string, excludeId?: string) {
    const existing = await prisma.product.findUnique({
      where: { sku },
    });

    if (!existing) return true;
    if (excludeId && existing.id === excludeId) return true;
    
    return false;
  }

  /**
   * Get all unique categories
   */
  async getCategories() {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    return products.map(p => p.category);
  }
}

export const inventoryService = new InventoryService();
