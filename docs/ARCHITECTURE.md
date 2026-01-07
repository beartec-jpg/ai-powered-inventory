# System Architecture

## Overview

The AI-Powered Inventory Management System is built as a modern, scalable monorepo application with a clear separation of concerns between frontend and backend components.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React Frontend (Vite)                               │  │
│  │  - UI Components                                      │  │
│  │  - State Management (React Hooks)                    │  │
│  │  - API Client Services                               │  │
│  │  - Tailwind CSS (BEAR TEC Branding)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Express.js Server                                   │  │
│  │  - Request Validation                                │  │
│  │  - Authentication Middleware (JWT)                   │  │
│  │  - Error Handling                                    │  │
│  │  - Logging & Monitoring                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Business Logic Layer                     │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │   Controllers   │  │    Services     │  │  AI Service  │  │
│  │  - Route        │  │  - Business     │  │  - xAI Grok  │  │
│  │    Handlers     │  │    Logic        │  │  - NLP       │  │
│  │  - Request      │  │  - Validation   │  │  - Command   │  │
│  │    Processing   │  │  - Computation  │  │    Parse     │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Access Layer                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Prisma ORM                                           │  │
│  │  - Type-safe Database Client                         │  │
│  │  - Migration Management                              │  │
│  │  - Query Builder                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Database Layer                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL                                           │  │
│  │  - Users, Warehouses, Products                       │  │
│  │  - Stock, Suppliers, PurchaseOrders                  │  │
│  │  - Activities, StockMovements                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### Frontend (React + Vite)

**Technology Stack:**
- React 18+ for UI components
- Vite for fast development and building
- TypeScript for type safety
- Tailwind CSS for styling with BEAR TEC brand colors
- React Hooks for state management

**Directory Structure:**
```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Page components
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API client services
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript type definitions
│   └── styles/          # Global styles
```

### Backend (Express.js + Prisma)

**Technology Stack:**
- Node.js 18+ runtime
- Express.js for REST API
- TypeScript for type safety
- Prisma for database ORM
- PostgreSQL for data storage

**Directory Structure:**
```
backend/
├── src/
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   └── index.ts         # Entry point
├── prisma/
│   └── schema.prisma    # Database schema
```

## Database Schema

### Core Models

1. **User**: Authentication and authorization
2. **Warehouse**: Physical storage locations
3. **Product**: Inventory items
4. **Supplier**: Product suppliers
5. **Stock**: Current inventory levels
6. **StockMovement**: Inventory transaction history
7. **PurchaseOrder**: Purchase order management
8. **Activity**: Audit trail and activity logs

## Design Patterns

### Backend Patterns

1. **MVC Pattern**: Separation of concerns
2. **Repository Pattern**: Data access abstraction through Prisma
3. **Middleware Pattern**: Request processing pipeline
4. **Factory Pattern**: For creating service instances

### Frontend Patterns

1. **Component Pattern**: Reusable, composable UI components
2. **Custom Hooks Pattern**: Reusable stateful logic
3. **Container/Presentational Pattern**: Separation of logic and presentation

## Security Architecture

- JWT-based authentication
- Role-based access control (RBAC)
- Input validation with Joi
- SQL injection prevention (Prisma)
- XSS protection (Helmet.js)
- CORS configuration
- Rate limiting

## Deployment Architecture

### Development
- Local PostgreSQL database
- Vite dev server for frontend
- ts-node-dev for backend hot reload

### Production
- Docker containerization
- Multi-stage Docker builds
- Environment-based configuration
- CI/CD pipeline with GitHub Actions

For more details, see the full architecture documentation.
