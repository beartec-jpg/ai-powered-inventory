/**
 * Conversation Context Manager
 * Keeps track of recent commands and their results for contextual understanding
 */

export interface ConversationMessage {
  id: string;
  timestamp: number;
  userInput: string;
  action?: string;
  parameters?: Record<string, unknown>;
  success?: boolean;
}

export interface ConversationContext {
  messages: ConversationMessage[];
  lastAction?: string;
  lastParameters?: Record<string, unknown>;
  lastItem?: string;
  lastLocation?: string;
  lastQuantity?: number;
  multiStepState?: {
    flowId: string;
    currentStep: number;
    totalSteps: number;
    collectedData: Record<string, unknown>;
    pendingAction: string;
  };
}

const CONTEXT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_MESSAGES = 10;

class ConversationManager {
  private context: ConversationContext = {
    messages: [],
  };

  /**
   * Add a message to the conversation context
   */
  addMessage(message: ConversationMessage): void {
    // Remove expired messages (older than 30 minutes)
    const cutoffTime = Date.now() - CONTEXT_TIMEOUT_MS;
    this.context.messages = this.context.messages.filter(
      (m) => m.timestamp > cutoffTime
    );

    // Add new message
    this.context.messages.push(message);

    // Keep only last 10 messages
    if (this.context.messages.length > MAX_MESSAGES) {
      this.context.messages = this.context.messages.slice(-MAX_MESSAGES);
    }

    // Update context shortcuts from the last successful action
    if (message.success && message.action && message.parameters) {
      this.context.lastAction = message.action;
      this.context.lastParameters = message.parameters;

      // Extract common values
      if (message.parameters.item) {
        this.context.lastItem = message.parameters.item as string;
      }
      if (message.parameters.location) {
        this.context.lastLocation = message.parameters.location as string;
      }
      if (message.parameters.quantity) {
        this.context.lastQuantity = message.parameters.quantity as number;
      }
    }
  }

  /**
   * Get the current conversation context
   */
  getContext(): ConversationContext {
    // Clean up expired messages
    const cutoffTime = Date.now() - CONTEXT_TIMEOUT_MS;
    this.context.messages = this.context.messages.filter(
      (m) => m.timestamp > cutoffTime
    );

    return { ...this.context };
  }

  /**
   * Resolve contextual references in user input
   * e.g., "add 5 more" -> use last item and location
   * e.g., "same thing to van" -> use last item
   */
  resolveContextualReferences(
    input: string,
    parameters: Record<string, unknown>
  ): Record<string, unknown> {
    const lower = input.toLowerCase();
    const resolved = { ...parameters };

    // Handle "more" - use last item and location if not specified
    if (lower.includes('more') && !parameters.item && this.context.lastItem) {
      resolved.item = this.context.lastItem;
    }

    // Handle "same" - use last item
    if (
      (lower.includes('same') || lower.includes('same thing')) &&
      !parameters.item &&
      this.context.lastItem
    ) {
      resolved.item = this.context.lastItem;
    }

    // Use last location if not specified and command is likely location-based
    // Only infer location for ADD_STOCK, REMOVE_STOCK, TRANSFER_STOCK actions
    if (!parameters.location && this.context.lastLocation) {
      // Check if this is a stock-related command that needs a location
      const needsLocation = 
        lower.match(/\b(add|put|receive|use|take|remove|got|have|count)\b/);
      
      if (needsLocation) {
        resolved.location = this.context.lastLocation;
      }
    }

    return resolved;
  }

  /**
   * Get a summary of recent context for AI prompts
   */
  getContextSummary(): string {
    const recent = this.context.messages.slice(-3);
    if (recent.length === 0) {
      return 'No recent context.';
    }

    const lines = recent.map((m) => {
      const action = m.action || 'unknown';
      const params = m.parameters
        ? JSON.stringify(m.parameters)
        : 'no params';
      return `- "${m.userInput}" → ${action} ${params}`;
    });

    let summary = 'Recent commands:\n' + lines.join('\n');

    if (this.context.lastItem) {
      summary += `\n\nLast item: ${this.context.lastItem}`;
    }
    if (this.context.lastLocation) {
      summary += `\nLast location: ${this.context.lastLocation}`;
    }

    return summary;
  }

  /**
   * Clear the conversation context
   */
  clear(): void {
    this.context = {
      messages: [],
    };
  }

  /**
   * Store multi-step flow state
   */
  setMultiStepState(state: {
    flowId: string;
    currentStep: number;
    totalSteps: number;
    collectedData: Record<string, unknown>;
    pendingAction: string;
  }): void {
    this.context.multiStepState = state;
  }

  /**
   * Get current multi-step flow state
   */
  getMultiStepState() {
    return this.context.multiStepState;
  }

  /**
   * Update multi-step flow collected data
   */
  updateMultiStepData(data: Record<string, unknown>): void {
    if (this.context.multiStepState) {
      this.context.multiStepState.collectedData = {
        ...this.context.multiStepState.collectedData,
        ...data,
      };
    }
  }

  /**
   * Clear multi-step flow state
   */
  clearMultiStepState(): void {
    this.context.multiStepState = undefined;
  }
}

// Export a singleton instance
export const conversationManager = new ConversationManager();
