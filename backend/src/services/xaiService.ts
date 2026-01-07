// xAI Grok API Service
import OpenAI from 'openai';
import { xaiConfig, validateXAIConfig } from '../config/xaiConfig';
import {
  GrokChatCompletionRequest,
  GrokChatCompletionResponse,
  GrokMessage,
  GrokTool,
} from '../types/chat';

export class XAIService {
  private client: OpenAI;
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = validateXAIConfig();
    
    if (this.isConfigured) {
      this.client = new OpenAI({
        apiKey: xaiConfig.apiKey,
        baseURL: xaiConfig.baseUrl,
      });
    } else {
      // Create a placeholder client if not configured
      this.client = {} as OpenAI;
    }
  }

  /**
   * Check if the xAI service is properly configured
   */
  public isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Send a chat completion request to Grok API
   */
  async createChatCompletion(
    messages: GrokMessage[],
    tools?: GrokTool[],
    temperature?: number,
    maxTokens?: number
  ): Promise<GrokChatCompletionResponse> {
    if (!this.isConfigured) {
      throw new Error('xAI service is not configured. Please set XAI_API_KEY.');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: xaiConfig.model,
        messages: messages as any,
        tools: tools as any,
        temperature: temperature ?? xaiConfig.temperature,
        max_tokens: maxTokens ?? xaiConfig.maxTokens,
      });

      return response as any as GrokChatCompletionResponse;
    } catch (error: any) {
      console.error('xAI API Error:', error.message);
      throw new Error(`Failed to communicate with xAI API: ${error.message}`);
    }
  }

  /**
   * Create a streaming chat completion
   */
  async createStreamingChatCompletion(
    messages: GrokMessage[],
    tools?: GrokTool[],
    temperature?: number,
    maxTokens?: number
  ): Promise<AsyncIterable<any>> {
    if (!this.isConfigured) {
      throw new Error('xAI service is not configured. Please set XAI_API_KEY.');
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: xaiConfig.model,
        messages: messages as any,
        tools: tools as any,
        temperature: temperature ?? xaiConfig.temperature,
        max_tokens: maxTokens ?? xaiConfig.maxTokens,
        stream: true,
      });

      return stream;
    } catch (error: any) {
      console.error('xAI Streaming API Error:', error.message);
      throw new Error(`Failed to create streaming chat: ${error.message}`);
    }
  }

  /**
   * Format error messages for user-friendly display
   */
  formatError(error: any): string {
    if (error.response) {
      return `API Error: ${error.response.status} - ${error.response.data?.error?.message || 'Unknown error'}`;
    } else if (error.message) {
      return `Error: ${error.message}`;
    } else {
      return 'An unexpected error occurred while communicating with the AI service.';
    }
  }

  /**
   * Validate message format before sending
   */
  validateMessages(messages: GrokMessage[]): boolean {
    if (!Array.isArray(messages) || messages.length === 0) {
      return false;
    }

    for (const message of messages) {
      if (!message.role || !['system', 'user', 'assistant', 'tool'].includes(message.role)) {
        return false;
      }
      if (typeof message.content !== 'string') {
        return false;
      }
    }

    return true;
  }

  /**
   * Count tokens in messages (approximate)
   */
  estimateTokens(messages: GrokMessage[]): number {
    // Rough estimation: ~4 characters per token
    let totalChars = 0;
    for (const message of messages) {
      totalChars += message.content.length;
      if (message.tool_calls) {
        totalChars += JSON.stringify(message.tool_calls).length;
      }
    }
    return Math.ceil(totalChars / 4);
  }
}

// Singleton instance
let xaiServiceInstance: XAIService | null = null;

export function getXAIService(): XAIService {
  if (!xaiServiceInstance) {
    xaiServiceInstance = new XAIService();
  }
  return xaiServiceInstance;
}
