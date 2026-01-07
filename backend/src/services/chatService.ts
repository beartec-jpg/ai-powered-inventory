// Chat Service - Main chat processing logic
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

export class ChatService {
  private xaiService = getXAIService();
  private chatMemory = getChatMemory();
  private toolExecutor = getToolExecutor();

  /**
   * Process a chat message and return response
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
            result?.success ? ToolCallStatus.SUCCESS : ToolCallStatus.FAILED,
            result?.error
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
   * Process streaming message
   */
  async *processStreamingMessage(
    request: ChatRequest,
    userContext: UserContext
  ): AsyncGenerator<string, void, unknown> {
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

      // Get streaming response
      const stream = await this.xaiService.createStreamingChatCompletion(
        messages,
        inventoryTools
      );

      let fullContent = '';
      let toolCalls: any[] = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          fullContent += delta.content;
          yield `data: ${JSON.stringify({ type: 'content', data: delta.content })}\n\n`;
        }

        if (delta?.tool_calls) {
          toolCalls = delta.tool_calls;
        }

        if (chunk.choices[0]?.finish_reason === 'stop') {
          break;
        }
      }

      // Save assistant message
      await this.chatMemory.addMessage(
        conversationId,
        MessageRole.ASSISTANT,
        fullContent || 'Processing...'
      );

      // If tool calls exist, execute them
      if (toolCalls.length > 0) {
        yield `data: ${JSON.stringify({ type: 'tool_calls', data: toolCalls })}\n\n`;
        // NOTE: Streaming tool execution is simplified for initial release
        // Full tool execution in streaming mode will be implemented in a future update
        // For now, clients should use non-streaming mode for tool-based operations
      }

      yield `data: ${JSON.stringify({ type: 'done', data: { conversationId } })}\n\n`;
    } catch (error: any) {
      yield `data: ${JSON.stringify({ type: 'error', data: { message: error.message } })}\n\n`;
    }
  }

  /**
   * Get conversation history
   */
  async getHistory(userId: string, limit?: number, offset?: number) {
    return await this.chatMemory.getUserConversations(userId, limit, offset);
  }

  /**
   * Get specific conversation
   */
  async getConversation(conversationId: string, userId: string) {
    return await this.chatMemory.getConversation(conversationId, userId);
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    return await this.chatMemory.deleteConversation(conversationId, userId);
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
