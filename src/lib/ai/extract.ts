/**
 * Stage 2: Parameter Extraction
 * Calls the /api/ai/extract-params endpoint
 */

import type { ActionType, ExtractionResult } from '../actions/types';

export async function extractParameters(
  command: string,
  action: ActionType,
  contextSummary?: string
): Promise<ExtractionResult> {
  try {
    const response = await fetch('/api/ai/extract-params', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command,
        action,
        context: contextSummary,
      }),
    });

    if (!response.ok) {
      throw new Error(`Parameter extraction failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Parameter extraction failed');
    }

    return result.data;
  } catch (error) {
    console.error('Parameter extraction error:', error);
    // Return empty result
    return {
      parameters: {},
      missingRequired: [],
      confidence: 0.1,
    };
  }
}
