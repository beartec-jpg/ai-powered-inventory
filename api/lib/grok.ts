/**
 * Grok API Client Wrapper (fetch-based)
 * Replaces use of the 'openai' SDK so we don't pull its zod@^3 peer.
 *
 * This is intentionally minimal and robust:
 * - Uses fetch to call xAI (Grok) endpoints
 * - Supports timeouts via AbortController
 * - Exposes callGrok (text completion) and callGrokJSON (extract JSON from response)
 */

export interface GrokCompletionOptions {
  model?: 'grok-3-mini' | 'grok-3'
  temperature?: number
  maxTokens?: number
  timeout?: number
}

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const DEFAULT_BASE_URL = process.env.XAI_BASE_URL ?? 'https://api.x.ai/v1'
const DEFAULT_TIMEOUT = 15000

function buildCompletionPayload(messages: GrokMessage[], options: GrokCompletionOptions) {
  const { model = 'grok-3-mini', temperature = 0.2, maxTokens = 500 } = options
  return {
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature,
    max_tokens: maxTokens,
  }
}

async function postJSON(path: string, body: unknown, timeout = DEFAULT_TIMEOUT, baseURL = DEFAULT_BASE_URL) {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    throw new Error('XAI_API_KEY is not configured')
  }

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(`${baseURL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    })

    clearTimeout(id)

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Grok API error ${res.status}: ${text}`)
    }

    return res.json()
  } catch (err) {
    clearTimeout(id)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Grok request timeout after ${timeout}ms`)
    }
    throw err
  }
}

export async function callGrok(messages: GrokMessage[], options: GrokCompletionOptions = {}): Promise<string> {
  const { timeout = DEFAULT_TIMEOUT } = options
  const payload = buildCompletionPayload(messages, options)
  const body = await postJSON('/chat/completions', payload, timeout)
  const content = body?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('No content in Grok response')
  }
  return content
}

export async function callGrokJSON<T = unknown>(messages: GrokMessage[], options: GrokCompletionOptions = {}): Promise<T> {
  const content = await callGrok(messages, options)
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in Grok response')
  }
  try {
    return JSON.parse(jsonMatch[0]) as T
  } catch (err) {
    throw new Error(`Failed to parse JSON from Grok response: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

export function isGrokConfigured(): boolean {
  return !!process.env.XAI_API_KEY
}
