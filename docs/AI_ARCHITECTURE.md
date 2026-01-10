# AI Architecture

This document describes the AI-powered natural language command processing system in the inventory management application.

## Overview

The system uses **xAI Grok** to parse natural language commands from users and translate them into structured actions that can be executed against the inventory system.

---

## Current Flow

```
User Command → AI Parse → Execute → Result
```

### Detailed Steps

1. **User Input**: User enters a natural language command (e.g., "Add 50 bolts to warehouse A")

2. **AI Parsing** (`api/ai/parse-command.ts`):
   - Sends command to xAI Grok API
   - Grok analyzes the command and extracts:
     - `action`: The type of operation (e.g., `RECEIVE_STOCK`, `QUERY`, etc.)
     - `parameters`: Key-value pairs with extracted data
     - `confidence`: AI's confidence level (0-1)

3. **Local Fallback** (`src/lib/command-executor.ts` - `tryLocalParse()`):
   - If AI returns `QUERY_INVENTORY` (default fallback), attempts regex-based pattern matching
   - Supports common patterns like:
     - "Add new item [name] cost [price] markup [%]"
     - "Received [qty] [item] into [location]"
     - "Add item [details] to [location]"
     - "Add [item] bought from [supplier]"

4. **Execution** (`src/lib/command-executor.ts` - `executeCommand()`):
   - Routes to appropriate handler based on action type
   - Validates parameters
   - Updates state/database
   - Returns success/error result

5. **Result Display**: Shows confirmation message or error to user

---

## Planned Flow (Multi-Phase)

```
User Command → AI Parse → Action Plan → Part Matching → Clarification (if needed) → Execute → Result
```

### Enhanced Steps

1. **AI Parse**: Same as current, but returns action plan for complex operations

2. **Action Plan**: Structured list of steps with validation checkpoints
   ```json
   {
     "action": "MULTI_STEP_PLAN",
     "steps": [
       {
         "action": "RECEIVE_STOCK",
         "parameters": {...},
         "validation": "Check part exists in catalogue"
       },
       {
         "action": "PUT_AWAY_STOCK",
         "parameters": {...},
         "validation": "Verify location exists"
       }
     ]
   }
   ```

3. **Part Matching**: Fuzzy matching algorithm to handle typos and variations
   - Levenshtein distance for string similarity
   - Phonetic matching (Soundex/Metaphone)
   - Synonym/alias support

4. **Clarification**: Interactive dialog when ambiguity detected
   - Present options to user
   - Maintain context for follow-up
   - Learn from user selections

5. **Execute**: Process each step with rollback on failure

---

## Action Types Reference

### Catalogue Management
| Action | Description | Required Parameters | Optional Parameters |
|--------|-------------|---------------------|---------------------|
| `CREATE_CATALOGUE_ITEM` | Add new part to catalogue | `partNumber`, `name` | `unitCost`, `markup`, `sellPrice`, `category`, `manufacturer` |
| `UPDATE_CATALOGUE_ITEM` | Update existing catalogue item | `partNumber` | `name`, `unitCost`, `markup`, `sellPrice`, `minQuantity` |
| `SEARCH_CATALOGUE` | Search catalogue by name/part# | `search` | `category`, `manufacturer` |

### Stock Management
| Action | Description | Required Parameters | Optional Parameters |
|--------|-------------|---------------------|---------------------|
| `RECEIVE_STOCK` | Add stock to inventory | `partNumber`, `quantity`, `location` | `supplier`, `supplierName` |
| `USE_STOCK` | Remove stock from inventory | `partNumber`, `quantity`, `location` | `reason`, `jobNumber` |
| `TRANSFER_STOCK` | Move stock between locations | `partNumber`, `quantity`, `fromLocation`, `toLocation` | `notes` |
| `STOCK_COUNT` | Physical count verification | `partNumber`, `location`, `countedQuantity` | - |
| `SEARCH_STOCK` | Find items in stock | `search` | `location` |
| `LOW_STOCK_REPORT` | Get items below minimum | - | `location` |
| `SET_MIN_STOCK` | Set reorder threshold | `partNumber`, `minQuantity` | `reorderQuantity` |

### Customer & Equipment
| Action | Description | Required Parameters | Optional Parameters |
|--------|-------------|---------------------|---------------------|
| `CREATE_CUSTOMER` | Add new customer | `name` | `type`, `contactName`, `email`, `phone` |
| `CREATE_EQUIPMENT` | Add equipment for customer | `customerName`, `equipmentName`, `type` | `manufacturer`, `model`, `serialNumber` |
| `LIST_EQUIPMENT` | List customer equipment | `customerName` | - |

### Jobs
| Action | Description | Required Parameters | Optional Parameters |
|--------|-------------|---------------------|---------------------|
| `CREATE_JOB` | Create new job/work order | `customerName` | `type`, `equipmentName`, `description`, `priority` |
| `SCHEDULE_JOB` | Schedule job date/engineer | `jobNumber`, `scheduledDate` | `assignedEngineerName` |
| `START_JOB` | Mark job as in progress | `jobNumber` | - |
| `COMPLETE_JOB` | Mark job complete | `jobNumber`, `workCarriedOut` | `findings`, `recommendations` |
| `ADD_PART_TO_JOB` | Record part used on job | `jobNumber`, `partNumber`, `quantity` | `source` |
| `LIST_JOBS` | List jobs with filters | - | `customerName`, `status`, `assignedEngineerName` |

### Parts Installation
| Action | Description | Required Parameters | Optional Parameters |
|--------|-------------|---------------------|---------------------|
| `INSTALL_FROM_STOCK` | Install part from stock | `partNumber`, `quantity`, `customerName`, `equipmentName`, `location` | `jobNumber` |
| `INSTALL_DIRECT_ORDER` | Install part ordered direct | `partNumber`, `name`, `quantity`, `customerName`, `equipmentName`, `supplierName` | `unitCost`, `sellPrice` |
| `QUERY_EQUIPMENT_PARTS` | List parts on equipment | `customerName`, `equipmentName` | - |

### Suppliers & Orders
| Action | Description | Required Parameters | Optional Parameters |
|--------|-------------|---------------------|---------------------|
| `CREATE_SUPPLIER` | Add new supplier | `name` | `contactName`, `email`, `phone`, `accountNumber` |
| `CREATE_PURCHASE_ORDER` | Create PO | `supplierName`, `items[]` | `jobNumber` |
| `RECEIVE_PURCHASE_ORDER` | Mark PO received | `poNumber` | - |

### Query/Search
| Action | Description | Required Parameters | Optional Parameters |
|--------|-------------|---------------------|---------------------|
| `QUERY` | General search/query | `query` | - |
| `QUERY_INVENTORY` | Default fallback query | - | Any AI-extracted params |
| `LIST_ITEMS` | List inventory items | - | `location`, `lowStock` |

---

## How to Add New Actions

1. **Define the Action Type**: Add to the action types reference above

2. **Create Handler Function**: In `src/lib/command-executor.ts`, create a new function:
   ```typescript
   function myNewAction(params: Record<string, unknown>, state: StateSetters): ExecutionResult {
     // Validate required parameters
     const requiredParam = String(params.requiredParam || '').trim()
     if (!requiredParam) {
       return { success: false, message: 'Required parameter missing' }
     }
     
     // Execute logic
     // ...
     
     // Update state
     state.setSomeState((current) => [...current, newItem])
     
     return {
       success: true,
       message: 'Action completed successfully',
       data: newItem
     }
   }
   ```

3. **Add Route in `executeCommand()`**: 
   ```typescript
   if (actionLower === 'my_new_action') return myNewAction(parameters, state)
   ```

4. **Update AI Prompt**: If needed, update the xAI Grok system prompt in `api/ai/parse-command.ts` to recognize the new action

5. **Add Local Pattern** (optional): For common patterns, add regex matching in `tryLocalParse()`:
   ```typescript
   const myPatternMatch = lower.match(/^my\s+pattern\s+(.+)$/i)
   if (myPatternMatch) {
     return {
       action: 'MY_NEW_ACTION',
       parameters: { extracted: myPatternMatch[1] }
     }
   }
   ```

---

## Part Matching Algorithm (Planned)

### Current Approach
- Exact match only (case-insensitive)
- Uses `Array.find()` with string comparison
- No fuzzy matching or synonym support

### Planned Enhancements

1. **Fuzzy String Matching**:
   ```typescript
   // Using Levenshtein distance for fuzzy matching
   // Consider using libraries like: fuzzysort, fuse.js, or string-similarity
   import { distance as levenshteinDistance } from 'fastest-levenshtein'
   
   function fuzzyMatch(input: string, target: string, threshold: number = 0.8): boolean {
     const dist = levenshteinDistance(input.toLowerCase(), target.toLowerCase())
     const maxLength = Math.max(input.length, target.length)
     const similarity = 1 - (dist / maxLength)
     return similarity >= threshold
   }
   ```

2. **Phonetic Matching**: Handle sound-alike part numbers
   - "LMV37100" matches "LMV37.100"
   - "burner controler" matches "burner controller"

3. **Partial Match**: Match on part of the part number
   - "123" matches "ABC-123-XYZ"

4. **Alias/Synonym Support**: Store alternative names
   ```typescript
   {
     partNumber: "LMV37.100",
     name: "Siemens Burner Controller",
     aliases: ["LMV37100", "LMV 37.100", "burner ECU"]
   }
   ```

5. **Smart Suggestions**: When no exact match, show best candidates
   ```typescript
   return {
     success: false,
     message: `Part "${input}" not found. Did you mean: ${suggestions.join(', ')}?`,
     data: { suggestions }
   }
   ```

---

## Clarification Flow State Diagram

```
┌─────────────────┐
│  User Command   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   AI Parse      │
└────────┬────────┘
         │
         ▼
   ┌──────────┐
   │ Ambiguous│  No
   │ Intent?  ├───────────┐
   └────┬─────┘           │
        │Yes              │
        ▼                 │
┌─────────────────┐       │
│ Generate        │       │
│ Clarification   │       │
│ Questions       │       │
└────────┬────────┘       │
         │                │
         ▼                │
┌─────────────────┐       │
│ Show Dialog     │       │
│ to User         │       │
└────────┬────────┘       │
         │                │
         ▼                │
┌─────────────────┐       │
│ User Responds   │       │
└────────┬────────┘       │
         │                │
         ▼                │
┌─────────────────┐       │
│ Merge Response  │       │
│ with Original   │       │
└────────┬────────┘       │
         │                │
         └────────────────┤
                          │
                          ▼
                  ┌─────────────────┐
                  │  Execute Action │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Return Result  │
                  └─────────────────┘
```

### Example Clarification Scenarios

1. **Multiple Matches**:
   - Command: "Move bolts to warehouse"
   - Issue: Multiple bolt types in inventory
   - Clarification: "Which bolts? (1) M8 Bolts (50 in Bin A), (2) M10 Bolts (30 in Bin B), (3) M12 Bolts (20 in Bin C)"

2. **Missing Information**:
   - Command: "Receive new part"
   - Issue: No part details provided
   - Clarification: "Please provide part number and quantity"

3. **Location Ambiguity**:
   - Command: "Add part XYZ to bin 2"
   - Issue: Multiple "bin 2" locations exist
   - Clarification: "Which location? (1) Warehouse A - Bin 2, (2) Warehouse B - Bin 2, (3) Workshop - Bin 2"

---

## xAI Grok Integration

### Configuration
```env
XAI_API_KEY=your-api-key
XAI_MODEL=grok-beta
XAI_ENDPOINT=https://api.x.ai/v1
```

### API Endpoint
`POST /api/ai/parse-command`

**Request**:
```json
{
  "command": "Add 50 bolts to warehouse A",
  "context": {
    "recentActions": [],
    "availableLocations": ["warehouse A", "warehouse B"],
    "userId": "user-123"
  }
}
```

**Response**:
```json
{
  "action": "RECEIVE_STOCK",
  "parameters": {
    "partNumber": "bolts",
    "quantity": 50,
    "location": "warehouse A"
  },
  "confidence": 0.95,
  "reasoning": "User wants to add stock to inventory"
}
```

### Error Handling
- Network failures → Fall back to local parser
- Low confidence (< 0.5) → Trigger clarification
- Invalid response → Return `QUERY_INVENTORY` with original text

---

## Performance Considerations

1. **AI Call Latency**: ~500-2000ms per request
   - Cache common commands
   - Use local parser for simple patterns
   - Show loading indicator to user

2. **Token Usage**: Monitor API costs
   - Keep system prompts concise
   - Limit conversation context
   - Use caching where possible

3. **Fallback Strategy**:
   ```
   Primary: xAI Grok API
   ↓ (on failure)
   Secondary: Local regex patterns
   ↓ (on failure)
   Tertiary: Show command help to user
   ```

---

## Security & Privacy

1. **Data Sent to AI**:
   - User commands (sanitized)
   - Minimal context (location names, not full inventory)
   - NO sensitive data (prices, supplier details, customer PII)

2. **API Key Management**:
   - Store in environment variables
   - Never commit to source control
   - Rotate regularly

3. **Rate Limiting**:
   - Implement user-level rate limits
   - Prevent API abuse
   - Queue commands during high load

---

## Testing AI Integration

### Unit Tests
```typescript
describe('tryLocalParse', () => {
  it('should parse "Add item to location" pattern', () => {
    const result = tryLocalParse(
      'Add new item Siemens km3 123455 to rack 1 bin 2',
      {}
    )
    expect(result?.action).toBe('RECEIVE_STOCK')
    expect(result?.parameters.location).toBe('rack 1 bin 2')
  })
})
```

### Integration Tests
1. Mock xAI API responses
2. Test fallback to local parser
3. Verify all action types execute correctly
4. Test error handling and edge cases

### Manual Testing Checklist
- [ ] Common stock operations (add, remove, transfer)
- [ ] Query and search commands
- [ ] Edge cases (typos, ambiguous commands)
- [ ] Error messages are clear and helpful
- [ ] Performance is acceptable (< 3s response time)
