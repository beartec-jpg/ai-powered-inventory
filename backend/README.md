# AI-Powered Inventory Backend

Backend service for AI-powered inventory management system using Prisma ORM.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma ORM
- **AI**: xAI Grok API
- **Authentication**: JWT-based
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

3. Generate Prisma Client:
   ```bash
   npm run db:generate
   ```

4. Run database migrations:
   ```bash
   npm run db:migrate
   ```
   
   Or for production deployment:
   ```bash
   npm run db:migrate:deploy
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
- `npm run db:generate` - Generate Prisma Client
- `npm run db:migrate` - Run database migrations (development)
- `npm run db:migrate:deploy` - Run database migrations (production)
- `npm run db:push` - Push schema changes to database (without migrations)
- `npm run db:studio` - Open Prisma Studio (GUI for database)
- `npm run db:seed` - Seed database with sample data

## Environment Variables

See `.env.example` in the root directory for all required environment variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT token signing
- `JWT_EXPIRY` - Access token expiration (e.g., "24h")
- `JWT_REFRESH_EXPIRY` - Refresh token expiration (e.g., "7d")
- `XAI_API_KEY` - xAI API key for chat functionality
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Database Management

### Migrations

Create a new migration after schema changes:
```bash
npm run db:migrate
```

This will:
1. Create a new migration file in `prisma/migrations/`
2. Apply the migration to your database
3. Regenerate Prisma Client

### Schema Updates

After modifying `prisma/schema.prisma`:
1. Generate a migration: `npm run db:migrate`
2. Or push directly (dev only): `npm run db:push`

### Reset Database

To reset your database and re-run all migrations:
```bash
npx prisma migrate reset
```

**Warning**: This will delete all data!

## Features

### Phase 2 Complete ✅
- Database schema with Prisma ORM
- Comprehensive seed script with realistic data
- JWT-based authentication with RBAC
- Inventory CRUD endpoints
- Stock management (adjust, transfer, low stock alerts)
- Warehouse management endpoints
- Input validation on all endpoints
- Standardized error handling and responses
- TypeScript strict typing throughout
- Activity logging for audit trail

### Phase 3 Complete ✅
- xAI Grok integration for intelligent chat
- Natural language inventory queries
- Tool-based inventory operations
- Chat conversation history
- Real-time AI responses
- Comprehensive audit logging

## License

MIT

