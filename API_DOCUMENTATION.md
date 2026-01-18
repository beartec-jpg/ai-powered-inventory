# API Endpoints Documentation

This document describes all the API endpoints implemented for the AI-powered inventory management system.

## Table of Contents
- [Authentication](#authentication)
- [Common Response Format](#common-response-format)
- [Endpoints](#endpoints)
  - [Catalogue Items](#catalogue-items)
  - [Stock Levels](#stock-levels)
  - [Stock Movements](#stock-movements)
  - [Suppliers](#suppliers)
  - [Purchase Orders](#purchase-orders)
  - [Locations](#locations)
  - [Activities](#activities)
  - [Database Test](#database-test)

---

## Authentication

All API endpoints (except `/api/test-db`) require authentication using Clerk.

**Headers Required:**
```
x-clerk-user-id: <clerk-user-id>
```

**Response for unauthenticated requests:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Authentication required. Please sign in.",
  "timestamp": "2026-01-18T08:00:00.000Z"
}
```

---

## Common Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2026-01-18T08:00:00.000Z"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 30,
    "total": 100,
    "totalPages": 4
  },
  "message": "Results retrieved successfully",
  "timestamp": "2026-01-18T08:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error message",
  "timestamp": "2026-01-18T08:00:00.000Z"
}
```

---

## Endpoints

### Catalogue Items

Manage product catalogue items.

#### `POST /api/catalogue/items`
Create a new catalogue item.

**Request Body:**
```json
{
  "partNumber": "M8-NUT-001",
  "name": "M8 Hex Nut",
  "description": "Stainless steel M8 hex nut",
  "manufacturer": "FastenerCo",
  "category": "Fasteners",
  "subcategory": "Nuts",
  "unitCost": 0.15,
  "markup": 35,
  "sellPrice": 0.20,
  "isStocked": true,
  "minQuantity": 100,
  "preferredSupplierName": "Acme Fasteners"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "1737188400000-abc123",
    "userId": "user_xxx",
    "partNumber": "M8-NUT-001",
    "name": "M8 Hex Nut",
    ...
  },
  "message": "Catalogue item created successfully"
}
```

#### `GET /api/catalogue/items`
List all catalogue items for the authenticated user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `perPage` (optional): Items per page (default: 30, max: 100)
- `search` (optional): Search term for name

**Response:** `200 OK`

#### `GET /api/catalogue/items?search={term}`
Search catalogue items by name.

**Response:** `200 OK`

---

### Stock Levels

Manage stock levels at different locations.

#### `POST /api/stock/levels`
Create or update stock level.

**Request Body:**
```json
{
  "catalogueItemId": "1737188400000-abc123",
  "partNumber": "M8-NUT-001",
  "name": "M8 Hex Nut",
  "location": "Bin 73",
  "quantity": 50,
  "action": "add"  // or "set"
}
```

**Response:** `201 Created` or `200 OK`

#### `GET /api/stock/levels`
List all stock levels.

**Query Parameters:**
- `page`, `perPage`: Pagination
- `location`: Filter by location
- `search`: Search by part number or name
- `low`: Set to "true" to get low stock items
- `id`: Get specific stock level by ID

**Response:** `200 OK`

#### `PUT /api/stock/levels`
Update stock level.

**Request Body:**
```json
{
  "id": "1737188400000-xyz789",
  "quantity": 75,
  "lastCountedAt": "2026-01-18T08:00:00.000Z"
}
```

#### `DELETE /api/stock/levels?id={id}`
Delete a stock level.

---

### Stock Movements

Track all stock movements (additions, removals, adjustments).

#### `POST /api/stock/movements`
Log a stock movement.

**Request Body:**
```json
{
  "productId": "1737188400000-abc123",
  "quantity": 50,
  "movementType": "INBOUND",  // INBOUND, OUTBOUND, ADJUSTMENT, RETURN, TRANSFER, DAMAGE, LOSS
  "reference": "PO-12345",
  "notes": "Received from supplier"
}
```

**Response:** `201 Created`

#### `GET /api/stock/movements`
List stock movements.

**Query Parameters:**
- `page`, `perPage`: Pagination
- `productId`: Filter by product
- `movementType`: Filter by movement type

**Response:** `200 OK` with paginated results

---

### Suppliers

Manage supplier information.

#### `POST /api/suppliers`
Create a new supplier.

**Request Body:**
```json
{
  "name": "Acme Fasteners",
  "email": "sales@acmefasteners.com",
  "phone": "+1-555-0123",
  "address": "123 Industrial Drive",
  "city": "Chicago",
  "country": "USA"
}
```

**Response:** `201 Created`

#### `GET /api/suppliers`
List all suppliers.

**Query Parameters:**
- `page`, `perPage`: Pagination
- `search`: Search by name, email, or city
- `id`: Get specific supplier by ID

**Response:** `200 OK`

#### `PUT /api/suppliers`
Update a supplier.

**Request Body:**
```json
{
  "id": "1737188400000-sup123",
  "name": "Acme Fasteners Inc.",
  "email": "info@acmefasteners.com",
  "active": true
}
```

**Response:** `200 OK`

---

### Purchase Orders

Manage purchase orders.

#### `POST /api/purchase-orders`
Create a new purchase order.

**Request Body:**
```json
{
  "supplierId": "1737188400000-sup123",
  "status": "DRAFT",  // DRAFT, SUBMITTED, CONFIRMED, RECEIVED, COMPLETED, CANCELLED
  "expectedDate": "2026-02-01T00:00:00.000Z",
  "notes": "Standard delivery",
  "poNumber": "PO-12345"  // Optional, auto-generated if not provided
}
```

**Response:** `201 Created`

#### `GET /api/purchase-orders`
List purchase orders.

**Query Parameters:**
- `page`, `perPage`: Pagination
- `status`: Filter by status
- `supplierId`: Filter by supplier
- `search`: Search by PO number
- `id`: Get specific PO by ID

**Response:** `200 OK`

#### `PUT /api/purchase-orders`
Update a purchase order.

**Request Body:**
```json
{
  "id": "1737188400000-po123",
  "status": "CONFIRMED",
  "receivedDate": "2026-01-20T00:00:00.000Z"
}
```

**Response:** `200 OK`

---

### Locations

Manage warehouse locations.

#### `POST /api/locations`
Create a new location.

**Request Body:**
```json
{
  "name": "Main Warehouse",
  "location": "123 Storage Lane, Chicago, IL",
  "capacity": 10000
}
```

**Response:** `201 Created`

#### `GET /api/locations`
List all locations.

**Query Parameters:**
- `page`, `perPage`: Pagination
- `search`: Search by name or location
- `id`: Get specific location by ID

**Response:** `200 OK`

#### `PUT /api/locations`
Update a location.

**Request Body:**
```json
{
  "id": "1737188400000-loc123",
  "name": "Main Warehouse A",
  "capacity": 12000,
  "active": true
}
```

**Response:** `200 OK`

---

### Activities

Audit logging for all system activities.

#### `POST /api/activities`
Log a new activity.

**Request Body:**
```json
{
  "userId": "user_legacy_id",  // Legacy users table ID
  "action": "CREATE",
  "entityType": "catalogue_item",
  "entityId": "1737188400000-abc123",
  "oldValue": null,
  "newValue": "{\"name\": \"M8 Hex Nut\"}",
  "details": "Created new catalogue item"
}
```

**Response:** `201 Created`

#### `GET /api/activities`
List activities (audit log).

**Query Parameters:**
- `page`, `perPage`: Pagination
- `entityType`: Filter by entity type
- `entityId`: Filter by entity ID

**Response:** `200 OK`

---

### Database Test

Test database connectivity.

#### `GET /api/test-db`
Verify database connection.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "message": "Database connection successful",
    "databaseUrl": "SET (hidden for security)",
    "testQueryResult": "Data found",
    "timestamp": "2026-01-18T08:00:00.000Z"
  },
  "message": "Database connection test successful"
}
```

---

## Error Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `404` - Not Found
- `405` - Method Not Allowed
- `409` - Conflict (duplicate entry)
- `500` - Internal Server Error
- `503` - Service Unavailable (database not configured)

---

## CORS Support

All endpoints support CORS with the following headers:
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Origin: *` (configurable via CORS_ORIGIN env var)
- `Access-Control-Allow-Methods: GET,OPTIONS,PATCH,DELETE,POST,PUT`

All endpoints support `OPTIONS` preflight requests.

---

## Rate Limiting

No rate limiting is currently implemented. Consider adding rate limiting in production.

---

## Examples

### Complete Flow: Add Item to Catalogue and Stock

1. **Create Catalogue Item**
```bash
curl -X POST https://your-domain.com/api/catalogue/items \
  -H "x-clerk-user-id: user_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "partNumber": "M8-NUT-001",
    "name": "M8 Hex Nut",
    "unitCost": 0.15,
    "minQuantity": 100
  }'
```

2. **Add Stock**
```bash
curl -X POST https://your-domain.com/api/stock/levels \
  -H "x-clerk-user-id: user_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "catalogueItemId": "returned-id-from-step-1",
    "partNumber": "M8-NUT-001",
    "name": "M8 Hex Nut",
    "location": "Bin 73",
    "quantity": 50
  }'
```

3. **Log Movement**
```bash
curl -X POST https://your-domain.com/api/stock/movements \
  -H "x-clerk-user-id: user_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "returned-id-from-step-1",
    "quantity": 50,
    "movementType": "INBOUND",
    "notes": "Initial stock"
  }'
```

---

## Support

For issues or questions, please refer to the main README.md or open an issue on GitHub.
