import type { CommandAction, InventoryItem, Location, Customer, Job, JobPart, CommandLog } from './types'

export const SYSTEM_CAPABILITIES = `You are an AI assistant for a stock management system. Your job is to understand user commands and execute the appropriate function.

AVAILABLE FUNCTIONS:
1. add_item - Add inventory to a location
   Example: "add 50 units of bearing-202 to warehouse A"
   Parameters: partNumber, name, quantity, location

2. remove_item - Remove inventory
   Example: "remove 10 motors from shelf B2"
   Parameters: partNumber, quantity, location (optional)

3. move_item - Move inventory between locations
   Example: "move all switches from shelf B2 to B3"
   Parameters: partNumber, fromLocation, toLocation, quantity (optional, defaults to all)

4. update_quantity - Adjust inventory quantity
   Example: "set quantity of part XYZ to 100"
   Parameters: partNumber, quantity

5. create_location - Create new storage location
   Example: "create location warehouse-A/aisle-5/shelf-C"
   Parameters: path, description (optional)

6. stock_check - Check stock levels
   Example: "stock check on part ABC-123" or "what's in warehouse B"
   Parameters: partNumber or location

7. create_job - Create parts list for a job
   Example: "create parts list for job 4521 with 10x bolt-m8, 5x washer for customer Acme Corp"
   Parameters: jobNumber, customerName, parts (array of {partNumber, name, quantity})

8. create_customer - Add new customer
   Example: "add customer ABC Industries"
   Parameters: name, email (optional)

9. query - General queries
   Example: "show all items under 10 units" or "where is part XYZ-123"
   Parameters: query string

10. list_items - List inventory with optional filters
    Example: "list all items" or "show inventory in warehouse A"
    Parameters: location (optional), lowStock (boolean, optional)

INSTRUCTIONS:
- Analyze the user's command
- Determine which function to call
- Extract all relevant parameters
- Handle typos and variations gracefully
- If information is missing or ambiguous, ask for clarification
- Be conversational but precise

Return your response as JSON with this structure:
{
  "action": "function_name",
  "parameters": { ... },
  "confidence": 0.0-1.0,
  "clarificationNeeded": "question if confidence < 0.7",
  "interpretation": "natural language explanation of what you understood"
}`

interface CommandInterpretation {
  action: CommandAction
  parameters: Record<string, unknown>
  confidence: number
  clarificationNeeded?: string
  interpretation: string
}

export async function interpretCommand(command: string): Promise<CommandInterpretation> {
  try {
    const prompt = spark.llmPrompt`${SYSTEM_CAPABILITIES}

USER COMMAND: "${command}"

Analyze this command and return a JSON response with the action, parameters, confidence level, and interpretation.`

    const response = await spark.llm(prompt, 'gpt-4o-mini', true)
    const parsed = JSON.parse(response) as CommandInterpretation
    
    return parsed
  } catch (error) {
    console.error('Error interpreting command:', error)
    return {
      action: 'unknown',
      parameters: {},
      confidence: 0,
      interpretation: 'Failed to interpret command',
      clarificationNeeded: 'Could you rephrase that?'
    }
  }
}

export function fuzzyMatch(search: string, target: string): number {
  const searchLower = search.toLowerCase()
  const targetLower = target.toLowerCase()
  
  if (searchLower === targetLower) return 1.0
  if (targetLower.includes(searchLower)) return 0.8
  
  const distance = levenshteinDistance(searchLower, targetLower)
  const maxLen = Math.max(searchLower.length, targetLower.length)
  return 1 - (distance / maxLen)
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

export function findBestMatch(search: string, items: InventoryItem[]): InventoryItem | null {
  if (items.length === 0) return null
  
  let bestMatch = items[0]
  let bestScore = Math.max(
    fuzzyMatch(search, items[0].partNumber),
    fuzzyMatch(search, items[0].name)
  )

  for (let i = 1; i < items.length; i++) {
    const score = Math.max(
      fuzzyMatch(search, items[i].partNumber),
      fuzzyMatch(search, items[i].name)
    )
    if (score > bestScore) {
      bestScore = score
      bestMatch = items[i]
    }
  }

  return bestScore > 0.6 ? bestMatch : null
}

export function formatCommandLog(log: CommandLog): string {
  const time = new Date(log.timestamp).toLocaleTimeString()
  const status = log.success ? '✓' : '✗'
  return `${status} ${time} - ${log.command}`
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
