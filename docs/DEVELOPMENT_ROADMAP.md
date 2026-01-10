# Development Roadmap

This document tracks the phased implementation plan for the AI-Powered Inventory Management System.

## Phase 1: Critical Fixes
- [x] PR 1.1: Fix Unknown Action Error - Added QUERY_INVENTORY handler to prevent "Unknown action" error when AI returns default fallback action
- [ ] PR 1.2: Basic Part Matching - Implement fuzzy matching for part numbers and names to handle typos and variations

## Phase 2: Action Plans
- [ ] PR 2.1: Action Plan Response Structure - Define structured response format for multi-step operations with validation checkpoints
- [ ] PR 2.2: Action Plan Executor - Build executor engine that processes action plans step-by-step with rollback capabilities

## Phase 3: Clarification UX
- [ ] PR 3.1: Clarification Dialog - Implement interactive dialog system when AI needs additional information from user
  - Support for multiple choice questions
  - Free-form text input
  - Location/item selection from existing data

## Phase 4: Polish & Safety
- [ ] PR 4.1: Rollback, History & Error Handling
  - Command history with undo capability
  - Transaction rollback for failed multi-step operations
  - Enhanced error messages with suggested corrections
  - Activity audit trail with rollback points

---

## Testing Checkpoints

### Phase 1 Checkpoints
- **Test 1.1a**: Command "Add a new item, details Siemens km3 123455 bought from comtherm, add to rack 1 bin 2"
  - Expected: No "Unknown action: QUERY_INVENTORY" error
  - Expected: Item received into stock or clarification requested
  
- **Test 1.1b**: Existing commands still work
  - "Add 50 bolts to warehouse A" → Creates/updates stock
  - "Where is part XYZ?" → Returns location info
  - "Show low stock" → Returns low stock report

- **Test 1.2a**: Fuzzy part number matching
  - "Add 10 LMV37100" matches "LMV37.100"
  - "Where is burner controller?" matches "burner controller"

### Phase 2 Checkpoints
- **Test 2.1**: Action plan structure validation
  - Multi-step command generates proper action plan JSON
  - Each step includes validation criteria
  
- **Test 2.2**: Action plan execution
  - Plan executes steps in correct order
  - Partial failure triggers rollback
  - Success/failure properly reported

### Phase 3 Checkpoints
- **Test 3.1a**: Ambiguous command triggers clarification
  - "Add part to bin 3" → Asks which part
  - "Move items to warehouse B" → Asks which items and from where
  
- **Test 3.1b**: Clarification provides context
  - Shows relevant options based on existing data
  - Supports keyboard navigation and search

### Phase 4 Checkpoints
- **Test 4.1a**: Command history and undo
  - Last 10 commands shown with timestamps
  - Undo reverses last successful operation
  
- **Test 4.1b**: Transaction rollback
  - Failed step in multi-step operation rolls back previous steps
  - Inventory state remains consistent
  
- **Test 4.1c**: Enhanced error messages
  - Clear explanation of what went wrong
  - Suggestions for correcting the command
  - Links to relevant documentation

---

## Implementation Notes

### Current System Limitations
1. **Part Number Extraction**: Currently uses first word from item name, which may not work well for complex product names
2. **No Fuzzy Matching**: Requires exact matches for part numbers and locations
3. **Limited Context**: AI doesn't maintain conversation context between commands
4. **No Multi-step Plans**: Each command is atomic, can't handle complex workflows

### Future Enhancements
- Integration with barcode scanners for faster stock updates
- Mobile app for field technicians
- Real-time sync across multiple devices
- Advanced analytics and forecasting
- Integration with supplier APIs for automated ordering
- Photo upload for equipment and parts documentation
