/**
 * Local Storage Persistence Hook for Catalogue Items
 * 
 * This hook provides client-side persistence using localStorage
 * as a fallback when DATABASE_URL is not configured on the server.
 * 
 * Usage:
 * const { catalogue, setCatalogue, saveCatalogue, loadCatalogue } = useLocalCatalogue();
 */

import { useState, useEffect, useCallback } from 'react';
import type { CatalogueItem, StockLevel } from '@/lib/types';

const STORAGE_KEY = 'ai-inventory-catalogue';
const STOCK_STORAGE_KEY = 'ai-inventory-stock-levels';

export interface LocalCatalogueHook {
  catalogue: CatalogueItem[];
  setCatalogue: React.Dispatch<React.SetStateAction<CatalogueItem[]>>;
  saveCatalogue: (items: CatalogueItem[]) => void;
  loadCatalogue: () => CatalogueItem[];
  clearCatalogue: () => void;
}

export function useLocalCatalogue(): LocalCatalogueHook {
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);

  // Load catalogue from localStorage (defined before use in useEffect)
  const loadCatalogue = useCallback((): CatalogueItem[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load catalogue from localStorage:', error);
    }
    return [];
  }, []);

  // Load catalogue from localStorage on mount
  useEffect(() => {
    const loaded = loadCatalogue();
    if (loaded.length > 0) {
      setCatalogue(loaded);
    }
  }, [loadCatalogue]);

  // Save catalogue to localStorage
  const saveCatalogue = useCallback((items: CatalogueItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save catalogue to localStorage:', error);
    }
  }, []);

  // Clear catalogue from localStorage
  const clearCatalogue = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setCatalogue([]);
    } catch (error) {
      console.error('Failed to clear catalogue from localStorage:', error);
    }
  }, []);

  // Auto-save when catalogue changes
  useEffect(() => {
    if (catalogue.length > 0) {
      saveCatalogue(catalogue);
    }
  }, [catalogue, saveCatalogue]);

  return {
    catalogue,
    setCatalogue,
    saveCatalogue,
    loadCatalogue,
    clearCatalogue,
  };
}

export interface LocalStockHook {
  stockLevels: StockLevel[];
  setStockLevels: React.Dispatch<React.SetStateAction<StockLevel[]>>;
  saveStockLevels: (levels: StockLevel[]) => void;
  loadStockLevels: () => StockLevel[];
  clearStockLevels: () => void;
}

export function useLocalStock(): LocalStockHook {
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);

  // Load stock levels from localStorage (defined before use in useEffect)
  const loadStockLevels = useCallback((): StockLevel[] => {
    try {
      const stored = localStorage.getItem(STOCK_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load stock levels from localStorage:', error);
    }
    return [];
  }, []);

  // Load stock levels from localStorage on mount
  useEffect(() => {
    const loaded = loadStockLevels();
    if (loaded.length > 0) {
      setStockLevels(loaded);
    }
  }, [loadStockLevels]);

  // Save stock levels to localStorage
  const saveStockLevels = useCallback((levels: StockLevel[]) => {
    try {
      localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(levels));
    } catch (error) {
      console.error('Failed to save stock levels to localStorage:', error);
    }
  }, []);

  // Clear stock levels from localStorage
  const clearStockLevels = useCallback(() => {
    try {
      localStorage.removeItem(STOCK_STORAGE_KEY);
      setStockLevels([]);
    } catch (error) {
      console.error('Failed to clear stock levels from localStorage:', error);
    }
  }, []);

  // Auto-save when stock levels change
  useEffect(() => {
    if (stockLevels.length > 0) {
      saveStockLevels(stockLevels);
    }
  }, [stockLevels, saveStockLevels]);

  return {
    stockLevels,
    setStockLevels,
    saveStockLevels,
    loadStockLevels,
    clearStockLevels,
  };
}
