# Migration from Prisma to Drizzle ORM

This document describes the migration from Prisma ORM to Drizzle ORM completed for the AI-Powered Inventory project.

## What Changed

### Database ORM
- **Removed**: Prisma Client and Prisma CLI
- **Added**: Drizzle ORM with Neon PostgreSQL support

### Authentication
- **Removed**: Custom JWT authentication
- **Added**: Clerk authentication for both frontend and backend

### Deployment
- **Target**: Vercel serverless functions
- **Database**: Neon PostgreSQL with connection pooling

## Migration Steps Completed

1. ✅ Updated package.json dependencies
2. ✅ Created Drizzle schema from Prisma models
3. ✅ Set up Drizzle client with Neon
4. ✅ Created service layer using Drizzle queries
5. ✅ Added Clerk authentication middleware
6. ✅ Updated seed script for Drizzle
7. ✅ Configured Vercel deployment

## Schema Mapping

All 11 Prisma models were converted to Drizzle tables:

### Core Tables
- `User` → `users` table with Clerk integration
- `Warehouse` → `warehouses` table
- `WarehouseAccess` → `warehouse_accesses` table
- `Product` → `products` table
- `Supplier` → `suppliers` table
- `ProductSupplier` → `product_suppliers` table
- `Stock` → `stocks` table
- `StockMovement` → `stock_movements` table
- `StockTransfer` → `stock_transfers` table
- `PurchaseOrder` → `purchase_orders` table
- `PurchaseOrderItem` → `purchase_order_items` table
- `Activity` → `activities` table

### Additional Tables (Phase 3)
- `ChatConversation` → `chat_conversations` table
- `ChatMessage` → `chat_messages` table
- `ToolCall` → `tool_calls` table (new)

## Key Differences

### Query Syntax
```typescript
// Prisma
await prisma.user.findUnique({ where: { id: userId } });

// Drizzle
await db.select().from(users).where(eq(users.id, userId)).limit(1);
```

### Relations
```typescript
// Prisma - automatic relation loading
await prisma.user.findUnique({
  where: { id: userId },
  include: { activities: true }
});

// Drizzle - explicit joins
await db.select()
  .from(users)
  .leftJoin(activities, eq(activities.userId, users.id))
  .where(eq(users.id, userId));
```

### Transactions
```typescript
// Prisma
await prisma.$transaction([
  prisma.stock.update(...),
  prisma.stockMovement.create(...)
]);

// Drizzle
await db.transaction(async (tx) => {
  await tx.update(stocks)...
  await tx.insert(stockMovements)...
});
```

## Benefits of Drizzle

1. **Type Safety**: Full TypeScript inference without code generation
2. **Performance**: Direct SQL queries, no runtime overhead
3. **Simplicity**: Closer to SQL, easier to understand and debug
4. **Neon Integration**: Native support for Neon serverless PostgreSQL
5. **Migration Control**: SQL-based migrations for full control

## Running Migrations

To set up a fresh database:

```bash
cd backend

# Generate migration files from schema
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Seed test data
npm run db:seed
```

## Rollback Notes

If you need to rollback to Prisma:

1. Restore `backend/prisma/schema.prisma`
2. Reinstall Prisma dependencies
3. Run `npx prisma generate`
4. Update imports in service files

However, this is **not recommended** as the new architecture with Clerk and Vercel deployment is designed specifically for Drizzle.

## Testing

All service layer functions have been updated to use Drizzle:
- ✅ UserService - CRUD operations
- ✅ InventoryService - Product management
- ✅ StockService - Stock operations and transfers
- ✅ WarehouseService - Warehouse management
- ✅ ChatService - Conversation management
- ✅ InventoryIntelligence - AI tool functions

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Neon PostgreSQL](https://neon.tech/docs)
- [Clerk Authentication](https://clerk.dev/docs)
- [Vercel Deployment](https://vercel.com/docs)

## Support

For questions or issues related to this migration, please open an issue on GitHub.
