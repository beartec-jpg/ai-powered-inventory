import { OpenAI } from "openai";
import * as crypto from "crypto";

// Initialize OpenAI client configured for xAI (Grok)
const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

// Generate a unique ID
function generateId(): string {
  return crypto.randomBytes(12).toString("hex");
}

// Find the best matching item from a list based on similarity
function findBestMatch(
  input: string,
  items: string[],
  threshold: number = 0.6
): string | null {
  if (items.length === 0) return null;

  // Simple string similarity calculation using Levenshtein distance
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1;

    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  // Calculate Levenshtein distance between two strings
  const getEditDistance = (s1: string, s2: string): number => {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  };

  let bestMatch: { item: string; similarity: number } | null = null;

  for (const item of items) {
    const similarity = calculateSimilarity(input, item);
    if (similarity >= threshold) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { item, similarity };
      }
    }
  }

  return bestMatch ? bestMatch.item : null;
}

// Generate an inventory item description using xAI (Grok)
export async function generateItemDescription(
  itemName: string,
  category?: string
): Promise<string> {
  try {
    const prompt = `Generate a brief, professional inventory item description for: ${itemName}${
      category ? ` in the ${category} category` : ""
    }. Keep it under 100 words.`;

    const message = await openai.messages.create({
      model: "grok-2-latest",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");
    if (textContent && textContent.type === "text") {
      return textContent.text;
    }

    return `Default description for ${itemName}`;
  } catch (error) {
    console.error("Error generating item description:", error);
    return `Default description for ${itemName}`;
  }
}

// Generate inventory management suggestions using xAI (Grok)
export async function generateInventorySuggestions(
  inventoryData: Record<string, unknown>
): Promise<string> {
  try {
    const prompt = `Based on this inventory data: ${JSON.stringify(inventoryData)}, 
    provide 3-5 brief, actionable suggestions for inventory management optimization. 
    Format as a numbered list.`;

    const message = await openai.messages.create({
      model: "grok-2-latest",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");
    if (textContent && textContent.type === "text") {
      return textContent.text;
    }

    return "Unable to generate suggestions at this time.";
  } catch (error) {
    console.error("Error generating inventory suggestions:", error);
    return "Unable to generate suggestions at this time.";
  }
}

// Generate a category suggestion for an item using xAI (Grok)
export async function generateCategorySuggestion(
  itemName: string,
  existingCategories: string[]
): Promise<string> {
  try {
    const categoriesList = existingCategories.join(", ");
    const prompt = `Given an item named "${itemName}" and these existing categories: ${categoriesList}, 
    suggest the most appropriate category. If none fit well, suggest a new one. 
    Reply with just the category name, nothing else.`;

    const message = await openai.messages.create({
      model: "grok-2-latest",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");
    if (textContent && textContent.type === "text") {
      return textContent.text.trim();
    }

    // Fallback: use the best matching category or create a new one
    const bestCategory = findBestMatch(itemName, existingCategories);
    return bestCategory || "Miscellaneous";
  } catch (error) {
    console.error("Error generating category suggestion:", error);
    // Fallback: use the best matching category or create a new one
    const bestCategory = findBestMatch(itemName, existingCategories);
    return bestCategory || "Miscellaneous";
  }
}

// Analyze item for potential issues using xAI (Grok)
export async function analyzeItemForIssues(
  itemData: Record<string, unknown>
): Promise<string[]> {
  try {
    const prompt = `Analyze this inventory item and identify any potential issues or concerns: 
    ${JSON.stringify(itemData)}. 
    List each issue on a new line, prefixed with a hyphen. Be concise.`;

    const message = await openai.messages.create({
      model: "grok-2-latest",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");
    if (textContent && textContent.type === "text") {
      return textContent.text
        .split("\n")
        .filter((line) => line.trim().startsWith("-"))
        .map((line) => line.trim().substring(1).trim());
    }

    return [];
  } catch (error) {
    console.error("Error analyzing item for issues:", error);
    return [];
  }
}

// Parse natural language command and extract action and parameters
export async function parseNaturalLanguageCommand(
  command: string,
  context?: Record<string, unknown>
): Promise<{ action: string; parameters: Record<string, unknown> }> {
  try {
    const contextStr = context
      ? `\nContext: ${JSON.stringify(context)}`
      : "";
    const prompt = `Parse this inventory command and extract the action and parameters: "${command}"${contextStr}
    
    Respond in JSON format like this: {"action": "action_name", "parameters": {"key": "value"}}
    Possible actions: ADD_ITEM, UPDATE_ITEM, DELETE_ITEM, SEARCH_ITEM, LIST_ITEMS, GET_STATISTICS
    
    Be smart about understanding intent.`;

    const message = await openai.messages.create({
      model: "grok-2-latest",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");
    if (textContent && textContent.type === "text") {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return { action: "UNKNOWN", parameters: {} };
  } catch (error) {
    console.error("Error parsing natural language command:", error);
    return { action: "UNKNOWN", parameters: {} };
  }
}

// Generate a human-readable summary of inventory status
export async function generateInventorySummary(
  inventoryData: Record<string, unknown>
): Promise<string> {
  try {
    const prompt = `Generate a brief, executive-style summary of this inventory status: 
    ${JSON.stringify(inventoryData)}. 
    Keep it to 2-3 sentences and highlight key metrics or concerns.`;

    const message = await openai.messages.create({
      model: "grok-2-latest",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === "text");
    if (textContent && textContent.type === "text") {
      return textContent.text;
    }

    return "Unable to generate summary at this time.";
  } catch (error) {
    console.error("Error generating inventory summary:", error);
    return "Unable to generate summary at this time.";
  }
}

// Export utility functions
export { generateId, findBestMatch };
