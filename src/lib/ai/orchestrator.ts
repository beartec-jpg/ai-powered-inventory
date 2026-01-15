/**
 * AI Orchestrator
 * Coordinates the two-stage AI processing flow
 */

import { classifyIntent } from './classify';
import { extractParameters } from './extract';
import { tryFallbackParse } from './fallback-parser';
import { conversationManager } from './conversation';
import { normalizeParameters } from '../multi-step-flows';
import type { ParsedCommand } from '../actions/types';
import { normalizeActionName } from '../actions/registry';

const LOW_CONFIDENCE_THRESHOLD = 0.6;
const LOW_INTENT_THRESHOLD = 0.65;
const PARAM_OVERRIDE_THRESHOLD = 0.8;

/**
 * Extract search term from various parameter name variations
 * Centralized to ensure consistency across the codebase
 */
function extractSearchTerm(params: Record<string, unknown>): string | null {
  const term = params.search || params.query || params.searchTerm || params.q;
  return term ? String(term) : null;
}

export async function parseCommand(command: string): Promise<ParsedCommand> {
  try {
    // Step 1: Add command to conversation context
    const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const contextSummary = conversationManager.getContextSummary();

    // Step 2: Classify intent
    console.log('[Orchestrator] Stage 1: Classifying intent...');
    const classification = await classifyIntent(command, contextSummary);
    console.log(
      `[Orchestrator] Classification: ${classification.action} (confidence: ${classification.confidence})`
    );

    // Step 3: If confidence is too low, try local fallback
    if (classification.confidence < LOW_CONFIDENCE_THRESHOLD) {
      console.log('[Orchestrator] Low confidence, trying fallback parser...');
      const fallbackResult = tryFallbackParse(command);

      if (fallbackResult && fallbackResult.confidence > classification.confidence) {
        console.log(
          `[Orchestrator] Fallback parser matched: ${fallbackResult.action}`
        );

        // Use fallback result
        const result: ParsedCommand = {
          action: fallbackResult.action,
          parameters: fallbackResult.parameters,
          confidence: fallbackResult.confidence,
          reasoning: 'Local regex fallback',
        };

        // Add to context
        conversationManager.addMessage({
          id: messageId,
          timestamp: Date.now(),
          userInput: command,
          action: fallbackResult.action,
          parameters: fallbackResult.parameters,
          success: true,
        });

        return result;
      }
    }

    // Normalize action name (handle aliases)
    const normalizedAction = normalizeActionName(classification.action);

    // Step 4: Extract parameters for the classified action
    console.log('[Orchestrator] Stage 2: Extracting parameters...');
    const extraction = await extractParameters(
      command,
      normalizedAction,
      contextSummary
    );
    console.log(
      `[Orchestrator] Extracted params:`,
      extraction.parameters,
      `(confidence: ${extraction.confidence})`
    );

    // Step 5: Resolve contextual references and normalize parameters
    const contextResolvedParams = conversationManager.resolveContextualReferences(
      command,
      extraction.parameters
    );
    
    // Normalize parameter names to canonical schema
    const resolvedParams = normalizeParameters(contextResolvedParams);

    // Step 6: Check for parameter-driven override
    // If intent confidence is low but we have high-confidence search parameters,
    // override to search action instead of QUERY_INVENTORY
    let finalAction = normalizedAction;
    let overrideReasoning = '';
    let usedOverride = false;
    
    const searchTerm = extractSearchTerm(resolvedParams);
    
    if (
      classification.confidence < LOW_INTENT_THRESHOLD &&
      extraction.confidence >= PARAM_OVERRIDE_THRESHOLD &&
      searchTerm
    ) {
      console.log(
        `[Orchestrator] Override: Low intent confidence (${classification.confidence}) but high param confidence (${extraction.confidence}) with search="${searchTerm}"`
      );
      
      // Check for stock-related keywords in the command or queryType
      const hasStockKeywords = command.toLowerCase().includes('stock') || 
                                command.toLowerCase().includes('inventory') ||
                                command.toLowerCase().includes('in stock') ||
                                command.toLowerCase().includes('available');
      
      // Prefer SEARCH_CATALOGUE or SEARCH_STOCK based on parameters.queryType or stock keywords
      if (resolvedParams.queryType === 'stock' || hasStockKeywords) {
        finalAction = 'SEARCH_STOCK';
        overrideReasoning = `Overridden to SEARCH_STOCK due to high-confidence search parameter (${extraction.confidence}) and stock context`;
      } else {
        finalAction = 'SEARCH_CATALOGUE';
        overrideReasoning = `Overridden to SEARCH_CATALOGUE due to high-confidence search parameter (${extraction.confidence})`;
      }
      
      usedOverride = true;
    }

    // Step 7: Calculate overall confidence
    const overallConfidence = Math.min(
      classification.confidence,
      extraction.confidence
    );

    // Step 8: Build result with debug information
    const result: ParsedCommand = {
      action: finalAction,
      parameters: resolvedParams,
      confidence: overallConfidence,
      reasoning:
        overrideReasoning ||
        classification.reasoning ||
        `Classified as ${finalAction} with ${Object.keys(resolvedParams).length} parameters`,
      missingRequired: extraction.missingRequired,
      debug: {
        stage1: {
          action: normalizedAction,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
        },
        stage2: {
          parameters: resolvedParams,
          confidence: extraction.confidence,
          missingRequired: extraction.missingRequired || [],
        },
        usedOverride,
        overrideReason: overrideReasoning || undefined,
      },
    };

    // Add clarification if needed
    if (
      extraction.missingRequired &&
      extraction.missingRequired.length > 0
    ) {
      result.clarificationNeeded = `Missing required information: ${extraction.missingRequired.join(', ')}. Please provide these details.`;
    }

    // Step 9: Add to conversation context and persist multi-step state if applicable
    conversationManager.addMessage({
      id: messageId,
      timestamp: Date.now(),
      userInput: command,
      action: finalAction,
      parameters: resolvedParams,
      success: true,
    });

    // If this is part of a multi-step flow, persist the partial state
    if (resolvedParams.currentStep !== undefined && resolvedParams.totalSteps !== undefined) {
      conversationManager.setMultiStepState({
        flowId: String(resolvedParams.flowId || finalAction),
        currentStep: Number(resolvedParams.currentStep),
        totalSteps: Number(resolvedParams.totalSteps),
        collectedData: (resolvedParams.collectedData as Record<string, unknown>) || {},
        pendingAction: finalAction,
      });
    } else if (result.clarificationNeeded) {
      // If clarification is needed and we're not in a flow, we might be starting one
      // Store the initial parameters
      conversationManager.updateMultiStepData(resolvedParams);
    }

    return result;
  } catch (error) {
    console.error('[Orchestrator] Error parsing command:', error);

    // Last resort: try fallback parser
    const fallbackResult = tryFallbackParse(command);
    if (fallbackResult) {
      return {
        action: fallbackResult.action,
        parameters: fallbackResult.parameters,
        confidence: fallbackResult.confidence,
        reasoning: 'Fallback parser after error',
      };
    }

    // Complete failure
    return {
      action: 'QUERY_INVENTORY',
      parameters: { search: command },
      confidence: 0.1,
      reasoning: 'Failed to parse command - all methods exhausted',
      clarificationNeeded: 'Sorry, I could not understand that command. Please try rephrasing or provide more details.',
    };
  }
}

/**
 * Clear conversation context
 */
export function clearContext(): void {
  conversationManager.clear();
}
