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
import type { CatalogueItem } from '@/lib/types';

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

  // Load catalogue from localStorage on mount
  useEffect(() => {
    const loaded = loadCatalogue();
    if (loaded.length > 0) {
      setCatalogue(loaded);
    }
  }, []);

  // Save catalogue to localStorage
  const saveCatalogue = useCallback((items: CatalogueItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save catalogue to localStorage:', error);
    }
  }, []);

  // Load catalogue from localStorage
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
  stockLevels: any[];
  setStockLevels: React.Dispatch<React.SetStateAction<any[]>>;
  saveStockLevels: (levels: any[]) => void;
  loadStockLevels: () => any[];
  clearStockLevels: () => void;
}

export function useLocalStock(): LocalStockHook {
  const [stockLevels, setStockLevels] = useState<any[]>([]);

  // Load stock levels from localStorage on mount
  useEffect(() => {
    const loaded = loadStockLevels();
    if (loaded.length > 0) {
      setStockLevels(loaded);
    }
  }, []);

  // Save stock levels to localStorage
  const saveStockLevels = useCallback((levels: any[]) => {
    try {
      localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(levels));
    } catch (error) {
      console.error('Failed to save stock levels to localStorage:', error);
    }
  }, []);

  // Load stock levels from localStorage
  const loadStockLevels = useCallback((): any[] => {
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
