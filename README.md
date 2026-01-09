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

## ✨ Features

- **Natural Language Interface**: AI-powered commands for inventory operations via xAI Grok
- **Multi-Warehouse Support**: Manage inventory across multiple locations
- **Real-time Stock Tracking**: Track quantities, transfers, and movements
- **Supplier Management**: Manage products and purchase orders
- **AI Assistant**: xAI-powered chat for intelligent inventory queries
- **Role-Based Access**: Admin, Manager, Staff, and Viewer roles
- **Audit Trail**: Complete activity logging

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

2. **AI Parsing**: Command sent to xAI Grok API
   - Extracts action type (e.g., `RECEIVE_STOCK`, `LOW_STOCK_REPORT`)
   - Extracts parameters (e.g., `partNumber`, `quantity`, `location`)
   - Returns confidence score

3. **Fallback Parser**: If AI can't parse or returns low confidence
   - Local regex-based pattern matching
   - Handles common command structures
   - Example patterns: "Add item X to location Y", "Move X from Y to Z"

4. **Execution**: Command executor routes to appropriate handler
   - Validates parameters
   - Updates database/state
   - Returns success or error message

5. **Response**: User sees confirmation or error message

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

4. Start development server:
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

1. Visit [https://neon.tech/](https://neon.tech/) and create a free account
2. Create a new project
3. Copy the connection string from the project dashboard
4. Add it to your `.env` file as `DATABASE_URL`
5. Run database migrations (if applicable):
   ```bash
   npm run db:migrate
   ```

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
