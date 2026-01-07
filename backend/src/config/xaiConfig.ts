// xAI Grok API Configuration

import dotenv from 'dotenv';

dotenv.config();

export interface XAIConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
}

export const xaiConfig: XAIConfig = {
  apiKey: process.env.XAI_API_KEY || '',
  model: process.env.XAI_MODEL || 'grok-beta',
  baseUrl: process.env.XAI_API_BASE_URL || 'https://api.x.ai/v1',
  maxTokens: parseInt(process.env.XAI_MAX_TOKENS || '4096', 10),
  temperature: parseFloat(process.env.XAI_TEMPERATURE || '0.7'),
};

export const chatConfig = {
  messageRetentionDays: parseInt(process.env.CHAT_MESSAGE_RETENTION_DAYS || '90', 10),
  maxContextLength: parseInt(process.env.MAX_CHAT_CONTEXT_LENGTH || '20', 10),
  rateLimitPerHour: parseInt(process.env.CHAT_RATE_LIMIT_PER_HOUR || '100', 10),
};

export function validateXAIConfig(): boolean {
  if (!xaiConfig.apiKey) {
    console.error('XAI_API_KEY is not configured');
    return false;
  }
  return true;
}
