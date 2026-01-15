# AI-Powered Inventory Management System

An intelligent stock management system that uses natural language processing to execute inventory operations. Built with Drizzle ORM, Vercel Serverless Functions, and Neon PostgreSQL.

## 🚀 Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Architecture**: Vercel Serverless Functions
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **AI**: xAI Grok API for natural language processing
- **Deployment**: Vercel

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Deployment**: Vercel

## ⚠️ Important: KV Storage Temporary Shim

This application includes a **temporary KV (key-value) storage shim** to prevent UI flow interruptions during multi-step catalogue creation. The current implementation:

### What's Implemented
- **Client-side defensive wrapper** (`src/lib/kv-safe.ts`): Safely handles KV operations with multiple fallback strategies
- **KV patch installer** (`src/lib/install-kv-patch.ts`): Wraps `window.ho.setKey` to prevent uncaught promise rejections
- **Temporary server endpoint** (`api/_spark/kv/[key].ts`): Accepts PUT/POST/GET/DELETE requests to prevent 404 errors

### Why This Is Needed
The multi-step flow previously relied on a `/_spark/kv/*` endpoint that didn't exist, causing:
- Uncaught promise rejections in the browser console
- UI flow interruption when users clicked "Yes" to add catalogue items
- Poor user experience with no feedback on what went wrong

### Current Limitations
⚠️ **The temporary KV endpoint uses in-memory storage and is NOT persistent:**
- Data is lost between serverless function cold starts
- Not suitable for production use
- Only prevents 404 errors to allow UI flow to continue

### TODO: Production KV Storage
Replace the temporary shim with proper persistent storage:

1. **Option 1: Vercel KV (Recommended for Vercel deployments)**
   ```bash
   npm install @vercel/kv
   ```
   Update `api/_spark/kv/[key].ts` to use Vercel KV:
   ```typescript
   import { kv } from '@vercel/kv'
   // Replace kvStore.set(key, value) with await kv.set(key, value)
   // Replace kvStore.get(key) with await kv.get(key)
   ```

2. **Option 2: Neon PostgreSQL Table**
   Create a `kv_storage` table in your existing Neon database:
   ```sql
   CREATE TABLE kv_storage (
     key VARCHAR(255) PRIMARY KEY,
     value JSONB NOT NULL,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```
   Update the endpoint to use database queries instead of in-memory Map.

3. **Option 3: Other KV Stores**
   - Redis
   - DynamoDB
   - Any other key-value database

### Migration Path
1. Choose a persistent KV storage solution (Vercel KV recommended)
2. Update `api/_spark/kv/[key].ts` to use the new storage backend
3. Test the multi-step catalogue flow
4. Remove the TODO comments once migrated
5. Keep the client-side defensive wrappers (`kv-safe.ts` and `install-kv-patch.ts`) as they provide resilience

## ✨ Features

### Core Features
- **Natural Language Interface**: AI-powered commands for inventory operations via xAI Grok
- **Two-Stage AI Processing**: Intent classification → Parameter extraction with override logic
- **Smart Search Override**: Automatically routes searches based on confidence scores and context
- **Multi-Warehouse Support**: Manage inventory across multiple locations
- **Real-time Stock Tracking**: Track quantities, transfers, and movements
- **Persistent Storage**: Drizzle ORM with Neon PostgreSQL for production-grade data persistence
- **Supplier Management**: Manage products and purchase orders
- **AI Assistant**: xAI-powered chat for intelligent inventory queries
- **Role-Based Access**: Admin, Manager, Staff, and Viewer roles
- **Audit Trail**: Complete activity logging

### Enhanced AI Features (Latest Updates)
- **Parameter-Driven Search Override**: Low intent confidence but high parameter confidence automatically triggers search actions
- **Stock Keyword Detection**: Smart routing between catalogue and stock searches based on context
- **Short-Code Recognition**: Special handling for 2-10 character alphanumeric product codes
- **Multi-Step Flow Persistence**: Partial parameters saved between steps, preventing re-requests
- **Parameter Normalization**: Automatic mapping of variations (item→partNumber, cost→unitCost, etc.)
- **Debug Information**: Full transparency with stage1/stage2 confidence and override reasoning

### Mobile Optimizations
- **Responsive Design**: Dropdown selectors on mobile, tabs on desktop
- **Card-Based Layout**: Touch-friendly inventory cards
- **Adaptive Navigation**: Auto-adjusting UI based on screen size

### Persistence Options
1. **Production**: Neon PostgreSQL with Drizzle ORM (recommended)
2. **Fallback**: localStorage for client-side persistence when database unavailable
3. **Migration Tools**: Built-in migration scripts and guides

## 🏗️ System Architecture

### High-Level Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   User      │─────▶│  React UI    │─────▶│  Vercel     │
│  (Browser)  │◀─────│  (Frontend)  │◀─────│  Functions  │
└─────────────┘      └──────────────┘      └──────┬──────┘
                                                   │
                     ┌─────────────────────────────┼─────────────────┐
                     │                             │                 │
                     ▼                             ▼                 ▼
              ┌──────────────┐            ┌──────────────┐   ┌──────────────┐
              │  xAI Grok    │            │  Neon        │   │  Business    │
              │  (AI Parse)  │            │  PostgreSQL  │   │  Logic       │
              └──────────────┘            └──────────────┘   └──────────────┘
```

### AI Integration Flow

The system uses **xAI Grok** for natural language command processing:

1. **User Input**: User enters a command in natural language
   - Example: *"Add 50 bolts to warehouse A"*
   - Example: *"Show me all low stock items"*
   - Example: *"Create a job for customer Acme Inc"*

2. **AI Parsing (Two-Stage Process)**: Command sent to xAI Grok API
   - **Stage 1: Intent Classification**
     - Determines action type (e.g., `SEARCH_CATALOGUE`, `RECEIVE_STOCK`, `LOW_STOCK_REPORT`)
     - Returns classification confidence score
   - **Stage 2: Parameter Extraction**
     - Extracts structured parameters (e.g., `partNumber`, `quantity`, `location`)
     - Returns extraction confidence score
   - **Override Logic**: If intent confidence < 0.65 but extraction confidence >= 0.8 with search parameters
     - Automatically overrides to SEARCH_CATALOGUE or SEARCH_STOCK
     - Uses stock keywords to determine correct search type
     - Includes debug information about override decision

3. **Parameter Normalization**: Standardizes variations
   - `item`, `part`, `sku` → `partNumber`
   - `cost`, `price` → `unitCost`
   - `supplier`, `supplierName` → `preferredSupplierName`
   - Ensures consistency across multi-step flows

4. **Fallback Parser**: If AI can't parse or returns low confidence
   - Local regex-based pattern matching
   - Handles common command structures
   - Special short-code pattern for 2-10 char alphanumeric codes
   - Example patterns: "Add item X to location Y", "Move X from Y to Z", "lmv"

5. **Execution**: Command executor routes to appropriate handler
   - Validates parameters
   - Updates database/state (Neon PostgreSQL or localStorage)
   - Returns success or error message

6. **Response**: User sees confirmation or error message
   - Includes debug information when available
   - Shows which stage determined the action

### Command Flow Diagram

```
User Command
     │
     ▼
┌─────────────────┐
│  AI Parse       │──── xAI Grok API
│  (Primary)      │
└────────┬────────┘
         │
    ┌────▼─────┐
    │ Success? │
    └────┬─────┘
         │ No
         ▼
┌─────────────────┐
│  Local Parse    │──── Regex Patterns
│  (Fallback)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Route Action   │──── Action Type → Handler
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Execute        │──── Update State/DB
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return Result  │──── Success/Error Message
└─────────────────┘
```

For detailed information about the AI system, see [docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md).

## 📚 Documentation

- **[Development Roadmap](docs/DEVELOPMENT_ROADMAP.md)** - Phased implementation plan with testing checkpoints
- **[AI Architecture](docs/AI_ARCHITECTURE.md)** - Detailed AI system documentation, action types, and how to add new actions
- **[Field Service System](FIELD_SERVICE_SYSTEM.md)** - Field service and job management features
- **[Phase 2 Summary](PHASE2_SUMMARY.md)** - Recent enhancements and changes

## 📦 Project Structure

```
ai-powered-inventory/
├── api/                  # Vercel Serverless Functions
│   ├── index.ts          # Health check endpoint
│   ├── ai/
│   │   └── parse-command.ts   # xAI Grok integration
│   ├── inventory/
│   │   └── products.ts        # Product CRUD endpoints
│   ├── stock/
│   │   └── index.ts           # Stock management endpoints
│   ├── auth/
│   │   └── index.ts           # Auth endpoints (placeholder)
│   └── lib/                   # Shared utilities
│       ├── db.ts              # Database connection
│       ├── schema.ts          # Database schema (Drizzle)
│       ├── services.ts        # Business logic
│       └── utils.ts           # Utility functions
├── src/                  # React frontend
│   ├── lib/
│   │   ├── command-executor.ts  # Command execution logic
│   │   ├── ai-commands.ts       # AI helper functions
│   │   └── types.ts             # TypeScript type definitions
│   ├── components/       # React components
│   ├── pages/            # Application pages
│   └── ...
├── docs/                 # Documentation
│   ├── DEVELOPMENT_ROADMAP.md  # Implementation phases
│   └── AI_ARCHITECTURE.md      # AI system documentation
├── vercel.json           # Vercel deployment config
└── package.json          # Single package.json
```

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon recommended)
- xAI API key for Grok integration

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/beartec-jpg/ai-powered-inventory.git
   cd ai-powered-inventory
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

   **Required Environment Variables:**
   - `DATABASE_URL` - Neon PostgreSQL connection string (see Database Setup below)
   - `XAI_API_KEY` - Your xAI API key from https://x.ai/
   - `VITE_CLERK_PUBLISHABLE_KEY` - Clerk authentication (optional)
   - `CLERK_SECRET_KEY` - Clerk backend key (optional)

4. Set up the database (see Database Setup section below)

5. Start development server:
   ```bash
   npm run dev
   ```

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL=postgresql://...          # Neon PostgreSQL connection string

# xAI API Configuration
XAI_API_KEY=your-xai-api-key-here     # Get from https://x.ai/
XAI_MODEL=grok-beta                    # AI model to use
XAI_ENDPOINT=https://api.x.ai/v1      # xAI API endpoint

# CORS Configuration
CORS_ORIGIN=http://localhost:5173      # Frontend URL for CORS

# Environment
NODE_ENV=development                   # development | production
```

### Getting Your xAI API Key

1. Visit [https://x.ai/](https://x.ai/) and sign up for an account
2. Navigate to the API section in your account dashboard
3. Generate a new API key
4. Copy the key and add it to your `.env` file as `XAI_API_KEY`

**Note**: Keep your API key secure and never commit it to version control. The `.gitignore` file is configured to exclude `.env` files.

### Setting Up Neon PostgreSQL

This system uses **Neon PostgreSQL** for persistent data storage. Follow these steps:

1. **Create Neon Account**
   - Visit [https://neon.tech/](https://neon.tech/) and create a free account
   - Create a new project
   - Copy the connection string from the project dashboard

2. **Configure Database Connection**
   - Add the connection string to your `.env` file:
     ```env
     DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"
     ```

3. **Create Database Tables**
   
   Two options:

   **Option A: Using Drizzle Kit** (Recommended)
   ```bash
   npm install -D drizzle-kit
   npx drizzle-kit push:pg
   ```

   **Option B: Manual SQL** (Run in Neon console)
   ```sql
   -- See DATABASE_MIGRATION.md for complete SQL schema
   -- Creates catalogue_items and stock_levels tables
   ```

4. **Verify Setup**
   ```bash
   # Test API endpoints
   curl http://localhost:5173/api/inventory/catalogue
   # Should return empty array [] if successful
   ```

5. **Fallback Behavior**
   - Without `DATABASE_URL`: API returns HTTP 503, client uses localStorage
   - With `DATABASE_URL`: Full database persistence across sessions

**📖 Detailed Migration Guide**: See [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) for:
- Complete SQL schema
- Migration from localStorage to database
- Troubleshooting common issues
- Best practices

## 📊 Database Schema

The system includes 14 tables covering:
- User management and authentication
- Warehouse and location tracking
- Product catalog and suppliers
- Stock levels and movements
- Purchase orders and transfers
- AI chat conversations
- Activity audit logs

See `api/lib/schema.ts` for the complete schema definition.

## 🚀 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import the repository in Vercel
3. Configure environment variables in Vercel dashboard:
   - `DATABASE_URL` - Your Neon PostgreSQL connection string
   - `XAI_API_KEY` - Your xAI API key
   - `CORS_ORIGIN` - Your frontend URL
4. Deploy!

The `vercel.json` configuration handles deployment automatically.

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 📖 API Documentation

### Base URL
- Development: `http://localhost:3000/api`
- Production: `https://your-app.vercel.app/api`

### Endpoints

#### Health Check
- `GET /api` - Basic health check

#### AI Integration
- `POST /api/ai/parse-command` - Parse natural language commands using xAI Grok
  - Body: `{ command: string, context?: object }`
  - Returns: Parsed action, parameters, confidence level

#### Inventory Management
- `GET /api/inventory/products` - List products (with pagination)
- `GET /api/inventory/products?id={id}` - Get product by ID
- `GET /api/inventory/products?categories=true` - Get all categories
- `POST /api/inventory/products` - Create new product
- `PUT /api/inventory/products` - Update product
- `DELETE /api/inventory/products?id={id}` - Delete product (soft delete)

#### Stock Management
- `GET /api/stock` - List stock with filters
- `GET /api/stock?low=true` - Get low stock items
- `GET /api/stock?warehouseId={id}` - Get warehouse stock
- `GET /api/stock?productId={id}` - Get product stock summary
- `POST /api/stock` - Adjust or transfer stock
  - Body (adjust): `{ action: "adjust", productId, warehouseId, quantity, reason, notes? }`
  - Body (transfer): `{ action: "transfer", productId, fromWarehouseId, toWarehouseId, quantity, notes? }`

#### Authentication
- `GET /api/auth` - Check auth status (placeholder)
- `POST /api/auth` - Login (placeholder - integrate with Clerk)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Drizzle ORM](https://orm.drizzle.team/)
- AI powered by [xAI Grok](https://x.ai/)
- Hosted on [Vercel](https://vercel.com/)
- Database by [Neon](https://neon.tech/)
