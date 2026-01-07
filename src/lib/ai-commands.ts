// Frontend AI Commands - Utility functions only
// All AI processing is done on the backend

// Generate a unique ID (browser-compatible version)
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Simple fuzzy string matching helper
function fuzzyMatch(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Calculate Levenshtein distance between two strings
function getEditDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// Find the best matching item from a list based on similarity
export function findBestMatch(
  input: string,
  items: string[],
  threshold: number = 0.6
): string | null {
  if (items.length === 0) return null;

  let bestMatch: { item: string; similarity: number } | null = null;

  for (const item of items) {
    const similarity = fuzzyMatch(input, item);
    if (similarity >= threshold) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { item, similarity };
      }
    }
  }

  return bestMatch ? bestMatch.item : null;
}

// Parse natural language command using backend AI service
export async function interpretCommand(
  command: string,
  context?: Record<string, unknown>
): Promise<{
  action: string;
  parameters: Record<string, unknown>;
  confidence: number;
  interpretation: string;
  clarificationNeeded?: string;
}> {
  try {
    const response = await fetch('/api/ai/parse-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command, context }),
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to parse command');
    }

    return result.data;
  } catch (error) {
    console.error('Error interpreting command:', error);
    return {
      action: 'unknown',
      parameters: {},
      confidence: 0,
      interpretation: 'Failed to interpret command',
      clarificationNeeded: 'Unable to connect to AI service',
    };
  }
}

export { fuzzyMatch };

// Import InventoryItem type from types module
import type { InventoryItem } from './types';

// Find the best matching inventory item based on part number or name
export function findBestMatchItem(
  input: string,
  items: InventoryItem[],
  threshold: number = 0.6
): InventoryItem | null {
  if (items.length === 0) return null;

  let bestMatch: { item: InventoryItem; similarity: number } | null = null;

  for (const item of items) {
    // Check similarity against both part number and name
    const partSimilarity = fuzzyMatch(input, item.partNumber);
    const nameSimilarity = fuzzyMatch(input, item.name);
    const similarity = Math.max(partSimilarity, nameSimilarity);

    if (similarity >= threshold) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { item, similarity };
      }
    }
  }

  return bestMatch ? bestMatch.item : null;
}
