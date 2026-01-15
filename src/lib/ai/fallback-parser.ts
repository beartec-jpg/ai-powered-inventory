/**
 * Enhanced Local Fallback Parser
 * Regex patterns for common command patterns when AI fails
 */

import type { ActionType } from '../actions/types';

export interface FallbackResult {
  action: ActionType;
  parameters: Record<string, unknown>;
  confidence: number;
}

/**
 * Try to parse command using regex patterns
 * Returns null if no pattern matches
 */
export function tryFallbackParse(command: string): FallbackResult | null {
  const lower = command.toLowerCase().trim();

  // Pattern: "Add [qty] [item] to/into [location]"
  const addMatch = lower.match(
    /^(?:add|put|receive|received)\s+(\d+)\s+(.+?)\s+(?:to|into|at|in)\s+(.+)$/i
  );
  if (addMatch) {
    return {
      action: 'ADD_STOCK',
      parameters: {
        quantity: parseInt(addMatch[1]),
        item: addMatch[2].trim(),
        partNumber: addMatch[2].trim(),
        location: addMatch[3].trim(),
      },
      confidence: 0.85,
    };
  }

  // Pattern: "Use/take/remove [qty] [item] from [location]"
  const removeMatch = lower.match(
    /^(?:use|used|take|took|remove|removed)\s+(\d+)\s+(.+?)\s+from\s+(.+)$/i
  );
  if (removeMatch) {
    return {
      action: 'REMOVE_STOCK',
      parameters: {
        quantity: parseInt(removeMatch[1]),
        item: removeMatch[2].trim(),
        partNumber: removeMatch[2].trim(),
        location: removeMatch[3].trim(),
        reason: 'usage',
      },
      confidence: 0.85,
    };
  }

  // Pattern: "Move/transfer [qty] [item] from [loc1] to [loc2]"
  const transferMatch = lower.match(
    /^(?:move|transfer)\s+(\d+)\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+)$/i
  );
  if (transferMatch) {
    return {
      action: 'TRANSFER_STOCK',
      parameters: {
        quantity: parseInt(transferMatch[1]),
        item: transferMatch[2].trim(),
        partNumber: transferMatch[2].trim(),
        fromLocation: transferMatch[3].trim(),
        toLocation: transferMatch[4].trim(),
      },
      confidence: 0.85,
    };
  }

  // Pattern: "I've got [qty] [item] at/on/in [location]"
  const countMatch = lower.match(
    /^(?:i(?:'ve|\s+have)\s+got|there(?:'s|\s+are))\s+(\d+)\s+(.+?)\s+(?:at|on|in)\s+(.+)$/i
  );
  if (countMatch) {
    return {
      action: 'COUNT_STOCK',
      parameters: {
        quantity: parseInt(countMatch[1]),
        countedQuantity: parseInt(countMatch[1]),
        item: countMatch[2].trim(),
        partNumber: countMatch[2].trim(),
        location: countMatch[3].trim(),
      },
      confidence: 0.85,
    };
  }

  // Pattern: "What [item] do we have/in stock"
  const searchStockMatch = lower.match(
    /^(?:what|show|list)\s+(.+?)\s+(?:do we have|in stock|available)/i
  );
  if (searchStockMatch) {
    return {
      action: 'SEARCH_STOCK',
      parameters: {
        search: searchStockMatch[1].trim(),
      },
      confidence: 0.8,
    };
  }

  // Pattern: "Search/find for [short-code]" - recognize short codes (e.g., "search for lmv")
  // This pattern is specifically for short alphanumeric codes (2-5 chars) that might be part numbers
  const shortCodeMatch = lower.match(/^(?:search|find|look)\s+(?:for\s+)?([a-z0-9]{2,5})$/);
  if (shortCodeMatch) {
    return {
      action: 'SEARCH_CATALOGUE',
      parameters: {
        search: shortCodeMatch[1].trim(),
      },
      confidence: 0.8,
    };
  }

  // Pattern: "Search/find [item]"
  const searchMatch = lower.match(/^(?:search|find|look for)\s+(?:for\s+)?(.+)$/i);
  if (searchMatch) {
    const searchTerm = searchMatch[1].trim();
    // If it includes "stock" or "inventory", search stock; otherwise search catalogue
    if (searchTerm.includes('stock') || searchTerm.includes('inventory')) {
      return {
        action: 'SEARCH_STOCK',
        parameters: {
          search: searchTerm.replace(/\s*(in\s+)?stock.*$/i, '').trim(),
        },
        confidence: 0.75,
      };
    }
    return {
      action: 'SEARCH_CATALOGUE',
      parameters: {
        search: searchTerm,
      },
      confidence: 0.75,
    };
  }

  // Pattern: "New customer [name]"
  const newCustomerMatch = lower.match(/^(?:new|add|create)\s+customer\s+(.+)$/i);
  if (newCustomerMatch) {
    return {
      action: 'ADD_CUSTOMER',
      parameters: {
        name: newCustomerMatch[1].trim(),
      },
      confidence: 0.85,
    };
  }

  // Pattern: "New job for [customer]"
  const newJobMatch = lower.match(
    /^(?:new|create)\s+job\s+for\s+(.+?)(?:\s+-\s+(.+))?$/i
  );
  if (newJobMatch) {
    const params: Record<string, unknown> = {
      customerName: newJobMatch[1].trim(),
    };
    if (newJobMatch[2]) {
      params.description = newJobMatch[2].trim();
    }
    return {
      action: 'CREATE_JOB',
      parameters: params,
      confidence: 0.85,
    };
  }

  // Pattern: "Add new item [name] cost [price] markup [%]"
  const addProductMatch = lower.match(
    /^(?:add\s+new\s+item|create\s+product|new\s+part)\s+(.+?)\s+cost\s+(\d+(?:\.\d+)?)(?:\s+markup\s+(\d+(?:\.\d+)?)%?)?/i
  );
  if (addProductMatch) {
    const name = addProductMatch[1].trim();
    const params: Record<string, unknown> = {
      name,
      partNumber: name.split(/\s+/)[0] || name,
      unitCost: parseFloat(addProductMatch[2]),
    };
    if (addProductMatch[3]) {
      params.markup = parseFloat(addProductMatch[3]);
    }
    return {
      action: 'ADD_PRODUCT',
      parameters: params,
      confidence: 0.8,
    };
  }

  // Pattern: "New supplier [name]"
  const newSupplierMatch = lower.match(/^(?:new|add|create)\s+supplier\s+(.+)$/i);
  if (newSupplierMatch) {
    return {
      action: 'ADD_SUPPLIER',
      parameters: {
        name: newSupplierMatch[1].trim(),
      },
      confidence: 0.85,
    };
  }

  // Pattern: "Low stock report"
  if (lower.match(/^(?:show\s+)?low\s+stock(?:\s+report)?/i)) {
    return {
      action: 'LOW_STOCK_REPORT',
      parameters: {},
      confidence: 0.9,
    };
  }

  return null;
}
