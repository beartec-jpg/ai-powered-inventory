import { PrismaClient, Product, Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../types';

const prisma = new PrismaClient();

export interface ProductFilters {
  category?: string;
  active?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page: number;
  perPage: number;
}

export class InventoryService {
  /**
   * Get all products with pagination and filters
   */
  static async getProducts(
    filters: ProductFilters = {},
    pagination: PaginationOptions = { page: 1, perPage: 30 }
  ): Promise<{ products: Product[]; total: number }> {
    const { category, active, search } = filters;
    const { page, perPage } = pagination;

    const where: Prisma.ProductWhereInput = {};

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
        include: {
          stocks: {
            include: {
              warehouse: {
                select: {
                  id: true,
                  name: true,
                  location: true,
                },
              },
            },
          },
          suppliers: {
            include: {
              supplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total };
  }

  /**
   * Get a product by ID
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
        suppliers: {
          include: {
            supplier: true,
          },
        },
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return product;
  }

  /**
   * Create a new product
   */
  static async createProduct(data: {
    sku: string;
    name: string;
    description?: string;
    category: string;
    unitPrice: number;
    unit?: string;
  }): Promise<Product> {
    // Check if SKU already exists
    const existingProduct = await prisma.product.findUnique({
      where: { sku: data.sku },
    });

    if (existingProduct) {
      throw new ConflictError('Product with this SKU already exists');
    }

    const product = await prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        description: data.description,
        category: data.category,
        unitPrice: data.unitPrice,
        unit: data.unit || 'pcs',
      },
    });

    return product;
  }

  /**
   * Update a product
   */
  static async updateProduct(
    id: string,
    data: {
      name?: string;
      description?: string;
      category?: string;
      unitPrice?: number;
      unit?: string;
      active?: boolean;
    }
  ): Promise<Product> {
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundError('Product not found');
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
}
