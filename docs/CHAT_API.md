# Chat API Documentation

## Overview

The Chat API enables natural language interaction with the AI-Powered Inventory Management System through xAI's Grok API. Users can perform complex inventory operations using conversational commands.

## Base URL

```
http://localhost:3000/api/chat
```

## Authentication

All chat endpoints require authentication. Include the authentication token in your requests:

```
Authorization: Bearer <your-token>
```

## Rate Limiting

- **Limit**: 100 requests per hour per user
- **Headers**: Rate limit information is returned in response headers

## Endpoints

### 1. Send Chat Message

Send a message and get an AI-generated response.

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
    "conversationId": "conv_123abc",
    "message": {
      "id": "msg_456def",
      "conversationId": "conv_123abc",
      "role": "ASSISTANT",
      "content": "Product ABC-123 has the following stock levels...",
      "createdAt": "2024-01-07T15:30:00.000Z"
    },
    "toolCalls": [
      {
        "id": "tool_789ghi",
        "messageId": "msg_456def",
        "toolName": "check_stock",
        "parameters": { "product_id": "ABC-123" },
        "result": { "stockLevels": [...] },
        "status": "SUCCESS",
        "createdAt": "2024-01-07T15:30:00.000Z"
      }
    ]
  }
}
```

### 2. Stream Chat Message

Send a message and receive streaming AI responses via Server-Sent Events (SSE).

**Endpoint**: `POST /api/chat/stream`

**Request Body**:
```json
{
  "message": "Generate a warehouse inventory report for warehouse A",
  "conversationId": "optional-conversation-id"
}
```

**Response Stream** (text/event-stream):

```
event: content
data: {"content":"I'll generate"}

event: content
data: {"content":" the inventory"}

event: tool_call
data: {"toolCalls":[{"id":"call_1","function":{"name":"warehouse_inventory_report"}}]}

event: tool_results
data: {"results":[{"success":true,"data":{...}}]}

event: content
data: {"content":"Here's the report..."}

event: done
data: {"conversationId":"conv_123abc"}
```

**Event Types**:
- `content`: Partial text content from the AI
- `tool_call`: AI is calling an inventory tool
- `tool_results`: Results from tool execution
- `done`: Stream completed successfully
- `error`: An error occurred

## Available Inventory Tools

The AI assistant can call the following 9 tools to perform inventory operations:

### 1. check_stock
Check real-time stock levels for a product

### 2. search_product
Find products by name, SKU, or category

### 3. transfer_stock
Execute inter-warehouse stock transfers

### 4. adjust_stock
Manual stock adjustments

### 5. create_parts_list
Create parts lists for jobs

### 6. get_low_stock_items
Get items below reorder threshold

### 7. warehouse_inventory_report
Comprehensive warehouse reports

### 8. supplier_availability
Get supplier information

### 9. get_product_details
Full product details with stock

For complete tool documentation, see the implementation guide.

## Support

For issues or questions:
- GitHub Issues: https://github.com/beartec-jpg/ai-powered-inventory/issues
