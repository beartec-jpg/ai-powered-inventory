# AI-Powered Inventory Management Backend

Backend service for the AI-Powered Inventory Management System built with Express, TypeScript, and Prisma.

## Features

- **Authentication System**: JWT-based authentication with role-based access control (RBAC)
- **Inventory Management**: Full CRUD operations for products with SKU validation
- **Stock Management**: Real-time stock tracking, adjustments, and transfers between warehouses
- **Warehouse Management**: Multi-warehouse support with capacity tracking
- **Activity Logging**: Comprehensive audit trail for all operations

## Tech Stack

- **Node.js** with **Express.js**
- **TypeScript** for type safety
- **Prisma ORM** for database operations
- **PostgreSQL** database
- **JWT** for authentication
- **Bcrypt** for password hashing
- **Joi** for input validation

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 13

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp ../.env.example .env
# Edit .env and configure your DATABASE_URL and other settings
```

3. Generate Prisma Client:
```bash
npm run prisma:generate
```

4. Run database migrations:
```bash
npm run prisma:migrate
```

5. Seed the database with sample data:
```bash
npm run prisma:seed
```

## Database Setup

### Create Database Migration

To create a new migration after schema changes:

```bash
npx prisma migrate dev --name <migration_name>
```

### Seed Database

The seed script populates the database with sample data including:
- 3 users (admin, manager, staff) with password: `password123`
- 3 warehouses (Main, West Coast, East Coast)
- 3 suppliers
- 15 products across various categories
- Stock entries for products across warehouses
- Sample purchase orders and stock transfers

Run the seed script:

```bash
npm run prisma:seed
```

### Database Schema

The schema includes 11 models:
- **User**: User accounts with roles (ADMIN, MANAGER, STAFF, VIEWER)
- **Warehouse**: Storage locations with capacity tracking
- **WarehouseAccess**: User permissions per warehouse
- **Product**: Inventory items with SKU, pricing, and categories
- **Supplier**: Vendor information
- **ProductSupplier**: Product-supplier relationships
- **Stock**: Current inventory levels per warehouse
- **StockMovement**: Historical stock changes
- **StockTransfer**: Inter-warehouse transfers
- **PurchaseOrder**: Orders from suppliers
- **PurchaseOrderItem**: Line items in purchase orders
- **Activity**: Audit log for all operations

## Development

Start the development server with hot reload:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Build

Build for production:

```bash
npm run build
```

## Start Production Server

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout (client-side token removal)
- `GET /api/auth/me` - Get current user info

### Inventory

- `GET /api/inventory` - List all products (with pagination and filters)
- `GET /api/inventory/:id` - Get product details
- `POST /api/inventory` - Create new product (Manager/Admin only)
- `PUT /api/inventory/:id` - Update product (Manager/Admin only)
- `DELETE /api/inventory/:id` - Delete product (Manager/Admin only)
- `GET /api/inventory/categories` - Get all product categories

### Stock

- `GET /api/stock` - List stock across all warehouses
- `GET /api/stock/warehouse/:warehouseId` - Get stock for specific warehouse
- `GET /api/stock/:productId` - Get stock levels for product
- `POST /api/stock/adjust` - Adjust stock quantity (Manager/Admin only)
- `POST /api/stock/transfer` - Transfer stock between warehouses (Manager/Admin only)
- `GET /api/stock/low` - Get low stock items

### Warehouse

- `GET /api/warehouse` - List all warehouses
- `GET /api/warehouse/:id` - Get warehouse details
- `GET /api/warehouse/:id/utilization` - Get warehouse capacity utilization
- `GET /api/warehouse/:id/summary` - Get warehouse stock summary
- `POST /api/warehouse` - Create warehouse (Admin only)
- `PUT /api/warehouse/:id` - Update warehouse (Manager/Admin only)

### Health Check

- `GET /health` - Health check endpoint

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### User Roles

- **ADMIN**: Full access to all operations
- **MANAGER**: Can manage products, stock, and warehouses
- **STAFF**: Can view data and perform basic operations
- **VIEWER**: Read-only access

### Default Login Credentials (after seeding)

```
Admin:   admin@inventory.com / password123
Manager: manager@inventory.com / password123
Staff:   staff@inventory.com / password123
```

## Code Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Database seeding script
├── src/
│   ├── middleware/        # Express middleware
│   │   ├── auth.ts        # JWT authentication & RBAC
│   │   └── logger.ts      # Request logging
│   ├── routes/            # API route handlers
│   │   ├── auth.ts        # Authentication routes
│   │   ├── inventory.ts   # Inventory routes
│   │   ├── stock.ts       # Stock management routes
│   │   └── warehouse.ts   # Warehouse routes
│   ├── services/          # Business logic layer
│   │   ├── authService.ts
│   │   ├── inventoryService.ts
│   │   ├── stockService.ts
│   │   └── warehouseService.ts
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/             # Utility functions
│   │   ├── responses.ts   # Standardized API responses
│   │   └── validators.ts  # Input validation schemas
│   └── index.ts           # Main application entry point
├── package.json
└── tsconfig.json
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message",
  "timestamp": "2024-01-07T12:00:00.000Z"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resources)
- `500` - Internal Server Error

## Validation

Input validation is performed using Joi schemas. All endpoints validate:
- Request body parameters
- Query string parameters
- URL parameters

## Logging

Request and response logging is handled by custom middleware that logs:
- HTTP method and URL
- Status code
- Response time
- Request/response sizes
- Client IP address
- User agent

Logs are written to:
- Console (development)
- File: `logs/requests-YYYY-MM-DD.log`

## Testing

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Linting

Lint code:

```bash
npm run lint
```

Auto-fix linting issues:

```bash
npm run lint:fix
```

## Type Checking

Run TypeScript type checking without building:

```bash
npm run type-check
```

## Scripts

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
