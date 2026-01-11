/**
 * Stage 1: Intent Classification
 * Calls the /api/ai/classify-intent endpoint
 */

import type { ClassificationResult } from '../actions/types';

export async function classifyIntent(
  command: string,
  contextSummary?: string
): Promise<ClassificationResult> {
  try {
    const response = await fetch('/api/ai/classify-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command,
        context: contextSummary,
      }),
    });

    if (!response.ok) {
      throw new Error(`Classification failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Classification failed');
    }

    return result.data;
  } catch (error) {
    console.error('Intent classification error:', error);
    // Return low confidence fallback
    return {
      action: 'QUERY_INVENTORY',
      confidence: 0.1,
      reasoning: 'Classification service unavailable',
    };
  }
}
