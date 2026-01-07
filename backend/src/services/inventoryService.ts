import { prisma } from '../lib/prisma';
import { Product } from '@prisma/client';

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

export interface ProductFilters {
  category?: string;
  active?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page: number;
  perPage: number;
}

class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class InventoryService {
  /**
   * Get products with filtering and pagination
   */
  static async getProducts(
    filters: ProductFilters,
    pagination: PaginationOptions
  ): Promise<{ products: Product[]; total: number }> {
    const { category, active, search } = filters;
    const { page, perPage } = pagination;

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (active !== undefined) {
      where.active = active;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total };
  }

  /**
   * Get all unique categories
   */
  static async getCategories(): Promise<string[]> {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    return products.map((p) => p.category);
  }

  /**
   * Get product by ID
   */
  static async getProductById(id: string): Promise<Product> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return product;
  }

  /**
   * Get product by SKU
   */
  static async getProductBySku(sku: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { sku },
      include: {
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
    });
  }

  /**
   * Create a new product
   */
  static async createProduct(data: CreateProductInput): Promise<Product> {
    // Check if SKU already exists
    const existing = await prisma.product.findUnique({
      where: { sku: data.sku },
    });

    if (existing) {
      throw new ConflictError('Product with this SKU already exists');
    }

    const product = await prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        description: data.description || null,
        category: data.category,
        unitPrice: data.unitPrice,
        unit: data.unit || 'pcs',
        active: true,
      },
    });

    return product;
  }

  /**
   * Update a product
   */
  static async updateProduct(id: string, data: UpdateProductInput): Promise<Product> {
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundError('Product not found');
    }

    // If updating SKU, check if new SKU is unique
    if (data.sku && data.sku !== existingProduct.sku) {
      const skuExists = await prisma.product.findUnique({
        where: { sku: data.sku },
      });

      if (skuExists) {
        throw new ConflictError('Product with this SKU already exists');
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    return product;
  }

  /**
   * Delete a product (soft delete)
   */
  static async deleteProduct(id: string): Promise<Product> {
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundError('Product not found');
    }

    // Soft delete by marking as inactive
    const product = await prisma.product.update({
      where: { id },
      data: { active: false },
    });

    return product;
  }

  /**
   * Check if SKU is unique
   */
  static async isSkuUnique(sku: string, excludeId?: string): Promise<boolean> {
    const product = await prisma.product.findUnique({
      where: { sku },
    });

    if (!product) {
      return true;
    }

    // If excludeId is provided, check if it's the same product
    if (excludeId && product.id === excludeId) {
      return true;
    }

    return false;
  }

  /**
   * Search products
   */
  static async searchProducts(
    searchTerm: string,
    limit = 50,
    offset = 0
  ): Promise<Product[]> {
    return prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { sku: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get products by category
   */
  static async getProductsByCategory(
    category: string,
    limit = 50,
    offset = 0
  ): Promise<Product[]> {
    return prisma.product.findMany({
      where: {
        category,
        active: true,
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}

// Export instance for compatibility with inventoryIntelligence.ts
export const inventoryService = {
  getProductBySku: (sku: string) => InventoryService.getProductBySku(sku),
  searchProducts: (searchTerm: string, limit?: number, offset?: number) =>
    InventoryService.searchProducts(searchTerm, limit, offset),
  getProductsByCategory: (category: string, limit?: number, offset?: number) =>
    InventoryService.getProductsByCategory(category, limit, offset),
};
