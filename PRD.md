# Planning Guide

An intelligent stock management system that uses natural language processing to execute inventory operations, eliminating the need for traditional forms and navigation—users simply describe what they want to do in plain English.

**Experience Qualities**:
1. **Conversational** - Interactions should feel like talking to an expert warehouse manager who understands your intent and executes commands instantly
2. **Intelligent** - The AI should understand context, correct minor mistakes, and anticipate what users need based on partial information
3. **Efficient** - Complex multi-step operations (like creating parts lists for jobs) should happen through a single natural language command

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This is a full-featured inventory management system with AI orchestration, multiple data models (items, locations, customers, jobs, parts lists), natural language parsing, and context-aware command execution. It requires sophisticated state management and AI integration to map user intent to system functions.

## Essential Features

### Natural Language Command Interface
- **Functionality**: AI-powered text input that interprets user commands and executes appropriate system functions
- **Purpose**: Eliminates learning curve and enables users to work at the speed of thought
- **Trigger**: User types or speaks a command in plain English
- **Progression**: User enters command → AI analyzes intent and parameters → System confirms interpretation → Action executes → Success feedback displayed
- **Success criteria**: 95%+ accuracy in intent recognition; commands execute in under 2 seconds

### Inventory Management
- **Functionality**: Add, update, remove, and track stock items with quantities and locations
- **Purpose**: Core database of all physical inventory
- **Trigger**: Commands like "add 50 units of bearing-202 to warehouse A" or "move all switches from shelf B2 to B3"
- **Progression**: Command received → Item/location validated or created → Quantity adjusted → Transaction logged → Confirmation shown
- **Success criteria**: All inventory changes are atomic and traceable; zero quantity discrepancies

### Location Management
- **Functionality**: Organize inventory across warehouses, rooms, shelves, bins with hierarchical structure
- **Purpose**: Precise tracking of where every item physically exists
- **Trigger**: Commands like "create new location main-warehouse/aisle-5/shelf-C" or "stock check warehouse B"
- **Progression**: Command parsed → Location hierarchy resolved → Location created/queried → Results displayed
- **Success criteria**: Support for unlimited location depth; instant location lookups

### Customer & Job Management
- **Functionality**: Track customers and associate parts lists with specific jobs
- **Purpose**: Organize inventory allocation by project and client
- **Trigger**: Commands like "create parts list for job #4521 with 10x bolt-m8, 5x washer for customer Acme Corp"
- **Progression**: Command parsed → Customer created/found → Job created → Parts list compiled → Quantities reserved → Saved with associations
- **Success criteria**: Jobs and customers persist correctly; parts lists can be retrieved and modified

### Stock Queries & Reporting
- **Functionality**: Natural language queries about inventory status, availability, and location
- **Purpose**: Instant visibility into stock levels without navigating complex UIs
- **Trigger**: Commands like "where is part XYZ-123?" or "how many motors do we have?" or "show me all items under 10 units"
- **Progression**: Query received → Database searched → Results formatted → Displayed with relevant details
- **Success criteria**: Sub-second query response; results include all relevant context

### Command History & Undo
- **Functionality**: Log of all executed commands with ability to reverse recent actions
- **Purpose**: Auditability and error recovery
- **Trigger**: System automatically logs; users can say "undo last action" or view history
- **Progression**: Every command logged → User requests undo → System reverses last operation → State restored → Confirmation shown
- **Success criteria**: All commands are reversible within session; full audit trail maintained

## Edge Case Handling

- **Ambiguous Commands**: AI asks clarifying questions when intent is unclear ("Did you mean warehouse A or warehouse B?")
- **Non-existent Items/Locations**: System offers to create new entries or suggests similar existing ones
- **Insufficient Quantity**: Warns user and asks for confirmation before executing partial fulfillment
- **Conflicting Operations**: Prevents simultaneous modifications to same inventory item; queues or rejects
- **Typos & Misspellings**: Fuzzy matching on part numbers, locations, and customer names
- **Complex Multi-step Commands**: Breaks down into atomic operations and confirms each step
- **Empty Results**: Provides helpful suggestions rather than blank screens ("No items found. Did you mean...?")

## Design Direction

The design should evoke **precision engineering meets conversational AI**—think aerospace control panel aesthetics with the ease of a chat interface. The feeling should be technical, reliable, and fast, with a strong sense that the AI is a capable assistant executing your commands flawlessly.

## Color Selection

A technical, high-contrast palette inspired by industrial control systems and modern developer tools.

- **Primary Color**: Deep Navy Blue (oklch(0.25 0.05 250)) - Conveys technical precision and trustworthiness, used for primary actions and the AI assistant presence
- **Secondary Colors**: 
  - Steel Gray (oklch(0.45 0.01 240)) - For secondary UI elements and inactive states
  - Slate (oklch(0.35 0.02 240)) - For backgrounds and panels that need to recede
- **Accent Color**: Electric Cyan (oklch(0.75 0.15 210)) - Attention-grabbing highlight for AI responses, active commands, and success states
- **Background**: Deep Charcoal (oklch(0.15 0.01 240)) - Professional dark background that reduces eye strain
- **Foreground/Background Pairings**: 
  - Background (Deep Charcoal #1A1D2E): Light Cyan text (oklch(0.95 0.01 210) #F0F4FF) - Ratio 12.1:1 ✓
  - Primary (Deep Navy #2E3A59): White text (oklch(1 0 0) #FFFFFF) - Ratio 7.8:1 ✓
  - Accent (Electric Cyan #3DD4E8): Deep Charcoal text (oklch(0.15 0.01 240) #1A1D2E) - Ratio 8.5:1 ✓
  - Card backgrounds (oklch(0.20 0.02 240)): Light Cyan text - Ratio 10.2:1 ✓

## Font Selection

Monospace for data precision (part numbers, quantities, locations) combined with a technical sans-serif for readability—evoking both terminal interfaces and modern dashboards.

- **Typographic Hierarchy**:
  - H1 (Command Input): JetBrains Mono Medium/24px/normal letter spacing - The focal point where users type commands
  - H2 (Section Headers): Space Grotesk Bold/20px/tight letter spacing - For "Inventory", "Recent Commands", etc.
  - Body (AI Responses): Space Grotesk Regular/16px/relaxed leading - Clear, readable responses from the AI
  - Data (Part Numbers/Quantities): JetBrains Mono Regular/14px/tabular numbers - Ensures alignment and scannability
  - Labels: Space Grotesk Medium/12px/uppercase with wide letter spacing - For metadata and categories

## Animations

Animations should feel like a responsive AI system—snappy confirmations, smooth transitions, and subtle feedback that reinforces the sense of an intelligent assistant working for you.

- Command submission triggers a brief cyan pulse on the input border (150ms)
- AI responses fade in with a subtle upward slide (250ms ease-out)
- Inventory updates flash the affected row with accent color (300ms)
- Successful operations show a checkmark animation (200ms spring physics)
- Navigation between views uses a fast crossfade (200ms) to maintain context
- Loading states show a pulsing dot sequence rather than spinners (more terminal-like)

## Component Selection

- **Components**:
  - `Input` & `Textarea` - Primary command input with large, prominent styling
  - `Card` - For inventory items, jobs, and customer records with hover states
  - `Table` - For structured inventory lists and stock levels with sortable columns
  - `Badge` - For status indicators (in-stock, low-stock, reserved)
  - `Tabs` - Switch between Inventory, Jobs, Customers, History views
  - `Dialog` - Confirmation prompts for destructive actions
  - `ScrollArea` - For command history and long item lists
  - `Separator` - Visual breaks between command input and results
  - `Skeleton` - Loading states for AI processing
  - `Alert` - System notifications and warnings

- **Customizations**:
  - Command input should be oversized and prominent (min 60px height)
  - Cards need hover effects with subtle elevation and accent border glow
  - Tables require monospace font for numeric columns and alternating row backgrounds
  - Badges need semantic color coding (green=in-stock, yellow=low, red=out)
  - Custom AI message bubbles distinct from user input

- **States**:
  - Input: Focus state with glowing cyan border and subtle shadow
  - Buttons: Hover shows accent color shift, active shows pressed effect
  - Cards: Default muted, hover elevated with border highlight, selected shows accent border
  - Loading: Pulsing dots animation instead of circular spinners

- **Icon Selection**:
  - `Package` - Inventory items
  - `MapPin` - Locations
  - `Users` - Customers
  - `FileText` - Jobs and parts lists
  - `MagnifyingGlass` - Search/query operations
  - `Plus` - Add operations
  - `ArrowsClockwise` - Move/transfer operations
  - `ChatCircle` - AI assistant indicator
  - `ClockCounterClockwise` - Command history
  - `CheckCircle` - Success confirmations

- **Spacing**:
  - Command input area: p-6 with mb-8 separation from results
  - Card grid: gap-4 for dense information display
  - Table rows: py-3 px-4 for comfortable scanning
  - Section spacing: mt-8 between major areas
  - Inline elements: gap-2 for icons and text

- **Mobile**:
  - Command input remains full-width and prominent
  - Table converts to stacked card layout on mobile
  - Tabs become a horizontal scroll with snap points
  - Side panels (if any) convert to bottom sheets
  - Touch targets minimum 44px for all interactive elements
  - Command history accessible via slide-up drawer
