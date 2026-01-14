function handleQuery(
  params: Record<string, unknown>,
  inventory: InventoryItem[],
  locations: Location[],
  customers: Customer[],
  jobs: Job[]
): ExecutionResult {
  // Prefer explicit `search` parameter, then fall back to `query`, `searchTerm`, or raw command
  const rawSearch =
    (params && (params.search || params.query || params.searchTerm || params.q)) || '';
  const query = String(rawSearch).trim().toLowerCase();

  if (!query) {
    // Existing behavior for empty query: return overall product list or ask for clarification
    return {
      success: true,
      message: 'Searching for: (no query provided) — please specify what to search for',
      data: { inventory: [], locations, customers, jobs },
    };
  }

  // Quick heuristics:
  // - If the query mentions 'low' or 'under', treat as low stock query (existing behavior)
  if (query.includes('low') || query.includes('under')) {
    const threshold = 10;
    const lowStock = inventory.filter((item) => item.quantity < threshold);
    return {
      success: true,
      message: `Found ${lowStock.length} items with low stock (under ${threshold} units)`,
      data: lowStock,
    };
  }

  // Try exact / contains matching across sensible fields
  const results = inventory.filter((item) => {
    const name = (item.name || '').toString().toLowerCase();
    const part = (item.partNumber || item.sku || '').toString().toLowerCase();
    const mfr = (item.manufacturer || '').toString().toLowerCase();

    // direct contains matches (good for short codes like 'lmv')
    if (name.includes(query) || part.includes(query) || mfr.includes(query)) return true;

    // Additional: if query is short (<=4 chars), also try startsWith or token match
    if (query.length <= 4) {
      const tokens = name.split(/\s+/);
      if (tokens.some((t) => t.startsWith(query))) return true;
      // also check part tokens
      const partTokens = part.split(/\s+/);
      if (partTokens.some((t) => t.startsWith(query))) return true;
    }

    return false;
  });

  // Build a friendly message and return matched items
  const displayQuery = String(rawSearch).trim();
  return {
    success: true,
    message: `Searching for: ${displayQuery}`,
    data: {
      inventory: results,
      query: displayQuery,
    },
  };
}