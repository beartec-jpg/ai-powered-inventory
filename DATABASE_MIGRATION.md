# Database Migration Guide

## Overview

This guide explains how to set up and migrate the AI-powered inventory system to use persistent database storage with Drizzle ORM and Neon PostgreSQL.

## Current State

The system uses:
- **Client-side**: In-memory React state (lost on page reload)
- **Server-side**: No persistent storage (serverless functions don't persist data)
- **Fallback**: localStorage for client-side persistence

## Target State

- **Database**: Neon PostgreSQL with Drizzle ORM
- **Tables**: `catalogue_items` and `stock_levels`
- **Fallback**: localStorage remains as client-side backup

## Prerequisites

1. **Neon PostgreSQL Account**
   - Sign up at https://neon.tech/
   - Create a new project
   - Get your connection string

2. **Environment Variables**
   ```bash
   DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"
   ```

## Migration Steps

### Step 1: Set Up Database Connection

1. Copy your Neon connection string
2. Add to `.env` file:
   ```
   DATABASE_URL="postgresql://your-connection-string"
   ```
3. Deploy to Vercel:
   ```bash
   vercel env add DATABASE_URL
   # Paste your connection string when prompted
   ```

### Step 2: Run Database Migrations

The schema is already defined in `api/lib/schema.ts`. Run the migration to create tables:

```bash
# Install Drizzle Kit if not already installed
npm install -D drizzle-kit

# Generate migration
npx drizzle-kit generate:pg

# Push schema to database
npx drizzle-kit push:pg
```

Alternatively, you can run the SQL directly in your Neon dashboard:

```sql
-- Create catalogue_items table
CREATE TABLE IF NOT EXISTS catalogue_items (
  id TEXT PRIMARY KEY NOT NULL,
  part_number VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  manufacturer VARCHAR(255),
  category VARCHAR(100),
  subcategory VARCHAR(100),
  unit_cost REAL,
  markup REAL,
  sell_price REAL,
  is_stocked BOOLEAN DEFAULT FALSE NOT NULL,
  min_quantity INTEGER,
  preferred_supplier_name VARCHAR(255),
  attributes TEXT,
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX catalogue_items_part_number_idx ON catalogue_items(part_number);
CREATE INDEX catalogue_items_category_idx ON catalogue_items(category);
CREATE INDEX catalogue_items_manufacturer_idx ON catalogue_items(manufacturer);

-- Create stock_levels table
CREATE TABLE IF NOT EXISTS stock_levels (
  id TEXT PRIMARY KEY NOT NULL,
  catalogue_item_id TEXT NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
  part_number VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  quantity INTEGER DEFAULT 0 NOT NULL,
  last_movement_at TIMESTAMP,
  last_counted_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX stock_levels_catalogue_item_location_idx ON stock_levels(catalogue_item_id, location);
CREATE INDEX stock_levels_location_idx ON stock_levels(location);
CREATE INDEX stock_levels_part_number_idx ON stock_levels(part_number);
```

### Step 3: Verify API Endpoints

Test the new API endpoints:

```bash
# List catalogue items
curl http://localhost:5173/api/inventory/catalogue

# Create catalogue item
curl -X POST http://localhost:5173/api/inventory/catalogue \
  -H "Content-Type: application/json" \
  -d '{
    "partNumber": "TEST-001",
    "name": "Test Item",
    "unitCost": 10.00,
    "markup": 35
  }'

# Search catalogue
curl http://localhost:5173/api/inventory/catalogue?search=test

# List stock levels
curl http://localhost:5173/api/stock/levels

# Add stock
curl -X POST http://localhost:5173/api/stock/levels \
  -H "Content-Type: application/json" \
  -d '{
    "catalogueItemId": "item-id",
    "partNumber": "TEST-001",
    "location": "Warehouse A",
    "quantity": 100
  }'
```

### Step 4: Deploy to Production

```bash
# Deploy to Vercel
vercel --prod

# Verify DATABASE_URL is set
vercel env ls
```

## Fallback Behavior

### Without DATABASE_URL

If `DATABASE_URL` is not configured:
- API endpoints return HTTP 503 with error message
- Client-side uses localStorage (`useLocalCatalogue` hook)
- Data persists in browser only
- Data lost when localStorage is cleared

### With DATABASE_URL

- API endpoints use Neon PostgreSQL database
- Data persists across all sessions and devices
- Full ACID transaction support
- Automatic backups via Neon

## Data Migration

To migrate existing localStorage data to database:

```javascript
// Run this in browser console on the app
async function migrateLocalStorageToDatabase() {
  const catalogue = JSON.parse(localStorage.getItem('ai-inventory-catalogue') || '[]');
  
  for (const item of catalogue) {
    await fetch('/api/inventory/catalogue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
  }
  
  console.log(`Migrated ${catalogue.length} items to database`);
}

migrateLocalStorageToDatabase();
```

## Troubleshooting

### Error: "DATABASE_URL environment variable is not set"

**Solution**: Set the DATABASE_URL environment variable in your `.env` file and restart the development server.

### Error: "relation 'catalogue_items' does not exist"

**Solution**: Run the database migrations (Step 2).

### Error: "Connection timeout"

**Solution**: Check your Neon connection string and ensure your IP is allowed in Neon's firewall settings.

### Data not persisting

**Solution**: 
1. Check that DATABASE_URL is set correctly
2. Verify tables exist in database
3. Check browser console for API errors
4. Verify API endpoints return 200 status codes

## Best Practices

1. **Always backup before migration**
   - Export localStorage data before clearing
   - Take Neon database snapshot

2. **Test in development first**
   - Set up staging environment
   - Run all tests
   - Verify data integrity

3. **Monitor after deployment**
   - Check Neon dashboard for query performance
   - Monitor API response times
   - Watch for error logs

4. **Keep fallback enabled**
   - Don't remove localStorage persistence
   - Provides offline capability
   - Acts as backup during outages

## Support

- **Neon Documentation**: https://neon.tech/docs
- **Drizzle ORM Docs**: https://orm.drizzle.team/
- **Project Issues**: GitHub repository issues page
