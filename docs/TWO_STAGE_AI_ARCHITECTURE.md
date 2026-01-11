# Two-Stage AI Command Processing Architecture

## Overview

This document describes the new two-stage AI command processing architecture that improves reliability and accuracy of natural language command parsing.

## Problem Statement

The previous AI command parsing had several issues:
1. **Unreliable parsing**: When users entered "Add 5 M10 nuts to rack 1 bin6", the system would return `QUERY_INVENTORY` instead of correctly identifying `ADD_STOCK`
2. **Too much at once**: The AI tried to classify intent AND extract parameters from 30+ function definitions in one call
3. **Fallback issues**: The `QUERY_INVENTORY` was used as a catch-all when uncertain
4. **Missing patterns**: Local regex fallback missed obvious patterns like "Add [qty] [item] to [location]"

## Solution: Two-Stage Processing

The new architecture splits AI processing into focused stages:

### Stage 1: Intent Classification (`/api/ai/classify-intent`)
- **Simple task**: Just identify WHAT the user wants to do
- **Returns**: One of ~25 fixed action types (ADD_STOCK, REMOVE_STOCK, CREATE_JOB, etc.)
- **Fast**: Uses grok-3-mini with focused prompt
- **Reliable**: Clear examples and guidelines

### Stage 2: Parameter Extraction (`/api/ai/extract-params`)
- **Focused task**: Extract ONLY the parameters relevant to the identified action
- **Action-specific**: Uses tailored prompts with relevant examples
- **Context-aware**: Supports conversation context for commands like "add 5 more"

### Stage 3: Local Fallback (Safety Net)
- **Regex patterns**: Backup when AI fails
- **Works offline**: No API dependency
- **Common patterns**: Covers frequent command structures

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Input                               │
│              "Add 5 M10 nuts to rack 1 bin6"               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Conversation Manager                           │
│  - Tracks last 10 messages                                  │
│  - 30-minute context timeout                                │
│  - Resolves "add 5 more", "same thing to van"             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│         Stage 1: Intent Classification                      │
│  POST /api/ai/classify-intent                              │
│  ➜ Classifies as: ADD_STOCK (confidence: 0.95)            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
        ┌─────────┴──────────┐
        │ Confidence < 0.6?  │
        └─────────┬──────────┘
                  │
         Yes ◄────┤────► No
          │              │
          ▼              ▼
┌──────────────────┐    ┌──────────────────────────────────────┐
│ Local Fallback   │    │  Stage 2: Parameter Extraction       │
│ - Regex match    │    │  POST /api/ai/extract-params         │
│ - Higher conf?   │    │  ➜ Extracts: { item: "M10 nuts",    │
│ - Use fallback   │    │      quantity: 5,                    │
└──────────────────┘    │      location: "rack 1 bin6" }       │
                        └──────────────┬───────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────────────┐
                        │   Resolve Contextual References      │
                        │   - "more" → last item               │
                        │   - "same" → last item               │
                        │   - Infer location from context      │
                        └──────────────┬───────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────────────┐
                        │         Execute Command              │
                        │  - Route to command executor         │
                        │  - Update inventory                  │
                        │  - Return success/failure            │
                        └──────────────────────────────────────┘
```

## File Structure

```
src/lib/
├── actions/
│   ├── index.ts              # Export all
│   ├── registry.ts           # ACTION_REGISTRY - all action definitions
│   └── types.ts              # TypeScript types
├── ai/
│   ├── index.ts              # Export all
│   ├── classify.ts           # Stage 1: Call classify-intent API
│   ├── extract.ts            # Stage 2: Call extract-params API
│   ├── fallback-parser.ts    # Stage 3: Local regex fallback
│   ├── conversation.ts       # Conversation context manager
│   └── orchestrator.ts       # Coordinates all stages

api/
├── ai/
│   ├── classify-intent.ts    # Stage 1 endpoint
│   ├── extract-params.ts     # Stage 2 endpoint
│   └── parse-command.ts      # Backward compatible wrapper
└── lib/
    └── grok.ts               # Grok API client wrapper
```

## Action Registry

The `ACTION_REGISTRY` contains comprehensive definitions for 25+ actions across 6 categories:

### Stock Management
- `ADD_STOCK` - Add items to inventory
- `REMOVE_STOCK` - Remove/use items
- `TRANSFER_STOCK` - Move between locations
- `COUNT_STOCK` - Physical stock count
- `SEARCH_STOCK` - Find items in stock
- `LOW_STOCK_REPORT` - Items below minimum

### Catalogue Management
- `ADD_PRODUCT` - Add to catalogue
- `UPDATE_PRODUCT` - Update product details
- `SEARCH_CATALOGUE` - Search products

### Customer Management
- `ADD_CUSTOMER` - Create customer
- `UPDATE_CUSTOMER` - Update customer
- `ADD_SITE` - Add site address
- `SEARCH_CUSTOMERS` - Find customers

### Equipment Management
- `ADD_EQUIPMENT` - Add equipment
- `UPDATE_EQUIPMENT` - Update equipment
- `INSTALL_PART` - Install part on equipment
- `SEARCH_EQUIPMENT` - Find equipment

### Job Management
- `CREATE_JOB` - Create work order
- `UPDATE_JOB` - Update job
- `COMPLETE_JOB` - Mark complete
- `ADD_PARTS_TO_JOB` - Add parts used
- `SEARCH_JOBS` - Find jobs

### Supplier Management
- `ADD_SUPPLIER` - Create supplier
- `CREATE_ORDER` - Create purchase order
- `RECEIVE_ORDER` - Receive order

Each action includes:
- Description
- Keywords for classification
- Required and optional parameters
- Examples with expected extraction

## Conversation Context

The conversation manager enables contextual commands:

```javascript
// First command
"Add 5 M10 nuts to rack 1 bin6"
// → Stores: lastItem="M10 nuts", lastLocation="rack 1 bin6", lastQuantity=5

// Subsequent command
"Add 5 more"
// → Resolves to: item="M10 nuts", location="rack 1 bin6", quantity=5

// Another command
"Same thing to van"
// → Resolves to: item="M10 nuts", location="van"
```

Context features:
- Keeps last 10 messages
- 30-minute timeout
- Tracks last item, location, quantity, action
- Resolves "more", "same", implicit locations

## Local Fallback Patterns

Enhanced regex patterns cover common commands:

```javascript
// ADD_STOCK patterns
"add/put/receive [qty] [item] to/into [location]"
"Add 5 M10 nuts to rack 1 bin6"

// REMOVE_STOCK patterns
"use/used/take/took/remove [qty] [item] from [location]"
"Used 2 filters from van"

// TRANSFER_STOCK patterns
"move/transfer [qty] [item] from [loc1] to [loc2]"
"Move 10 bolts from warehouse to van"

// COUNT_STOCK patterns
"I've got [qty] [item] at/on/in [location]"
"I've got 50 bearings on shelf A"

// ADD_PRODUCT patterns
"add new item [name] cost [price] markup [%]"
"Add new item cable 0.75mm cost 25 markup 35%"

// ADD_CUSTOMER patterns
"new/add customer [name]"
"New customer ABC Heating"

// CREATE_JOB patterns
"new/create job for [customer] - [description]"
"New job for ABC Heating - boiler repair"
```

## Testing Scenarios

### Basic Commands

1. **Add Stock**
   ```
   Input: "Add 5 M10 nuts to rack 1 bin6"
   Expected: ADD_STOCK with { item: "M10 nuts", quantity: 5, location: "rack 1 bin6" }
   ```

2. **Receive Stock**
   ```
   Input: "Received 20 bearings into warehouse"
   Expected: ADD_STOCK with { item: "bearings", quantity: 20, location: "warehouse" }
   ```

3. **Remove Stock**
   ```
   Input: "Used 2 filters from van"
   Expected: REMOVE_STOCK with { item: "filters", quantity: 2, location: "van" }
   ```

4. **Transfer Stock**
   ```
   Input: "Move 10 bolts from warehouse to van"
   Expected: TRANSFER_STOCK with { item: "bolts", quantity: 10, fromLocation: "warehouse", toLocation: "van" }
   ```

5. **Stock Count**
   ```
   Input: "I've got 50 bearings on shelf A"
   Expected: COUNT_STOCK with { item: "bearings", quantity: 50, location: "shelf A" }
   ```

6. **Search Stock**
   ```
   Input: "What bearings do we have?"
   Expected: SEARCH_STOCK with { search: "bearings" }
   ```

7. **Add Product**
   ```
   Input: "Add new item cable 0.75mm cost 25 markup 35%"
   Expected: ADD_PRODUCT with { name: "cable 0.75mm", unitCost: 25, markup: 35 }
   ```

8. **Add Customer**
   ```
   Input: "New customer ABC Heating"
   Expected: ADD_CUSTOMER with { name: "ABC Heating" }
   ```

9. **Create Job**
   ```
   Input: "New job for ABC Heating - boiler repair"
   Expected: CREATE_JOB with { customerName: "ABC Heating", description: "boiler repair" }
   ```

### Contextual Commands

10. **Add More (using context)**
    ```
    Context: Previous command was "Add 5 M10 nuts to rack 1 bin6"
    Input: "Add 5 more"
    Expected: ADD_STOCK with { item: "M10 nuts", quantity: 5, location: "rack 1 bin6" }
    ```

### Fallback Scenarios

11. **AI Unavailable**
    ```
    Input: "Add 5 bolts to warehouse"
    With AI down: Uses local fallback parser
    Expected: ADD_STOCK with correct parameters
    ```

## API Response Format

### Classification Response
```json
{
  "success": true,
  "data": {
    "action": "ADD_STOCK",
    "confidence": 0.95,
    "reasoning": "Clear add/receive stock command"
  }
}
```

### Extraction Response
```json
{
  "success": true,
  "data": {
    "parameters": {
      "item": "M10 nuts",
      "quantity": 5,
      "location": "rack 1 bin6"
    },
    "missingRequired": [],
    "confidence": 0.9
  }
}
```

### Combined Response (parse-command)
```json
{
  "success": true,
  "data": {
    "action": "ADD_STOCK",
    "parameters": {
      "item": "M10 nuts",
      "quantity": 5,
      "location": "rack 1 bin6"
    },
    "confidence": 0.9,
    "reasoning": "Two-stage parsing: ADD_STOCK with 3 parameters",
    "model": "grok-3-mini",
    "latency": 1250
  }
}
```

## Performance

- **Stage 1 (Classification)**: ~500-800ms with grok-3-mini
- **Stage 2 (Extraction)**: ~600-1000ms with grok-3-mini
- **Total**: ~1.2-1.8 seconds for full parsing
- **Fallback**: <10ms for regex matching

## Backward Compatibility

The implementation maintains full backward compatibility:

1. **Existing endpoint**: `/api/ai/parse-command` still works
2. **Action aliases**: Old action names map to new ones
   - `RECEIVE_STOCK` → `ADD_STOCK`
   - `USE_STOCK` → `REMOVE_STOCK`
   - `STOCK_COUNT` → `COUNT_STOCK`
3. **Frontend unchanged**: No breaking changes to UI code
4. **Command executor**: Handles both old and new action names

## Benefits

1. **Improved Accuracy**: Focused tasks → better results
2. **Better Confidence**: Clearer when AI is uncertain
3. **Contextual Understanding**: "add 5 more" patterns work
4. **Resilient**: Local fallback when AI unavailable
5. **Maintainable**: Clear separation of concerns
6. **Extensible**: Easy to add new actions

## Future Improvements

1. **Action-specific validators**: Zod schemas for parameter validation
2. **Multi-turn conversations**: Ask clarifying questions
3. **Learning**: Track common patterns to improve fallback
4. **Batch processing**: Handle multiple commands at once
5. **Voice input**: Optimize for speech-to-text variations
