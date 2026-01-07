# Phase 3 Implementation Guide - xAI Grok API Integration

## Overview

This guide documents the complete implementation of xAI's Grok API integration for natural language inventory management.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Frontend  │─────▶│  Chat Routes │─────▶│   Chat Service  │
│   (React)   │◀─────│   (Express)  │◀─────│  (Orchestrator) │
└─────────────┘      └──────────────┘      └─────────────────┘
                            │                        │
                            │                        ├──▶ xAI Service
                            │                        ├──▶ Chat Memory
                            │                        ├──▶ Tool Executor
                            │                        └──▶ Chat Logger
                            ▼
                    ┌──────────────┐
                    │   Database   │
                    │  (Postgres)  │
                    └──────────────┘
```

## Backend Components

### 1. xAI Service (`backend/src/services/xaiService.ts`)
- OpenAI SDK client configured for xAI Grok API
- Streaming and non-streaming chat completions
- Token usage estimation
- Error handling

**Key Methods**:
- `createChatCompletion()` - Non-streaming responses
- `createStreamingChatCompletion()` - SSE streaming
- `validateMessages()` - Message format validation
- `estimateTokens()` - Token counting

### 2. Tool Definitions (`backend/src/utils/xaiTools.ts`)
9 inventory tools with JSON schemas:
- check_stock
- search_product
- transfer_stock
- adjust_stock
- create_parts_list
- get_low_stock_items
- warehouse_inventory_report
- supplier_availability
- get_product_details

### 3. Inventory Intelligence (`backend/src/services/inventoryIntelligence.ts`)
Implements all 9 inventory operations with:
- Database queries using Drizzle ORM
- Validation and error handling
- Structured result formatting

### 4. Chat Service (`backend/src/services/chatService.ts`)
Main orchestration:
- `processMessage()` - Regular message processing
- `processMessageStreaming()` - Streaming responses
- Tool call execution coordination
- Message history management

### 5. Chat Memory (`backend/src/services/chatMemory.ts`)
- Conversation persistence
- Context window management
- User permission tracking
- Message history retrieval

### 6. Tool Executor (`backend/src/services/toolExecutor.ts`)
- Tool execution with authorization
- Parameter validation
- Warehouse access control
- Role-based permissions

### 7. Chat Logger (`backend/src/services/chatLogger.ts`)
- Audit trail for interactions
- Tool execution logging
- Performance metrics tracking

### 8. Chat Auth Middleware (`backend/src/middleware/chatAuth.ts`)
- User authentication and context extraction
- Rate limiting (100 req/hour)
- Permission checks
- xAI availability check

### 9. Chat Routes (`backend/src/routes/chat.ts`)
Endpoints:
- `POST /api/chat` - Send message
- `POST /api/chat/stream` - Streaming responses
- `GET /api/chat/history` - Get conversations
- `GET /api/chat/history/:id` - Get specific conversation
- `DELETE /api/chat/history/:id` - Delete conversation
- `GET /api/chat/metrics` - Performance metrics (admin)

### 10. Configuration (`backend/src/config/xaiConfig.ts`)
Environment-based settings:
- xAI API configuration
- Chat context limits
- Rate limiting settings
- Message retention policies

## Database Schema

### ChatConversation
```typescript
{
  id: string (PK)
  userId: string (FK → users)
  title: string
  active: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

### ChatMessage
```typescript
{
  id: string (PK)
  conversationId: string (FK → chat_conversations)
  role: 'user' | 'assistant' | 'system'
  content: text
  toolCalls: text (JSON)
  createdAt: timestamp
}
```

### ToolCall
```typescript
{
  id: string (PK)
  messageId: string (FK → chat_messages)
  toolName: string
  arguments: text (JSON)
  result: text (JSON)
  status: 'pending' | 'success' | 'error'
  createdAt: timestamp
}
```

## Frontend Components

### 1. Chat Interface (`frontend/src/components/ChatInterface.tsx`)
- Message display with markdown rendering
- Loading states and typing indicators
- Error message display
- Quick action buttons

### 2. Chat Page (`frontend/src/pages/Chat.tsx`)
- Main chat layout with sidebar
- Conversation history
- Conversation management
- Delete functionality

### 3. useChat Hook (`frontend/src/hooks/useChat.ts`)
- Message state management
- Conversation loading
- Streaming support
- Error handling

### 4. Chat API Service (`frontend/src/services/chatAPI.ts`)
- HTTP client for chat endpoints
- SSE streaming support
- Retry logic with exponential backoff

## Environment Configuration

### Backend (.env)
```bash
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h

# xAI Configuration
XAI_API_KEY=your-xai-api-key
XAI_MODEL=grok-beta
XAI_ENDPOINT=https://api.x.ai/v1
XAI_MAX_TOKENS=4096
XAI_TEMPERATURE=0.7

# Chat Settings
CHAT_RATE_LIMIT_PER_HOUR=100
MAX_CHAT_CONTEXT_LENGTH=20
CHAT_MESSAGE_RETENTION_DAYS=90

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Frontend (.env)
```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## Security Features

### Role-Based Access Control
- **VIEWER**: Read-only operations
- **STAFF**: Read + transfer + adjust + parts lists
- **MANAGER**: Staff + all warehouse operations
- **ADMIN**: Full access + metrics + user management

### Warehouse Permissions
- User-specific warehouse access control
- Validated on each tool execution
- Prevents unauthorized warehouse operations

### Rate Limiting
- 100 requests per hour per user
- Prevents API abuse
- Customizable per environment

### Audit Logging
- All chat interactions logged
- Tool executions tracked
- Performance metrics collected

## Development Setup

### Prerequisites
```bash
Node.js >= 18.0.0
PostgreSQL >= 14
npm >= 9.0.0
```

### Installation
```bash
# Clone repository
git clone https://github.com/beartec-jpg/ai-powered-inventory.git
cd ai-powered-inventory

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Database Setup
```bash
cd backend

# Generate Drizzle schema
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### Running Development Servers
```bash
# Backend (port 3000)
cd backend
npm run dev

# Frontend (port 5173)
cd frontend
npm run dev
```

## Production Deployment

### Build
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

### Environment Variables
Ensure all required environment variables are set in production:
- `XAI_API_KEY` - Required for AI functionality
- `DATABASE_URL` - Production database connection
- `JWT_SECRET` - Secure random string
- `CORS_ORIGIN` - Frontend production URL

### Database Migrations
```bash
cd backend
npm run db:migrate
```

### Start Production Server
```bash
cd backend
npm start
```

## Troubleshooting

### xAI API Not Available
**Symptom**: "xAI service is not configured"
**Solution**: Set `XAI_API_KEY` environment variable

### Rate Limit Exceeded
**Symptom**: 429 Too Many Requests
**Solution**: Adjust `CHAT_RATE_LIMIT_PER_HOUR` or implement backoff

### Database Connection Errors
**Symptom**: Cannot connect to database
**Solution**: Verify `DATABASE_URL` and database is running

### Streaming Not Working
**Symptom**: SSE events not received
**Solution**: 
- Check CORS settings
- Verify nginx/proxy isn't buffering
- Ensure `X-Accel-Buffering: no` header is set

## Testing

### Manual Testing
```bash
# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message":"What is the stock level?"}'

# Test streaming endpoint
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message":"Generate inventory report"}'
```

## Performance Optimization

### Recommendations
1. Enable database connection pooling
2. Implement response caching for repeated queries
3. Use CDN for frontend assets
4. Enable gzip compression
5. Implement request debouncing on frontend
6. Consider Redis for rate limiting in production

## Future Enhancements

- [ ] Voice input support
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Custom tool creation UI
- [ ] Integration with external systems
- [ ] Mobile app support

## Support

For issues or questions:
- GitHub Issues: https://github.com/beartec-jpg/ai-powered-inventory/issues
- API Documentation: See docs/CHAT_API.md
