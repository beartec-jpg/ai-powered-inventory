import { stockService } from './stockService';
import { inventoryService } from './inventoryService';
import { warehouseService } from './warehouseService';

/**
 * AI Tool Functions for Inventory Intelligence
 * These functions are callable by the xAI chat system
 */

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class InventoryIntelligence {
  /**
   * Check stock levels for a product
   */
  async checkStock(productSku: string): Promise<ToolResult> {
    try {
      const product = await inventoryService.getProductBySku(productSku);
      
      if (!product) {
        return {
          success: false,
          error: `Product with SKU "${productSku}" not found`,
        };
      }

      const stockLevels = await stockService.getProductStock(product.id);

      return {
        success: true,
        data: {
          product: {
            sku: product.sku,
            name: product.name,
            category: product.category,
          },
          stockLevels: stockLevels.map(s => ({
            warehouse: s.warehouse.name,
            location: s.warehouse.location,
            quantity: s.stock.quantity,
            available: s.stock.available,
            reserved: s.stock.reserved,
            reorderLevel: s.stock.reorderLevel,
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Transfer stock between warehouses
   */
  async transferStock(
    productSku: string,
    fromWarehouse: string,
    toWarehouse: string,
    quantity: number
  ): Promise<ToolResult> {
    try {
      const product = await inventoryService.getProductBySku(productSku);
      if (!product) {
        return {
          success: false,
          error: `Product with SKU "${productSku}" not found`,
        };
      }

      const fromWh = await warehouseService.getWarehouseByName(fromWarehouse);
      if (!fromWh) {
        return {
          success: false,
          error: `Warehouse "${fromWarehouse}" not found`,
        };
      }

      const toWh = await warehouseService.getWarehouseByName(toWarehouse);
      if (!toWh) {
        return {
          success: false,
          error: `Warehouse "${toWarehouse}" not found`,
        };
      }

      await stockService.transferStock({
        productId: product.id,
        fromWarehouseId: fromWh.id,
        toWarehouseId: toWh.id,
        quantity,
        notes: 'Transfer initiated by AI assistant',
      });

      return {
        success: true,
        data: {
          message: `Transferred ${quantity} units of ${product.name} from ${fromWarehouse} to ${toWarehouse}`,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(): Promise<ToolResult> {
    try {
      const lowStock = await stockService.getLowStockItems();

      return {
        success: true,
        data: {
          count: lowStock.length,
          items: lowStock.map(item => ({
            product: item.product.name,
            sku: item.product.sku,
            warehouse: item.warehouse.name,
            available: item.stock.available,
            reorderLevel: item.stock.reorderLevel,
            deficit: item.stock.reorderLevel - item.stock.available,
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search products by category or name
   */
  async searchProducts(searchTerm: string): Promise<ToolResult> {
    try {
      const products = await inventoryService.searchProducts(searchTerm);

      return {
        success: true,
        data: {
          count: products.length,
          products: products.map(p => ({
            sku: p.sku,
            name: p.name,
            category: p.category,
            unitPrice: p.unitPrice,
            unit: p.unit,
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get warehouse utilization
   */
  async getWarehouseUtilization(warehouseName: string): Promise<ToolResult> {
    try {
      const warehouse = await warehouseService.getWarehouseByName(warehouseName);
      
      if (!warehouse) {
        return {
          success: false,
          error: `Warehouse "${warehouseName}" not found`,
        };
      }

      const utilization = await warehouseService.getWarehouseUtilization(warehouse.id);

      return {
        success: true,
        data: utilization,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all warehouses
   */
  async listWarehouses(): Promise<ToolResult> {
    try {
      const warehouses = await warehouseService.getAllWarehouses();

      return {
        success: true,
        data: {
          count: warehouses.length,
          warehouses: warehouses.map(w => ({
            name: w.name,
            location: w.location,
            capacity: w.capacity,
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(category: string): Promise<ToolResult> {
    try {
      const products = await inventoryService.getProductsByCategory(category);

      return {
        success: true,
        data: {
          category,
          count: products.length,
          products: products.map(p => ({
            sku: p.sku,
            name: p.name,
            unitPrice: p.unitPrice,
            unit: p.unit,
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Adjust stock (add or remove)
   */
  async adjustStock(
    productSku: string,
    warehouseName: string,
    quantity: number,
    reason: string
  ): Promise<ToolResult> {
    try {
      const product = await inventoryService.getProductBySku(productSku);
      if (!product) {
        return {
          success: false,
          error: `Product with SKU "${productSku}" not found`,
        };
      }

      const warehouse = await warehouseService.getWarehouseByName(warehouseName);
      if (!warehouse) {
        return {
          success: false,
          error: `Warehouse "${warehouseName}" not found`,
        };
      }

      const movementType = quantity > 0 ? 'INBOUND' : 'OUTBOUND';
      
      await stockService.adjustStock(
        product.id,
        warehouse.id,
        quantity,
        movementType,
        'AI-initiated adjustment',
        reason
      );

      return {
        success: true,
        data: {
          message: `Adjusted stock for ${product.name} in ${warehouseName} by ${quantity} units`,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get stock movements history
   */
  async getStockHistory(productSku: string, limit = 20): Promise<ToolResult> {
    try {
      const product = await inventoryService.getProductBySku(productSku);
      if (!product) {
        return {
          success: false,
          error: `Product with SKU "${productSku}" not found`,
        };
      }

      const movements = await stockService.getStockMovements(product.id, limit);

      return {
        success: true,
        data: {
          product: {
            sku: product.sku,
            name: product.name,
          },
          movements: movements.map(m => ({
            quantity: m.quantity,
            type: m.movementType,
            reference: m.reference,
            notes: m.notes,
            date: m.createdAt,
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create parts list for a job
   */
  async createPartsList(
    jobNumber: string,
    items: Array<{ product_id: string; quantity: number }>,
    customerName: string,
    notes?: string
  ): Promise<ToolResult> {
    try {
      // Validate all products exist
      const productDetails = [];
      for (const item of items) {
        const product = await inventoryService.getProductById(item.product_id);
        if (!product) {
          return {
            success: false,
            error: `Product with ID "${item.product_id}" not found`,
          };
        }
        productDetails.push({
          product,
          quantity: item.quantity,
        });
      }

      // Create parts list summary
      const partsList = {
        jobNumber,
        customerName,
        notes,
        items: productDetails.map(pd => ({
          productId: pd.product.id,
          sku: pd.product.sku,
          name: pd.product.name,
          quantity: pd.quantity,
          unitPrice: pd.product.unitPrice,
          totalPrice: pd.product.unitPrice * pd.quantity,
        })),
        totalValue: productDetails.reduce(
          (sum, pd) => sum + pd.product.unitPrice * pd.quantity,
          0
        ),
        createdAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: partsList,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get warehouse inventory report
   */
  async warehouseInventoryReport(warehouseId: string): Promise<ToolResult> {
    try {
      const warehouse = await warehouseService.getWarehouseById(warehouseId);
      if (!warehouse) {
        return {
          success: false,
          error: `Warehouse with ID "${warehouseId}" not found`,
        };
      }

      const stocks = await stockService.getWarehouseStock(warehouseId);
      
      // Calculate totals
      let totalItems = 0;
      let totalValue = 0;
      let lowStockCount = 0;

      const stockDetails = await Promise.all(
        stocks.map(async (stock: any) => {
          const product = await inventoryService.getProductById(stock.productId);
          if (!product) return null;

          const value = product.unitPrice * stock.quantity;
          totalItems += stock.quantity;
          totalValue += value;
          if (stock.quantity <= stock.reorderLevel) {
            lowStockCount++;
          }

          return {
            productId: stock.productId,
            sku: product.sku,
            name: product.name,
            category: product.category,
            quantity: stock.quantity,
            available: stock.available,
            reserved: stock.reserved,
            reorderLevel: stock.reorderLevel,
            unitPrice: product.unitPrice,
            totalValue: value,
            needsReorder: stock.quantity <= stock.reorderLevel,
          };
        })
      );

      return {
        success: true,
        data: {
          warehouse: {
            id: warehouse.id,
            name: warehouse.name,
            location: warehouse.location,
            capacity: warehouse.capacity,
          },
          summary: {
            totalItems,
            totalValue: totalValue.toFixed(2),
            lowStockCount,
            productCount: stocks.length,
          },
          stocks: stockDetails.filter(s => s !== null),
          reportDate: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get supplier availability for a product
   */
  async supplierAvailability(productId: string): Promise<ToolResult> {
    try {
      const product = await inventoryService.getProductById(productId);
      if (!product) {
        return {
          success: false,
          error: `Product with ID "${productId}" not found`,
        };
      }

      // Note: This is a simplified version as the supplier relationship
      // would require Prisma or additional database queries
      return {
        success: true,
        data: {
          product: {
            id: product.id,
            sku: product.sku,
            name: product.name,
          },
          suppliers: [],
          message: 'Supplier information not available in current implementation',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get full product details
   */
  async getProductDetails(productId: string): Promise<ToolResult> {
    try {
      const product = await inventoryService.getProductById(productId);
      if (!product) {
        return {
          success: false,
          error: `Product with ID "${productId}" not found`,
        };
      }

      // Get stock levels across all warehouses
      const stocks = await stockService.getProductStock(productId);

      return {
        success: true,
        data: {
          product: {
            id: product.id,
            sku: product.sku,
            name: product.name,
            description: product.description,
            category: product.category,
            unitPrice: product.unitPrice,
            unit: product.unit,
            active: product.active,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
          },
          stockLevels: stocks.map((s: any) => ({
            warehouseId: s.warehouseId,
            warehouse: s.warehouse?.name || 'Unknown',
            quantity: s.stock.quantity,
            available: s.stock.available,
            reserved: s.stock.reserved,
            reorderLevel: s.stock.reorderLevel,
          })),
          totalStock: stocks.reduce((sum: number, s: any) => sum + s.stock.quantity, 0),
          totalAvailable: stocks.reduce((sum: number, s: any) => sum + s.stock.available, 0),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const inventoryIntelligence = new InventoryIntelligence();
