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
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:seed` - Seed database with sample data
- `npm run prisma:studio` - Open Prisma Studio (GUI for database)

## Environment Variables

See `.env.example` in the root directory for all required environment variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT token signing
- `JWT_EXPIRY` - Access token expiration (e.g., "24h")
- `JWT_REFRESH_EXPIRY` - Refresh token expiration (e.g., "7d")
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Phase 2 Completion

This backend implements Phase 2 requirements:

✅ Database migrations and schema  
✅ Comprehensive seed script with realistic data  
✅ JWT-based authentication with RBAC  
✅ Inventory CRUD endpoints  
✅ Stock management (adjust, transfer, low stock alerts)  
✅ Warehouse management endpoints  
✅ Input validation on all endpoints  
✅ Standardized error handling and responses  
✅ TypeScript strict typing throughout  
✅ Activity logging for audit trail  

## Next Steps (Phase 3)

Phase 3 will integrate xAI for:
- Intelligent inventory forecasting
- Automated reorder recommendations
- Natural language queries
- Demand prediction
- Stock optimization

## License

MIT
