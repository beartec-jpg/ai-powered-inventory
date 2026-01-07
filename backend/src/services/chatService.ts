import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { chatConversations, chatMessages, toolCalls } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { getXAIService } from './xaiService';
import { getChatMemory } from './chatMemory';
import { getToolExecutor } from './toolExecutor';
import { inventoryTools } from '../utils/xaiTools';
import {
  ChatRequest,
  ChatResponse,
  GrokMessage,
  MessageRole,
  UserContext,
  ToolCallStatus,
} from '../types/chat';

export interface CreateConversationInput {
  userId: string;
  title?: string;
}

export interface CreateMessageInput {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: string; // JSON string
}

export interface CreateToolCallInput {
  messageId: string;
  toolName: string;
  arguments: string; // JSON string
  result?: string; // JSON string
  status: 'pending' | 'success' | 'error';
}

export class ChatService {
  private xaiService = getXAIService();
  private chatMemory = getChatMemory();
  private toolExecutor = getToolExecutor();

  /**
   * Process a chat message and return response with xAI integration
   */
  async processMessage(request: ChatRequest, userContext: UserContext): Promise<ChatResponse> {
    try {
      // Get or create conversation
      const conversationId = await this.chatMemory.getOrCreateConversation(
        userContext.userId,
        request.conversationId
      );

      // Save user message
      await this.chatMemory.addMessage(conversationId, MessageRole.USER, request.message);

      // Build conversation history
      const history = await this.chatMemory.getConversationHistory(conversationId);

      // Build system context
      const systemContext = this.chatMemory.buildSystemContext(userContext);

      // Prepare messages for AI
      const messages: GrokMessage[] = [
        { role: 'system', content: systemContext },
        ...history,
        { role: 'user', content: request.message },
      ];

      // Call xAI with tools
      const response = await this.xaiService.createChatCompletion(
        messages,
        inventoryTools
      );

      const assistantMessage = response.choices[0].message;

      // Check if AI wants to call tools
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Execute tool calls
        const toolResults = await this.executeToolCalls(
          assistantMessage.tool_calls,
          userContext
        );

        // Save assistant message with tool calls
        const assistantMessageId = await this.chatMemory.addMessage(
          conversationId,
          MessageRole.ASSISTANT,
          assistantMessage.content || 'Executing tools...',
          {
            tool_calls: assistantMessage.tool_calls,
            model: response.model,
          }
        );

        // Record tool call executions
        for (const toolCall of assistantMessage.tool_calls) {
          const result = toolResults.find((r) => r.id === toolCall.id);
          await this.chatMemory.recordToolCall(
            assistantMessageId,
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            result?.result,
            result?.success ? 'success' : 'error'
          );
        }

        // Build tool response messages
        const toolMessages: GrokMessage[] = toolResults.map((result) => ({
          role: 'tool',
          tool_call_id: result.id,
          name: result.name,
          content: JSON.stringify(result.result),
        }));

        // Get final response from AI with tool results
        const finalMessages: GrokMessage[] = [
          { role: 'system', content: systemContext },
          ...history,
          { role: 'user', content: request.message },
          assistantMessage,
          ...toolMessages,
        ];

        const finalResponse = await this.xaiService.createChatCompletion(finalMessages);
        const finalMessage = finalResponse.choices[0].message;

        // Save final assistant response
        const finalMessageId = await this.chatMemory.addMessage(
          conversationId,
          MessageRole.ASSISTANT,
          finalMessage.content,
          {
            model: finalResponse.model,
            usage: finalResponse.usage,
          }
        );

        return {
          conversationId,
          message: {
            id: finalMessageId,
            conversationId,
            role: MessageRole.ASSISTANT,
            content: finalMessage.content,
            createdAt: new Date(),
          },
          toolCalls: toolResults.map((tr) => ({
            id: tr.id,
            messageId: assistantMessageId,
            toolName: tr.name,
            parameters: tr.parameters,
            result: tr.result,
            status: tr.success ? ToolCallStatus.SUCCESS : ToolCallStatus.FAILED,
            error: tr.error,
            createdAt: new Date(),
          })),
        };
      } else {
        // No tool calls, just save and return the response
        const messageId = await this.chatMemory.addMessage(
          conversationId,
          MessageRole.ASSISTANT,
          assistantMessage.content,
          {
            model: response.model,
            usage: response.usage,
          }
        );

        return {
          conversationId,
          message: {
            id: messageId,
            conversationId,
            role: MessageRole.ASSISTANT,
            content: assistantMessage.content,
            createdAt: new Date(),
          },
        };
      }
    } catch (error: any) {
      console.error('Chat service error:', error);
      throw new Error(`Failed to process message: ${error.message}`);
    }
  }

  /**
   * Execute multiple tool calls
   */
  private async executeToolCalls(
    toolCalls: any[],
    userContext: UserContext
  ): Promise<
    Array<{
      id: string;
      name: string;
      parameters: any;
      result: any;
      success: boolean;
      error?: string;
    }>
  > {
    const results = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const parameters = JSON.parse(toolCall.function.arguments);

      // Validate parameters
      const validation = this.toolExecutor.validateParameters(toolName, parameters);
      if (!validation.valid) {
        results.push({
          id: toolCall.id,
          name: toolName,
          parameters,
          result: { error: validation.errors.join(', ') },
          success: false,
          error: validation.errors.join(', '),
        });
        continue;
      }

      // Execute tool
      const result = await this.toolExecutor.executeTool(toolName, parameters, userContext);

      results.push({
        id: toolCall.id,
        name: toolName,
        parameters,
        result: result.data || { message: result.message },
        success: result.success,
        error: result.error,
      });
    }

    return results;
  }

  /**
   * Get conversation history (legacy method for compatibility)
   */
  async getHistory(userId: string, limit?: number, offset?: number) {
    return await this.chatMemory.getUserConversations(userId, limit, offset);
  }

  /**
   * Get specific conversation (legacy method for compatibility)
   */
  async getConversation(conversationId: string, userId: string) {
    return await this.chatMemory.getConversation(conversationId, userId);
  }

  /**
   * Delete conversation (legacy method for compatibility)
   */
  async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    return await this.chatMemory.deleteConversation(conversationId, userId);
  }

  // ========== Legacy methods from Drizzle-based implementation ==========

  /**
   * Create a new conversation
   */
  async createConversation(input: CreateConversationInput) {
    const [conversation] = await db.insert(chatConversations).values({
      id: uuidv4(),
      userId: input.userId,
      title: input.title || 'New Conversation',
      active: true,
    }).returning();

    return conversation;
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(id: string) {
    const [conversation] = await db.select()
      .from(chatConversations)
      .where(eq(chatConversations.id, id))
      .limit(1);

    return conversation;
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(userId: string, limit = 50) {
    const conversations = await db.select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.updatedAt))
      .limit(limit);

    return conversations;
  }

  /**
   * Add message to conversation
   */
  async addMessage(input: CreateMessageInput) {
    const [message] = await db.insert(chatMessages).values({
      id: uuidv4(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      toolCalls: input.toolCalls || null,
    }).returning();

    // Update conversation's updatedAt
    await db.update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversations.id, input.conversationId));

    return message;
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(conversationId: string, limit = 100) {
    const messages = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt)
      .limit(limit);

    return messages;
  }

  /**
   * Record tool call
   */
  async recordToolCall(input: CreateToolCallInput) {
    const [toolCall] = await db.insert(toolCalls).values({
      id: uuidv4(),
      messageId: input.messageId,
      toolName: input.toolName,
      arguments: input.arguments,
      result: input.result || null,
      status: input.status,
    }).returning();

    return toolCall;
  }

  /**
   * Update tool call result
   */
  async updateToolCall(id: string, result: string, status: 'success' | 'error') {
    const [updated] = await db.update(toolCalls)
      .set({
        result,
        status,
      })
      .where(eq(toolCalls.id, id))
      .returning();

    return updated;
  }

  /**
   * Get message tool calls
   */
  async getMessageToolCalls(messageId: string) {
    const calls = await db.select()
      .from(toolCalls)
      .where(eq(toolCalls.messageId, messageId))
      .orderBy(toolCalls.createdAt);

    return calls;
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(id: string, title: string) {
    const [updated] = await db.update(chatConversations)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.id, id))
      .returning();

    return updated;
  }

  /**
   * Delete conversation (legacy method)
   */
  async deleteConversationById(id: string) {
    // Messages and tool calls will be cascade deleted
    const [deleted] = await db.update(chatConversations)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.id, id))
      .returning();

    return deleted;
  }
}

// Singleton instance
let chatServiceInstance: ChatService | null = null;

export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}

export const chatService = new ChatService();

