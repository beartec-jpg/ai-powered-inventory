# API Setup Guide

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.yourdomain.com`

## Authentication

Most endpoints require authentication using JWT tokens (to be implemented in Phase 5).

```http
Authorization: Bearer <your_jwt_token>
```

## Common Headers

```http
Content-Type: application/json
Accept: application/json
```

## Response Format

### Success Response

```json
{
  "status": "success",
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response

```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Error description",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## HTTP Status Codes

- `200 OK`: Successful GET/PUT/PATCH request
- `201 Created`: Successful POST request
- `204 No Content`: Successful DELETE request
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (duplicate)
- `500 Internal Server Error`: Server error

## Core Endpoints

### Health Check

#### Get API Health Status

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.67,
  "environment": "development"
}
```

#### Get Detailed Health Status

```http
GET /health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.67,
  "environment": "development",
  "checks": {
    "api": "operational",
    "memory": {
      "used": 50000000,
      "total": 100000000
    }
  }
}
```

### Products

#### List All Products

```http
GET /api/products
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `category` (optional): Filter by category
- `active` (optional): Filter by active status (true/false)
- `search` (optional): Search in name, SKU, or description

**Response:**
```json
{
  "status": "success",
  "data": {
    "products": [
      {
        "id": "clxxx",
        "sku": "PROD-001",
        "name": "Product Name",
        "description": "Product description",
        "category": "Electronics",
        "unitPrice": 99.99,
        "unit": "pcs",
        "active": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

#### Get Product by ID

```http
GET /api/products/:id
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "clxxx",
    "sku": "PROD-001",
    "name": "Product Name",
    "description": "Product description",
    "category": "Electronics",
    "unitPrice": 99.99,
    "unit": "pcs",
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "stocks": [
      {
        "warehouseId": "clyyy",
        "warehouseName": "Main Warehouse",
        "quantity": 100,
        "available": 90,
        "reserved": 10
      }
    ]
  }
}
```

#### Create Product

```http
POST /api/products
```

**Request Body:**
```json
{
  "sku": "PROD-001",
  "name": "Product Name",
  "description": "Product description",
  "category": "Electronics",
  "unitPrice": 99.99,
  "unit": "pcs"
}
```

**Response:** (201 Created)
```json
{
  "status": "success",
  "data": {
    "id": "clxxx",
    "sku": "PROD-001",
    "name": "Product Name",
    ...
  },
  "message": "Product created successfully"
}
```

#### Update Product

```http
PUT /api/products/:id
PATCH /api/products/:id
```

**Request Body:** (any fields to update)
```json
{
  "name": "Updated Product Name",
  "unitPrice": 89.99
}
```

**Response:**
```json
{
  "status": "success",
  "data": { ... },
  "message": "Product updated successfully"
}
```

#### Delete Product

```http
DELETE /api/products/:id
```

**Response:** (204 No Content)

### Warehouses

#### List All Warehouses

```http
GET /api/warehouses
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `active` (optional): Filter by active status

**Response:**
```json
{
  "status": "success",
  "data": {
    "warehouses": [
      {
        "id": "clyyy",
        "name": "Main Warehouse",
        "location": "New York, NY",
        "capacity": 10000,
        "active": true,
        "currentUtilization": 7500,
        "utilizationPercentage": 75
      }
    ]
  }
}
```

#### Create Warehouse

```http
POST /api/warehouses
```

**Request Body:**
```json
{
  "name": "Main Warehouse",
  "location": "New York, NY",
  "capacity": 10000
}
```

### Stock

#### Get Stock Levels

```http
GET /api/stock
```

**Query Parameters:**
- `warehouseId` (optional): Filter by warehouse
- `productId` (optional): Filter by product
- `lowStock` (optional): Show only low stock items (true/false)

**Response:**
```json
{
  "status": "success",
  "data": {
    "stocks": [
      {
        "id": "clzzz",
        "productId": "clxxx",
        "productName": "Product Name",
        "productSku": "PROD-001",
        "warehouseId": "clyyy",
        "warehouseName": "Main Warehouse",
        "quantity": 100,
        "reserved": 10,
        "available": 90,
        "reorderLevel": 20,
        "needsReorder": false,
        "lastCounted": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Update Stock

```http
POST /api/stock/movement
```

**Request Body:**
```json
{
  "productId": "clxxx",
  "warehouseId": "clyyy",
  "quantity": 50,
  "movementType": "INBOUND",
  "reference": "PO-001",
  "notes": "Received from supplier"
}
```

**Movement Types:**
- `INBOUND`: Purchase order received
- `OUTBOUND`: Sale or consumption
- `ADJUSTMENT`: Inventory adjustment
- `RETURN`: Customer return
- `TRANSFER`: Between warehouses
- `DAMAGE`: Damaged goods
- `LOSS`: Loss/theft

### Stock Transfers

#### Create Transfer

```http
POST /api/transfers
```

**Request Body:**
```json
{
  "fromWarehouseId": "clyyy",
  "toWarehouseId": "clzzz",
  "productId": "clxxx",
  "quantity": 50,
  "notes": "Transfer for new location"
}
```

#### Update Transfer Status

```http
PATCH /api/transfers/:id/status
```

**Request Body:**
```json
{
  "status": "IN_TRANSIT"
}
```

**Status Values:**
- `PENDING`: Transfer requested
- `IN_TRANSIT`: In transit
- `COMPLETED`: Transfer completed
- `CANCELLED`: Transfer cancelled

### Suppliers

#### List Suppliers

```http
GET /api/suppliers
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "suppliers": [
      {
        "id": "claaa",
        "name": "Supplier Name",
        "email": "supplier@example.com",
        "phone": "+1234567890",
        "address": "123 Main St",
        "city": "New York",
        "country": "USA",
        "active": true
      }
    ]
  }
}
```

### Purchase Orders

#### Create Purchase Order

```http
POST /api/purchase-orders
```

**Request Body:**
```json
{
  "supplierId": "claaa",
  "expectedDate": "2024-02-01",
  "items": [
    {
      "productId": "clxxx",
      "quantity": 100,
      "unitPrice": 49.99
    }
  ],
  "notes": "Urgent order"
}
```

#### Update Purchase Order Status

```http
PATCH /api/purchase-orders/:id/status
```

**Request Body:**
```json
{
  "status": "CONFIRMED"
}
```

**Status Values:**
- `DRAFT`: Being prepared
- `SUBMITTED`: Submitted to supplier
- `CONFIRMED`: Confirmed by supplier
- `RECEIVED`: Goods received
- `COMPLETED`: Order completed
- `CANCELLED`: Order cancelled

### Activity Logs

#### Get Activity Logs

```http
GET /api/activities
```

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `userId` (optional): Filter by user
- `entityType` (optional): Filter by entity type
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date

**Response:**
```json
{
  "status": "success",
  "data": {
    "activities": [
      {
        "id": "clbbb",
        "userId": "cluuu",
        "userName": "John Doe",
        "action": "CREATE",
        "entityType": "Product",
        "entityId": "clxxx",
        "details": "Created new product: PROD-001",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

## Pagination

All list endpoints support pagination with consistent parameters:

- `page`: Page number (default: 1, min: 1)
- `limit`: Items per page (default: 10, min: 1, max: 100)

**Example:**
```http
GET /api/products?page=2&limit=20
```

## Filtering & Searching

Use query parameters for filtering:

```http
GET /api/products?category=Electronics&active=true&search=laptop
```

## Sorting

Use `sortBy` and `order` query parameters:

```http
GET /api/products?sortBy=createdAt&order=desc
```

- `sortBy`: Field to sort by
- `order`: `asc` or `desc`

## Error Handling

All errors follow a consistent format:

```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Validation error: SKU already exists",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Window**: 15 minutes
- **Max Requests**: 100 per window
- **Headers**:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

## Testing the API

### Using cURL

```bash
# Health check
curl http://localhost:3000/health

# Get products
curl http://localhost:3000/api/products

# Create product
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "PROD-001",
    "name": "Test Product",
    "category": "Test",
    "unitPrice": 99.99,
    "unit": "pcs"
  }'
```

### Using Postman

1. Import the API collection (to be provided)
2. Set environment variables
3. Test endpoints

### Using Insomnia

1. Create new request collection
2. Add base URL: `http://localhost:3000`
3. Configure requests

## Development Notes

- API is currently in development
- Authentication endpoints will be added in Phase 5
- AI-powered endpoints will be added in Phase 3
- WebSocket support for real-time updates is planned

## Support

For API support and questions:
- GitHub Issues: https://github.com/beartec-jpg/ai-powered-inventory/issues
- Documentation: See `/docs` directory

---

Last Updated: 2024-01-07
