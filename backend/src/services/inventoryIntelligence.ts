// Inventory Intelligence Service - Smart inventory operations for AI
import { PrismaClient } from '@prisma/client';
import { ToolExecutionResult } from '../types/chat';

const prisma = new PrismaClient();

export class InventoryIntelligence {
  /**
   * Check stock levels for a product
   */
  async checkStock(productId: string, warehouseId?: string): Promise<ToolExecutionResult> {
    try {
      const whereClause: any = { productId };
      if (warehouseId) {
        whereClause.warehouseId = warehouseId;
      }

      const stocks = await prisma.stock.findMany({
        where: whereClause,
        include: {
          product: true,
          warehouse: true,
        },
      });

      if (stocks.length === 0) {
        return {
          success: false,
          message: 'No stock found for this product',
        };
      }

      const stockData = stocks.map(stock => ({
        warehouse: stock.warehouse.name,
        warehouseId: stock.warehouseId,
        quantity: stock.quantity,
        available: stock.available,
        reserved: stock.reserved,
        reorderLevel: stock.reorderLevel,
        product: {
          name: stock.product.name,
          sku: stock.product.sku,
        },
      }));

      return {
        success: true,
        data: stockData,
        message: `Found stock information for ${stocks.length} warehouse(s)`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to check stock',
      };
    }
  }

  /**
   * Search for products by name, SKU, or category
   */
  async searchProduct(query: string, category?: string): Promise<ToolExecutionResult> {
    try {
      const whereClause: any = {
        active: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      };

      if (category) {
        whereClause.category = category;
      }

      const products = await prisma.product.findMany({
        where: whereClause,
        take: 10,
        include: {
          stocks: {
            include: {
              warehouse: true,
            },
          },
        },
      });

      if (products.length === 0) {
        return {
          success: false,
          message: `No products found matching "${query}"`,
        };
      }

      const productData = products.map(product => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        category: product.category,
        unitPrice: product.unitPrice,
        unit: product.unit,
        totalStock: product.stocks.reduce((sum, s) => sum + s.quantity, 0),
        warehouses: product.stocks.map(s => ({
          warehouse: s.warehouse.name,
          quantity: s.quantity,
          available: s.available,
        })),
      }));

      return {
        success: true,
        data: productData,
        message: `Found ${products.length} product(s)`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to search products',
      };
    }
  }

  /**
   * Transfer stock between warehouses
   */
  async transferStock(
    fromWarehouseId: string,
    toWarehouseId: string,
    productId: string,
    quantity: number,
    reason: string,
    userId: string
  ): Promise<ToolExecutionResult> {
    try {
      // Validate quantity
      if (quantity <= 0) {
        return {
          success: false,
          message: 'Quantity must be positive',
        };
      }

      // Check if source has enough stock
      const sourceStock = await prisma.stock.findUnique({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: fromWarehouseId,
          },
        },
        include: {
          product: true,
          warehouse: true,
        },
      });

      if (!sourceStock) {
        return {
          success: false,
          message: 'Product not found in source warehouse',
        };
      }

      if (sourceStock.available < quantity) {
        return {
          success: false,
          message: `Insufficient stock. Available: ${sourceStock.available}, Requested: ${quantity}`,
        };
      }

      // Create transfer record and update stocks
      const transfer = await prisma.$transaction(async (tx) => {
        // Create transfer record
        const transferRecord = await tx.stockTransfer.create({
          data: {
            fromWarehouseId,
            toWarehouseId,
            quantity,
            status: 'COMPLETED',
            initiatedBy: userId,
            notes: reason,
          },
        });

        // Reduce source stock
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

        // Increase destination stock (create if doesn't exist)
        await tx.stock.upsert({
          where: {
            productId_warehouseId: {
              productId,
              warehouseId: toWarehouseId,
            },
          },
          update: {
            quantity: { increment: quantity },
            available: { increment: quantity },
          },
          create: {
            productId,
            warehouseId: toWarehouseId,
            quantity,
            available: quantity,
            reserved: 0,
          },
        });

        // Log stock movements
        await tx.stockMovement.createMany({
          data: [
            {
              productId,
              quantity: -quantity,
              movementType: 'TRANSFER',
              reference: transferRecord.id,
              notes: `Transfer to ${toWarehouseId}: ${reason}`,
            },
            {
              productId,
              quantity,
              movementType: 'TRANSFER',
              reference: transferRecord.id,
              notes: `Transfer from ${fromWarehouseId}: ${reason}`,
            },
          ],
        });

        return transferRecord;
      });

      return {
        success: true,
        data: {
          transferId: transfer.id,
          from: fromWarehouseId,
          to: toWarehouseId,
          quantity,
        },
        message: `Successfully transferred ${quantity} units from ${sourceStock.warehouse.name}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to transfer stock',
      };
    }
  }

  /**
   * Adjust stock manually
   */
  async adjustStock(
    productId: string,
    warehouseId: string,
    quantityChange: number,
    reason: string
  ): Promise<ToolExecutionResult> {
    try {
      if (quantityChange === 0) {
        return {
          success: false,
          message: 'Quantity change cannot be zero',
        };
      }

      const stock = await prisma.$transaction(async (tx) => {
        const currentStock = await tx.stock.findUnique({
          where: {
            productId_warehouseId: {
              productId,
              warehouseId,
            },
          },
          include: {
            product: true,
            warehouse: true,
          },
        });

        if (!currentStock && quantityChange < 0) {
          throw new Error('Cannot reduce stock that does not exist');
        }

        // Update or create stock
        const updatedStock = await tx.stock.upsert({
          where: {
            productId_warehouseId: {
              productId,
              warehouseId,
            },
          },
          update: {
            quantity: { increment: quantityChange },
            available: { increment: quantityChange },
          },
          create: {
            productId,
            warehouseId,
            quantity: Math.max(0, quantityChange),
            available: Math.max(0, quantityChange),
            reserved: 0,
          },
          include: {
            product: true,
            warehouse: true,
          },
        });

        // Log movement
        await tx.stockMovement.create({
          data: {
            productId,
            quantity: quantityChange,
            movementType: 'ADJUSTMENT',
            notes: reason,
          },
        });

        return updatedStock;
      });

      return {
        success: true,
        data: {
          product: stock.product.name,
          warehouse: stock.warehouse.name,
          newQuantity: stock.quantity,
          change: quantityChange,
        },
        message: `Stock adjusted by ${quantityChange > 0 ? '+' : ''}${quantityChange} units`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to adjust stock',
      };
    }
  }

  /**
   * Create a parts list for a job
   */
  async createPartsList(
    jobNumber: string,
    items: Array<{ product_id: string; quantity: number }>,
    customerName: string,
    notes?: string
  ): Promise<ToolExecutionResult> {
    try {
      // This would typically create a purchase order or job record
      // For now, we'll create a simple record structure
      const partsListData = {
        jobNumber,
        customerName,
        notes,
        items: await Promise.all(
          items.map(async (item) => {
            const product = await prisma.product.findUnique({
              where: { id: item.product_id },
            });
            return {
              productId: item.product_id,
              productName: product?.name || 'Unknown',
              quantity: item.quantity,
            };
          })
        ),
        createdAt: new Date(),
      };

      return {
        success: true,
        data: partsListData,
        message: `Parts list created for job ${jobNumber}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to create parts list',
      };
    }
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(threshold?: number, warehouseId?: string): Promise<ToolExecutionResult> {
    try {
      const whereClause: any = {};
      if (warehouseId) {
        whereClause.warehouseId = warehouseId;
      }

      const stocks = await prisma.stock.findMany({
        where: whereClause,
        include: {
          product: true,
          warehouse: true,
        },
      });

      const lowStockItems = stocks.filter(stock => {
        const effectiveThreshold = threshold ?? stock.reorderLevel;
        return stock.quantity <= effectiveThreshold;
      });

      if (lowStockItems.length === 0) {
        return {
          success: true,
          data: [],
          message: 'No low stock items found',
        };
      }

      const itemsData = lowStockItems.map(stock => ({
        product: stock.product.name,
        sku: stock.product.sku,
        warehouse: stock.warehouse.name,
        currentQuantity: stock.quantity,
        reorderLevel: stock.reorderLevel,
        shortfall: stock.reorderLevel - stock.quantity,
      }));

      return {
        success: true,
        data: itemsData,
        message: `Found ${lowStockItems.length} low stock item(s)`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to get low stock items',
      };
    }
  }

  /**
   * Get warehouse inventory report
   */
  async warehouseInventoryReport(warehouseId: string): Promise<ToolExecutionResult> {
    try {
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId },
        include: {
          stocks: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!warehouse) {
        return {
          success: false,
          message: 'Warehouse not found',
        };
      }

      const totalValue = warehouse.stocks.reduce(
        (sum, stock) => sum + stock.quantity * stock.product.unitPrice,
        0
      );

      const report = {
        warehouse: {
          id: warehouse.id,
          name: warehouse.name,
          location: warehouse.location,
        },
        summary: {
          totalProducts: warehouse.stocks.length,
          totalItems: warehouse.stocks.reduce((sum, s) => sum + s.quantity, 0),
          totalValue,
        },
        items: warehouse.stocks.map(stock => ({
          product: stock.product.name,
          sku: stock.product.sku,
          quantity: stock.quantity,
          available: stock.available,
          reserved: stock.reserved,
          unitPrice: stock.product.unitPrice,
          totalValue: stock.quantity * stock.product.unitPrice,
        })),
      };

      return {
        success: true,
        data: report,
        message: `Inventory report for ${warehouse.name}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to generate warehouse report',
      };
    }
  }

  /**
   * Get supplier availability for a product
   */
  async supplierAvailability(productId: string): Promise<ToolExecutionResult> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          suppliers: {
            include: {
              supplier: true,
            },
          },
        },
      });

      if (!product) {
        return {
          success: false,
          message: 'Product not found',
        };
      }

      if (product.suppliers.length === 0) {
        return {
          success: false,
          message: 'No suppliers found for this product',
        };
      }

      const supplierData = product.suppliers.map(ps => ({
        supplier: ps.supplier.name,
        supplierSku: ps.supplierSku,
        leadTime: ps.leadTime ? `${ps.leadTime} days` : 'Not specified',
        minOrder: ps.minOrder,
        contact: {
          email: ps.supplier.email,
          phone: ps.supplier.phone,
        },
      }));

      return {
        success: true,
        data: {
          product: product.name,
          sku: product.sku,
          suppliers: supplierData,
        },
        message: `Found ${supplierData.length} supplier(s)`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to get supplier information',
      };
    }
  }

  /**
   * Get full product details
   */
  async getProductDetails(productId: string): Promise<ToolExecutionResult> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
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
        },
      });

      if (!product) {
        return {
          success: false,
          message: 'Product not found',
        };
      }

      const totalStock = product.stocks.reduce((sum, s) => sum + s.quantity, 0);
      const totalValue = product.stocks.reduce(
        (sum, s) => sum + s.quantity * product.unitPrice,
        0
      );

      const details = {
        id: product.id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        category: product.category,
        unitPrice: product.unitPrice,
        unit: product.unit,
        active: product.active,
        inventory: {
          totalStock,
          totalValue,
          warehouses: product.stocks.map(s => ({
            warehouse: s.warehouse.name,
            quantity: s.quantity,
            available: s.available,
            reserved: s.reserved,
          })),
        },
        suppliers: product.suppliers.map(ps => ({
          name: ps.supplier.name,
          leadTime: ps.leadTime,
        })),
      };

      return {
        success: true,
        data: details,
        message: `Product details for ${product.name}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to get product details',
      };
    }
  }
}

// Singleton instance
let inventoryIntelligenceInstance: InventoryIntelligence | null = null;

export function getInventoryIntelligence(): InventoryIntelligence {
  if (!inventoryIntelligenceInstance) {
    inventoryIntelligenceInstance = new InventoryIntelligence();
  }
  return inventoryIntelligenceInstance;
}
