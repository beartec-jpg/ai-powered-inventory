/**
 * Action Types for AI Command Processing
 */

export type ActionCategory = 
  | 'STOCK_MANAGEMENT'
  | 'CATALOGUE_MANAGEMENT'
  | 'CUSTOMER_MANAGEMENT'
  | 'EQUIPMENT_MANAGEMENT'
  | 'JOB_MANAGEMENT'
  | 'SUPPLIER_MANAGEMENT';

export type ActionType =
  // Stock Management
  | 'ADD_STOCK'
  | 'RECEIVE_STOCK'
  | 'REMOVE_STOCK'
  | 'USE_STOCK'
  | 'TRANSFER_STOCK'
  | 'COUNT_STOCK'
  | 'STOCK_COUNT'
  | 'SEARCH_STOCK'
  | 'LOW_STOCK_REPORT'
  | 'SET_MIN_STOCK'
  | 'PUT_AWAY_STOCK'
  // Catalogue Management
  | 'ADD_PRODUCT'
  | 'CREATE_CATALOGUE_ITEM'
  | 'UPDATE_PRODUCT'
  | 'UPDATE_CATALOGUE_ITEM'
  | 'SEARCH_CATALOGUE'
  // Customer Management
  | 'ADD_CUSTOMER'
  | 'CREATE_CUSTOMER'
  | 'UPDATE_CUSTOMER'
  | 'ADD_SITE'
  | 'ADD_SITE_ADDRESS'
  | 'SEARCH_CUSTOMERS'
  // Equipment Management
  | 'ADD_EQUIPMENT'
  | 'CREATE_EQUIPMENT'
  | 'UPDATE_EQUIPMENT'
  | 'INSTALL_PART'
  | 'INSTALL_FROM_STOCK'
  | 'INSTALL_DIRECT_ORDER'
  | 'SEARCH_EQUIPMENT'
  | 'LIST_EQUIPMENT'
  | 'QUERY_EQUIPMENT_PARTS'
  | 'QUERY_CUSTOMER_PARTS'
  // Job Management
  | 'CREATE_JOB'
  | 'UPDATE_JOB'
  | 'SCHEDULE_JOB'
  | 'START_JOB'
  | 'COMPLETE_JOB'
  | 'ADD_PARTS_TO_JOB'
  | 'ADD_PART_TO_JOB'
  | 'SEARCH_JOBS'
  | 'LIST_JOBS'
  // Supplier Management
  | 'ADD_SUPPLIER'
  | 'CREATE_SUPPLIER'
  | 'CREATE_ORDER'
  | 'CREATE_PURCHASE_ORDER'
  | 'RECEIVE_ORDER'
  | 'RECEIVE_PURCHASE_ORDER'
  // Legacy/Fallback
  | 'QUERY_INVENTORY'
  | 'ADJUST_STOCK'
  | 'CREATE_PRODUCT';

export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  examples?: string[];
}

export interface ActionDefinition {
  name: ActionType;
  category: ActionCategory;
  description: string;
  keywords: string[];
  parameters: ParameterDefinition[];
  examples: {
    input: string;
    expectedParams: Record<string, unknown>;
  }[];
}

export interface ClassificationResult {
  action: ActionType;
  confidence: number;
  reasoning?: string;
}

export interface ExtractionResult {
  parameters: Record<string, unknown>;
  missingRequired: string[];
  confidence: number;
}

export interface ParsedCommand {
  action: ActionType;
  parameters: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  missingRequired?: string[];
  clarificationNeeded?: string;
  debug?: {
    stage1: {
      action: ActionType;
      confidence: number;
      reasoning?: string;
    };
    stage2: {
      parameters: Record<string, unknown>;
      confidence: number;
      missingRequired: string[];
    };
    usedOverride: boolean;
    overrideReason?: string;
  };
}
