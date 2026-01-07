// Tool Executor - Handles execution of inventory tools called by AI
import { getInventoryIntelligence } from './inventoryIntelligence';
import { ToolExecutionResult, UserContext } from '../types/chat';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ToolExecutor {
  private inventoryIntelligence = getInventoryIntelligence();

  /**
   * Execute a tool by name with parameters
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    userContext: UserContext
  ): Promise<ToolExecutionResult> {
    console.log(`Executing tool: ${toolName}`, parameters);

    // Validate user authorization
    const authCheck = await this.checkAuthorization(toolName, parameters, userContext);
    if (!authCheck.authorized) {
      return {
        success: false,
        error: 'Authorization failed',
        message: authCheck.reason || 'You do not have permission to perform this action',
      };
    }

    try {
      switch (toolName) {
        case 'check_stock':
          return await this.inventoryIntelligence.checkStock(
            parameters.product_id,
            parameters.warehouse_id
          );

        case 'search_product':
          return await this.inventoryIntelligence.searchProduct(
            parameters.query,
            parameters.category
          );

        case 'transfer_stock':
          // Validate warehouse access
          if (
            !userContext.warehouseAccess.includes(parameters.from_warehouse_id) ||
            !userContext.warehouseAccess.includes(parameters.to_warehouse_id)
          ) {
            return {
              success: false,
              message: 'You do not have access to one or both warehouses',
            };
          }
          return await this.inventoryIntelligence.transferStock(
            parameters.from_warehouse_id,
            parameters.to_warehouse_id,
            parameters.product_id,
            parameters.quantity,
            parameters.reason,
            userContext.userId
          );

        case 'adjust_stock':
          // Validate warehouse access
          if (!userContext.warehouseAccess.includes(parameters.warehouse_id)) {
            return {
              success: false,
              message: 'You do not have access to this warehouse',
            };
          }
          return await this.inventoryIntelligence.adjustStock(
            parameters.product_id,
            parameters.warehouse_id,
            parameters.quantity_change,
            parameters.reason
          );

        case 'create_parts_list':
          return await this.inventoryIntelligence.createPartsList(
            parameters.job_number,
            parameters.items,
            parameters.customer_name,
            parameters.notes
          );

        case 'get_low_stock_items':
          // Filter by user's accessible warehouses if warehouse_id provided
          if (
            parameters.warehouse_id &&
            !userContext.warehouseAccess.includes(parameters.warehouse_id)
          ) {
            return {
              success: false,
              message: 'You do not have access to this warehouse',
            };
          }
          return await this.inventoryIntelligence.getLowStockItems(
            parameters.threshold,
            parameters.warehouse_id
          );

        case 'warehouse_inventory_report':
          // Validate warehouse access
          if (!userContext.warehouseAccess.includes(parameters.warehouse_id)) {
            return {
              success: false,
              message: 'You do not have access to this warehouse',
            };
          }
          return await this.inventoryIntelligence.warehouseInventoryReport(
            parameters.warehouse_id
          );

        case 'supplier_availability':
          return await this.inventoryIntelligence.supplierAvailability(parameters.product_id);

        case 'get_product_details':
          return await this.inventoryIntelligence.getProductDetails(parameters.product_id);

        default:
          return {
            success: false,
            error: 'Unknown tool',
            message: `Tool "${toolName}" is not recognized`,
          };
      }
    } catch (error: any) {
      console.error(`Error executing tool ${toolName}:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to execute ${toolName}`,
      };
    }
  }

  /**
   * Check if user is authorized to execute a tool
   */
  private async checkAuthorization(
    toolName: string,
    parameters: Record<string, any>,
    userContext: UserContext
  ): Promise<{ authorized: boolean; reason?: string }> {
    // Read-only operations allowed for all roles
    const readOnlyTools = [
      'check_stock',
      'search_product',
      'get_low_stock_items',
      'supplier_availability',
      'get_product_details',
      'warehouse_inventory_report',
    ];

    // Modification operations require STAFF, MANAGER, or ADMIN role
    const modificationTools = ['transfer_stock', 'adjust_stock', 'create_parts_list'];

    // VIEWER role can only use read-only tools
    if (userContext.role === 'VIEWER' && !readOnlyTools.includes(toolName)) {
      return {
        authorized: false,
        reason: 'Your role does not have permission to modify inventory',
      };
    }

    // STAFF can do most operations but not adjust_stock
    if (userContext.role === 'STAFF' && toolName === 'adjust_stock') {
      return {
        authorized: false,
        reason: 'Only managers and admins can adjust stock manually',
      };
    }

    return { authorized: true };
  }

  /**
   * Validate tool parameters
   */
  validateParameters(toolName: string, parameters: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    switch (toolName) {
      case 'check_stock':
        if (!parameters.product_id) {
          errors.push('product_id is required');
        }
        break;

      case 'search_product':
        if (!parameters.query) {
          errors.push('query is required');
        }
        break;

      case 'transfer_stock':
        if (!parameters.from_warehouse_id) errors.push('from_warehouse_id is required');
        if (!parameters.to_warehouse_id) errors.push('to_warehouse_id is required');
        if (!parameters.product_id) errors.push('product_id is required');
        if (!parameters.quantity || parameters.quantity <= 0) {
          errors.push('quantity must be positive');
        }
        if (!parameters.reason) errors.push('reason is required');
        break;

      case 'adjust_stock':
        if (!parameters.product_id) errors.push('product_id is required');
        if (!parameters.warehouse_id) errors.push('warehouse_id is required');
        if (parameters.quantity_change === undefined || parameters.quantity_change === 0) {
          errors.push('quantity_change must be non-zero');
        }
        if (!parameters.reason) errors.push('reason is required');
        break;

      case 'create_parts_list':
        if (!parameters.job_number) errors.push('job_number is required');
        if (!parameters.items || !Array.isArray(parameters.items)) {
          errors.push('items array is required');
        }
        if (!parameters.customer_name) errors.push('customer_name is required');
        break;

      case 'warehouse_inventory_report':
        if (!parameters.warehouse_id) errors.push('warehouse_id is required');
        break;

      case 'supplier_availability':
      case 'get_product_details':
        if (!parameters.product_id) errors.push('product_id is required');
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
let toolExecutorInstance: ToolExecutor | null = null;

export function getToolExecutor(): ToolExecutor {
  if (!toolExecutorInstance) {
    toolExecutorInstance = new ToolExecutor();
  }
  return toolExecutorInstance;
}
