/**
 * Grok API Client Wrapper
 * Provides a simple interface for calling xAI's Grok models
 * 
 * NOTE: This implementation uses fetch instead of the openai SDK to avoid
 * peer dependency conflicts with zod versions.
 */

export interface GrokCompletionOptions {
  model?: 'grok-3-mini' | 'grok-3';
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call Grok for a text completion using fetch API
 */
export async function callGrok(
  messages: GrokMessage[],
  options: GrokCompletionOptions = {}
): Promise<string> {
  const {
    model = 'grok-3-mini',
    temperature = 0.2,
    maxTokens = 500,
    timeout = 15000,
  } = options;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set');
  }

  const baseURL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
  const url = `${baseURL}/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok API error (${response.status}): ${errorText}`);
    }

    const completion: GrokChatCompletionResponse = await response.json();

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in Grok response');
    }

    return content;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Grok request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Call Grok with JSON response expected
 */
export async function callGrokJSON<T = unknown>(
  messages: GrokMessage[],
  options: GrokCompletionOptions = {}
): Promise<T> {
  const content = await callGrok(messages, options);

  // Try to extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Grok response');
  }

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from Grok response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if Grok API is configured
 */
export function isGrokConfigured(): boolean {
  return !!process.env.XAI_API_KEY;
}
