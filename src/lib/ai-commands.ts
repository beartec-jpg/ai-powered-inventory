import OpenAI from 'openai';

// Initialize xAI Grok client
const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

interface CommandResult {
  action: string;
  params: Record<string, unknown>;
  confidence: number;
}

/**
 * Extract JSON from markdown code blocks in the response
 */
function extractJsonFromMarkdown(text: string): Record<string, unknown> | null {
  // Try to find JSON in markdown code blocks
  const jsonBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
  const match = text.match(jsonBlockRegex);
  
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch (e) {
      // If markdown extraction fails, try parsing the whole text
    }
  }
  
  // Try to parse the entire text as JSON
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

/**
 * Interpret natural language commands using xAI Grok
 */
export async function interpretCommand(userCommand: string): Promise<CommandResult> {
  try {
    const systemPrompt = `You are an AI assistant that interprets natural language commands for an inventory management system.
    
Your task is to analyze the user's command and extract:
1. The action to perform (e.g., "add_item", "remove_item", "update_quantity", "search_item", "list_items")
2. The parameters needed for that action
3. Your confidence level (0-1) in the interpretation

Respond with ONLY a JSON object in a markdown code block with this structure:
\`\`\`json
{
  "action": "action_name",
  "params": {
    "param1": "value1",
    "param2": "value2"
  },
  "confidence": 0.95
}
\`\`\`

Be concise and always return valid JSON.`;

    const response = await xai.messages.create({
      model: 'grok-beta',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: userCommand,
        },
      ],
      system: systemPrompt,
    });

    // Extract the text content from the response
    const contentBlock = response.content[0];
    if (contentBlock.type !== 'text') {
      throw new Error('Unexpected response type from xAI Grok');
    }

    const responseText = contentBlock.text;

    // Extract JSON from the response
    const parsedJson = extractJsonFromMarkdown(responseText);
    
    if (!parsedJson) {
      throw new Error('Failed to extract JSON from xAI Grok response');
    }

    // Validate the response structure
    if (!parsedJson.action || typeof parsedJson.action !== 'string') {
      throw new Error('Invalid action in xAI Grok response');
    }

    if (!parsedJson.params || typeof parsedJson.params !== 'object') {
      throw new Error('Invalid params in xAI Grok response');
    }

    if (typeof parsedJson.confidence !== 'number' || parsedJson.confidence < 0 || parsedJson.confidence > 1) {
      throw new Error('Invalid confidence in xAI Grok response');
    }

    return {
      action: parsedJson.action as string,
      params: parsedJson.params as Record<string, unknown>,
      confidence: parsedJson.confidence as number,
    };
  } catch (error) {
    throw new Error(`Failed to interpret command with xAI Grok: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate that a command has sufficient confidence
 */
export function isCommandValid(result: CommandResult, minConfidence: number = 0.7): boolean {
  return result.confidence >= minConfidence;
}

/**
 * Get user-friendly error message for command interpretation failures
 */
export function getCommandErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred while processing your command';
}