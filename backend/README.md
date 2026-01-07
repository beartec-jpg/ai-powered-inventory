# AI-Powered Inventory Backend

Backend service for AI-powered inventory management system using Drizzle ORM.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **Authentication**: Clerk
- **Deployment**: Vercel Serverless

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp ../.env.example .env
   # Edit .env with your actual values
   ```

3. Generate Drizzle migrations:
   ```bash
   npm run db:generate
   ```

4. Run migrations:
   ```bash
   npm run db:migrate
   ```

5. Seed database (optional):
   ```bash
   npm run db:seed
   ```

## Development

Start the development server:
```bash
npm run dev
```

The server will run on http://localhost:3000

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run type-check` - Type check TypeScript code
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio
- `npm run db:seed` - Seed database with test data

## Database Schema

The database includes the following tables:

- `users` - User accounts and authentication
- `warehouses` - Warehouse locations
- `warehouse_accesses` - User warehouse permissions
- `products` - Product catalog
- `suppliers` - Supplier information
- `product_suppliers` - Product-supplier relationships
- `stocks` - Inventory stock levels
- `stock_movements` - Stock movement history
- `stock_transfers` - Warehouse transfers
- `purchase_orders` - Purchase orders
- `purchase_order_items` - PO line items
- `activities` - Audit log
- `chat_conversations` - AI chat conversations
- `chat_messages` - Chat messages
- `tool_calls` - AI tool execution tracking

## Authentication

This backend uses Clerk for authentication. Configure Clerk credentials in your `.env` file:

```env
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
```

## API Endpoints

### Health Check
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health information

### Inventory (Protected)
- Product CRUD operations
- Stock management
- Warehouse operations
- Transfer operations

### AI Chat (Protected)
- Natural language inventory queries
- AI-powered stock operations
- Conversation history

## Deployment

This backend is designed to run on Vercel Serverless. Configuration is in `vercel.json` at the project root.

## License

MIT
