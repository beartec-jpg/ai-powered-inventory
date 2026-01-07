# Chat API Documentation

## Overview
The Chat API enables natural language interaction with the AI-Powered Inventory Management System using xAI's Grok model. Users can perform inventory operations through conversational commands.

## Base URL
```
http://localhost:3000/api/chat
```

## Authentication
All endpoints require authentication via headers:
- `x-user-id`: User ID
- `x-user-role`: User role (ADMIN, MANAGER, STAFF, VIEWER)
- `x-warehouse-access`: Comma-separated list of accessible warehouse IDs

## Rate Limiting
- **Limit**: 100 requests per hour per user
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Endpoints

### 1. Send Chat Message

Send a message and receive an AI response with optional tool execution.

**Endpoint**: `POST /api/chat`

**Request Body**:
```json
{
  "message": "What's the stock level of product ABC-123?",
  "conversationId": "optional-conversation-id"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "conversationId": "conv_xyz789",
    "message": {
      "id": "msg_abc123",
      "conversationId": "conv_xyz789",
      "role": "ASSISTANT",
      "content": "Product ABC-123 has 150 units in Warehouse A and 75 units in Warehouse B.",
      "createdAt": "2026-01-07T08:00:00.000Z"
    }
  }
}
```

### 2. Stream Chat Message

Send a message and receive streaming AI response.

**Endpoint**: `POST /api/chat/stream`

**Response**: Server-Sent Events (SSE) stream

### 3. Get Chat History

Retrieve user's conversation list.

**Endpoint**: `GET /api/chat/history`

### 4. Get Specific Conversation

**Endpoint**: `GET /api/chat/history/:conversationId`

### 5. Delete Conversation

**Endpoint**: `DELETE /api/chat/history/:conversationId`

## Available Tools

The AI assistant can execute the following inventory operations:

1. **check_stock** - Check stock levels for a product
2. **search_product** - Find products by name, SKU, or category
3. **transfer_stock** - Transfer inventory between warehouses
4. **adjust_stock** - Manually adjust stock quantities (Managers/Admins only)
5. **create_parts_list** - Create a parts list for a job
6. **get_low_stock_items** - Get items below reorder threshold
7. **warehouse_inventory_report** - Generate comprehensive warehouse report
8. **supplier_availability** - Check supplier information
9. **get_product_details** - Get full product information

## Security Considerations

1. **Authentication**: All requests require valid user credentials
2. **Authorization**: Tool execution respects role-based access control
3. **Rate Limiting**: Prevents abuse with per-user rate limits
4. **Warehouse Access**: Users can only access warehouses they have permission for
5. **Audit Logging**: All chat interactions are logged
