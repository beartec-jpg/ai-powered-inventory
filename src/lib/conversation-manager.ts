import type { PendingCommand, ConversationContext } from './types'
import { generateId } from './ai-commands'

const CONTEXT_RETENTION_MS = 30000 // 30 seconds

/**
 * Conversation Manager
 * Handles multi-turn conversations for collecting missing information
 */
export class ConversationManager {
  private context: ConversationContext = {
    pendingCommand: null,
    lastCommand: null,
    lastResponse: null,
    updatedAt: Date.now()
  }

  /**
   * Create a pending command when information is missing
   */
  createPendingCommand(
    action: string,
    parameters: Record<string, unknown>,
    missingFields: string[],
    prompt: string,
    pendingAction?: string,
    context?: Record<string, unknown>,
    options?: string[]
  ): PendingCommand {
    const now = Date.now()
    const pendingCommand: PendingCommand = {
      id: generateId(),
      action,
      parameters,
      missingFields,
      prompt,
      createdAt: now,
      expiresAt: now + CONTEXT_RETENTION_MS,
      pendingAction,
      context,
      options
    }

    this.context.pendingCommand = pendingCommand
    this.context.updatedAt = now

    return pendingCommand
  }

  /**
   * Get the current pending command if not expired
   */
  getPendingCommand(): PendingCommand | null {
    if (!this.context.pendingCommand) {
      return null
    }

    const now = Date.now()
    if (now > this.context.pendingCommand.expiresAt) {
      // Expired, clear it
      this.context.pendingCommand = null
      return null
    }

    return this.context.pendingCommand
  }

  /**
   * Complete a pending command by merging with new parameters
   */
  completePendingCommand(newParameters: Record<string, unknown>): {
    action: string
    parameters: Record<string, unknown>
  } | null {
    const pending = this.getPendingCommand()
    if (!pending) {
      return null
    }

    // Merge new parameters with existing ones
    const mergedParameters = {
      ...pending.parameters,
      ...newParameters
    }

    // Clear the pending command
    this.context.pendingCommand = null
    this.context.updatedAt = Date.now()

    return {
      action: pending.action,
      parameters: mergedParameters
    }
  }

  /**
   * Clear the current pending command
   */
  clearPendingCommand(): void {
    this.context.pendingCommand = null
    this.context.updatedAt = Date.now()
  }

  /**
   * Update conversation context with last command and response
   */
  updateContext(command: string, response: string): void {
    this.context.lastCommand = command
    this.context.lastResponse = response
    this.context.updatedAt = Date.now()
  }

  /**
   * Get the conversation context for AI processing
   */
  getContext(): string | undefined {
    if (!this.context.lastCommand) {
      return undefined
    }

    const age = Date.now() - this.context.updatedAt
    if (age > CONTEXT_RETENTION_MS) {
      return undefined
    }

    return `Previous command: "${this.context.lastCommand}"\nResponse: "${this.context.lastResponse}"`
  }

  /**
   * Check if we have an active conversation
   */
  hasActiveConversation(): boolean {
    const pending = this.getPendingCommand()
    return pending !== null
  }
}

// Export a singleton instance
export const conversationManager = new ConversationManager()
