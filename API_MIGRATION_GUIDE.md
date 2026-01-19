# API Migration Guide: Customers, Equipment, and Jobs

## Overview

This guide explains how to migrate from the current KV-based storage for Customers, Equipment, and Jobs to the new database-backed REST APIs with proper user scoping.

## What Changed

### Database Schema
- Created `customers` table with userId scoping
- Created `equipment` table with userId scoping and customer relationship
- Created `jobs` table with userId scoping and relationships
- Updated `suppliers` table to include userId field
- All tables use soft deletes (active boolean field)

### New API Endpoints

#### 1. Customers API (`/api/customers`)
- **GET** `/api/customers` - List all customers (paginated)
- **GET** `/api/customers?id={id}` - Get single customer
- **GET** `/api/customers?search={term}` - Search customers
- **POST** `/api/customers` - Create customer
- **PUT** `/api/customers` - Update customer
- **DELETE** `/api/customers?id={id}` - Soft delete customer

#### 2. Equipment API (`/api/equipment`)
- **GET** `/api/equipment` - List all equipment (paginated)
- **GET** `/api/equipment?id={id}` - Get single equipment
- **GET** `/api/equipment?search={term}` - Search equipment
- **GET** `/api/equipment?customerId={id}` - Filter by customer
- **POST** `/api/equipment` - Create equipment
- **PUT** `/api/equipment` - Update equipment
- **DELETE** `/api/equipment?id={id}` - Soft delete equipment

#### 3. Jobs API (`/api/jobs`)
- **GET** `/api/jobs` - List all jobs (paginated)
- **GET** `/api/jobs?id={id}` - Get single job
- **GET** `/api/jobs?search={term}` - Search jobs
- **GET** `/api/jobs?status={status}` - Filter by status
- **GET** `/api/jobs?customerId={id}` - Filter by customer
- **POST** `/api/jobs` - Create job
- **PUT** `/api/jobs` - Update job
- **DELETE** `/api/jobs?id={id}` - Soft delete job

#### 4. Updated Suppliers API (`/api/suppliers`)
- Now includes proper user scoping (all operations scoped to authenticated user)
- Consistent with other APIs

## Frontend Migration Steps

### Step 1: Update Data Fetching Hooks

Create new custom hooks similar to `useCatalogue` and `useStockLevels`:

```typescript
// hooks/useCustomersData.ts
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

export function useCustomers() {
  const { userId, getToken } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCustomers = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const token = await getToken();
      const response = await fetch('/api/customers', {
        headers: {
          'x-clerk-user-id': userId,
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch customers');
      
      const data = await response.json();
      setCustomers(data.data || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [userId]);

  return { customers, loading, error, refetch: fetchCustomers, setCustomers };
}

// Similar hooks for equipment and jobs
export function useEquipment() { /* ... */ }
export function useJobs() { /* ... */ }
```

### Step 2: Update Dashboard.tsx

Replace the KV storage hooks with the new database-backed hooks:

```typescript
// BEFORE (using KV storage):
const [customers, setCustomers] = useKV<Customer[]>(`${userPrefix}-customers`, []);
const [equipment, setEquipment] = useKV<Equipment[]>(`${userPrefix}-equipment`, []);
const [jobs, setJobs] = useKV<Job[]>(`${userPrefix}-jobs`, []);

// AFTER (using database APIs):
const { customers, loading: customersLoading, refetch: refetchCustomers, setCustomers } = useCustomers();
const { equipment, loading: equipmentLoading, refetch: refetchEquipment, setEquipment } = useEquipment();
const { jobs, loading: jobsLoading, refetch: refetchJobs, setJobs } = useJobs();
```

### Step 3: Update Command Executor

Update `src/lib/command-executor.ts` to use API calls instead of direct state updates:

```typescript
// BEFORE:
case 'create_customer': {
  const newCustomer = {
    id: generateId(),
    name: params.name,
    type: params.type,
    // ... other fields
    createdAt: Date.now()
  };
  setCustomers([...customers, newCustomer]);
  break;
}

// AFTER:
case 'create_customer': {
  try {
    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-clerk-user-id': userId,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: params.name,
        type: params.type,
        // ... other fields
      }),
    });
    
    if (!response.ok) throw new Error('Failed to create customer');
    
    const data = await response.json();
    await refetchCustomers(); // Refresh from database
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
  break;
}
```

### Step 4: Update Similar Operations

Apply the same pattern to all CRUD operations:
- **Create**: POST request + refetch
- **Update**: PUT request + refetch
- **Delete**: DELETE request + refetch
- **Read**: Use data from hooks (automatically fetched)

### Step 5: Data Migration (Optional)

If you have existing data in KV storage that needs to be migrated to the database:

```typescript
// Migration utility function
async function migrateKVDataToDatabase() {
  const userId = /* get current user ID */;
  const kvCustomers = /* read from KV */;
  
  for (const customer of kvCustomers) {
    try {
      await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clerk-user-id': userId,
        },
        body: JSON.stringify(customer),
      });
    } catch (error) {
      console.error('Failed to migrate customer:', customer.id, error);
    }
  }
}
```

## API Request/Response Examples

### Create Customer
```typescript
// Request
POST /api/customers
Headers: {
  'Content-Type': 'application/json',
  'x-clerk-user-id': 'user_xxx',
}
Body: {
  "name": "ABC Manufacturing",
  "type": "commercial",
  "email": "contact@abc.com",
  "phone": "+1234567890"
}

// Response (201 Created)
{
  "success": true,
  "data": {
    "id": "1234567890-abc123",
    "userId": "user_xxx",
    "name": "ABC Manufacturing",
    "type": "commercial",
    "email": "contact@abc.com",
    "phone": "+1234567890",
    "active": true,
    "createdAt": "2024-01-19T21:00:00.000Z",
    "updatedAt": "2024-01-19T21:00:00.000Z"
  },
  "message": "Customer created successfully",
  "timestamp": "2024-01-19T21:00:00.000Z"
}
```

### List Customers (Paginated)
```typescript
// Request
GET /api/customers?page=1&perPage=30

// Response (200 OK)
{
  "success": true,
  "data": [/* array of customers */],
  "pagination": {
    "page": 1,
    "perPage": 30,
    "total": 45,
    "totalPages": 2
  },
  "message": "Customers retrieved successfully",
  "timestamp": "2024-01-19T21:00:00.000Z"
}
```

### Search Equipment
```typescript
// Request
GET /api/equipment?search=boiler&customerId=123

// Response (200 OK)
{
  "success": true,
  "data": [/* filtered equipment items */],
  "message": "Found 3 equipment item(s)",
  "timestamp": "2024-01-19T21:00:00.000Z"
}
```

### Update Job
```typescript
// Request
PUT /api/jobs
Body: {
  "id": "job-123",
  "status": "completed",
  "completedAt": "2024-01-19T21:00:00.000Z",
  "workCarriedOut": "Annual service completed"
}

// Response (200 OK)
{
  "success": true,
  "data": {/* updated job object */},
  "message": "Job updated successfully",
  "timestamp": "2024-01-19T21:00:00.000Z"
}
```

## Error Handling

All APIs return consistent error responses:

```typescript
// 400 Bad Request
{
  "success": false,
  "error": "Bad Request",
  "message": "Missing required fields: name, type",
  "timestamp": "2024-01-19T21:00:00.000Z"
}

// 401 Unauthorized
{
  "success": false,
  "error": "Unauthorized",
  "message": "Authentication required. Please sign in.",
  "timestamp": "2024-01-19T21:00:00.000Z"
}

// 404 Not Found
{
  "success": false,
  "error": "Not Found",
  "message": "Customer not found",
  "timestamp": "2024-01-19T21:00:00.000Z"
}

// 409 Conflict
{
  "success": false,
  "error": "Conflict",
  "message": "Supplier with name \"XYZ\" already exists",
  "timestamp": "2024-01-19T21:00:00.000Z"
}
```

## User Scoping Details

All APIs automatically scope data by the authenticated user:
- Requests must include `x-clerk-user-id` header
- Users can only see/modify their own data
- Attempts to access other users' data return 404
- No cross-user data leakage

## Pagination

- Default: 30 items per page
- Maximum: 100 items per page
- Query parameters: `page` (default: 1), `perPage` (default: 30)
- Response includes pagination metadata

## Soft Deletes

All delete operations are soft deletes:
- Sets `active = false` instead of removing from database
- Deleted items can be filtered out in queries
- Can be restored by setting `active = true` via update

## Testing Checklist

- [ ] Test creating customers, equipment, jobs via new APIs
- [ ] Test listing with pagination
- [ ] Test search functionality
- [ ] Test filtering (by customer, status, etc.)
- [ ] Test updates
- [ ] Test soft deletes
- [ ] Verify user scoping (create separate test users)
- [ ] Verify data persistence across page reloads
- [ ] Test error handling for invalid inputs
- [ ] Test authentication failure scenarios

## Backward Compatibility

During migration, you can run both systems in parallel:
1. Keep KV storage as fallback
2. Try API first, fall back to KV if it fails
3. Once confident, remove KV storage code

## Database Migration

Run the following command to apply database schema changes:

```bash
# If DATABASE_URL is set
npm run db:push

# Or manually with Drizzle
npx drizzle-kit push
```

## Support and Questions

For issues or questions about the migration, please:
1. Check API responses for error details
2. Review browser network tab for request/response
3. Check server logs for backend errors
4. Open an issue with reproduction steps if needed
