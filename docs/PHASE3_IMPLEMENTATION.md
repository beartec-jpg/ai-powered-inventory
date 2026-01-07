# Phase 3: xAI Integration & Chat Intelligence

This document describes the Phase 3 implementation of the AI-Powered Inventory Management System, which adds natural language interaction capabilities using xAI's Grok API.

## Overview

Phase 3 introduces an AI-powered chat interface that allows users to interact with the inventory system using natural language. Users can perform complex operations like stock transfers, inventory queries, and report generation through conversational commands.

## Architecture

### Backend Components

#### 1. xAI Service Layer (`backend/src/services/xaiService.ts`)
- **Purpose**: Communication with xAI Grok API
- **Features**: 
  - Streaming and non-streaming chat completions
  - Token usage estimation
  - Error handling and retries
  - Message validation

#### 2. Tool Definitions (`backend/src/utils/xaiTools.ts`)
- **Purpose**: Define available inventory operations for Grok
- **Tools**: 9 inventory operations with JSON schemas
- **Validation**: Parameter validation and tool discovery

#### 3. Inventory Intelligence (`backend/src/services/inventoryIntelligence.ts`)
- **Purpose**: Execute inventory operations
- **Operations**:
  - `check_stock`: Query stock levels across warehouses
  - `search_product`: Find products with fuzzy matching
  - `transfer_stock`: Move inventory between warehouses
  - `adjust_stock`: Manual inventory adjustments
  - `create_parts_list`: Generate job parts lists
  - `get_low_stock_items`: Identify low stock items
  - `warehouse_inventory_report`: Generate warehouse reports
  - `supplier_availability`: Check supplier information
  - `get_product_details`: Retrieve product information

#### 4. Chat Service (`backend/src/services/chatService.ts`)
- **Purpose**: Main chat processing logic
- **Features**:
  - Message processing with context
  - Tool execution orchestration
  - Streaming support
  - Conversation management

#### 5. Chat Memory (`backend/src/services/chatMemory.ts`)
- **Purpose**: Conversation history management
- **Features**:
  - Conversation persistence
  - Context window management
  - User permission tracking
  - History cleanup

#### 6. Tool Executor (`backend/src/services/toolExecutor.ts`)
- **Purpose**: Execute tools with authorization
- **Features**:
  - Permission checking
  - Parameter validation
  - Warehouse access control
  - Error handling

### Frontend Components

#### 1. Chat Interface (`frontend/src/components/ChatInterface.tsx`)
- **Purpose**: Main chat UI component
- **Features**:
  - Message display with markdown
  - Loading states
  - Error handling
  - Quick actions

#### 2. Chat Page (`frontend/src/pages/Chat.tsx`)
- **Purpose**: Complete chat page with sidebar
- **Features**:
  - Conversation history
  - Sidebar management
  - Conversation selection
  - Delete functionality

#### 3. useChat Hook (`frontend/src/hooks/useChat.ts`)
- **Purpose**: Chat state management
- **Features**:
  - Message state
  - Conversation loading
  - Streaming support
  - Error handling

#### 4. Chat API Client (`frontend/src/services/chatAPI.ts`)
- **Purpose**: Backend API communication
- **Features**:
  - HTTP requests
  - SSE streaming
  - Retry logic
  - Error handling

## Database Schema

### New Models

#### ChatConversation
```prisma
model ChatConversation {
  id        String   @id @default(cuid())
  userId    String
  title     String?
  active    Boolean  @default(true)
  metadata  Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user     User          @relation(...)
  messages ChatMessage[]
}
```

#### ChatMessage
```prisma
model ChatMessage {
  id             String      @id @default(cuid())
  conversationId String
  role           MessageRole
  content        String      @db.Text
  metadata       Json?
  createdAt      DateTime    @default(now())
  
  conversation ChatConversation @relation(...)
  toolCalls    ToolCall[]
}
```

#### ToolCall
```prisma
model ToolCall {
  id         String         @id @default(cuid())
  messageId  String
  toolName   String
  parameters Json
  result     Json?
  status     ToolCallStatus @default(PENDING)
  error      String?
  executedAt DateTime?
  createdAt  DateTime       @default(now())
  
  message ChatMessage @relation(...)
}
```

## Security

### Authentication & Authorization
- **Middleware**: `backend/src/middleware/chatAuth.ts`
- **Features**:
  - User authentication via headers (mock for development)
  - Role-based access control (ADMIN, MANAGER, STAFF, VIEWER)
  - Warehouse-level access restrictions
  - Rate limiting (100 requests/hour per user)

### Permission Matrix

| Role    | Read Stock | Transfer | Adjust | Create Parts List |
|---------|-----------|----------|--------|------------------|
| VIEWER  | ✅        | ❌       | ❌     | ❌               |
| STAFF   | ✅        | ✅       | ❌     | ✅               |
| MANAGER | ✅        | ✅       | ✅     | ✅               |
| ADMIN   | ✅        | ✅       | ✅     | ✅               |

### Audit Logging
- **Service**: `backend/src/services/chatLogger.ts`
- **Tracks**:
  - All chat interactions
  - Tool executions
  - AI decisions
  - Performance metrics

## API Endpoints

### POST /api/chat
Send a chat message and receive AI response.

**Request:**
```json
{
  "message": "What's the stock level of product ABC-123?",
  "conversationId": "optional-conversation-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": "conv_xyz789",
    "message": {
      "id": "msg_abc123",
      "role": "ASSISTANT",
      "content": "Product ABC-123 has 150 units...",
      "createdAt": "2026-01-07T08:00:00.000Z"
    }
  }
}
```

### POST /api/chat/stream
Stream chat messages using Server-Sent Events.

### GET /api/chat/history
Get user's conversation list.

### GET /api/chat/history/:conversationId
Get specific conversation with all messages.

### DELETE /api/chat/history/:conversationId
Delete a conversation.

### GET /api/chat/metrics
Get chat performance metrics (admin only).

See [CHAT_API.md](./CHAT_API.md) for detailed API documentation.

## Configuration

### Backend Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/inventory_db"

# xAI Configuration
XAI_API_KEY=your-xai-api-key-here
XAI_MODEL=grok-beta
XAI_API_BASE_URL=https://api.x.ai/v1
XAI_MAX_TOKENS=4096
XAI_TEMPERATURE=0.7

# Chat Configuration
CHAT_MESSAGE_RETENTION_DAYS=90
MAX_CHAT_CONTEXT_LENGTH=20
CHAT_RATE_LIMIT_PER_HOUR=100
```

### Frontend Environment Variables
```bash
# API Base URL
VITE_API_BASE_URL=http://localhost:3000

# Feature Flags
VITE_ENABLE_CHAT=true
VITE_ENABLE_STREAMING=true
```

## Development Setup

### Backend
```bash
cd backend
npm install
npm run prisma:generate
npm run build
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Testing

### Manual Testing
1. Start backend server
2. Start frontend dev server
3. Open browser to http://localhost:5173
4. Try example commands:
   - "What's the stock level?"
   - "Show me low stock items"
   - "Transfer 50 units of product X from warehouse A to warehouse B"

### Testing with Mock Data
The system includes mock authentication headers for development. In production, these should be replaced with proper JWT authentication.

## Production Deployment

### Prerequisites
1. PostgreSQL database configured
2. xAI API key obtained
3. Environment variables set

### Steps
1. Run database migrations: `npm run prisma:migrate:prod`
2. Build backend: `npm run build`
3. Build frontend: `npm run build`
4. Start backend: `npm start`
5. Serve frontend build artifacts

### Security Checklist
- [ ] Replace mock authentication with JWT
- [ ] Configure CORS properly
- [ ] Set up SSL/TLS
- [ ] Enable rate limiting
- [ ] Configure database connection pooling
- [ ] Set up monitoring and logging
- [ ] Implement proper error handling
- [ ] Enable audit logging
- [ ] Review and restrict API endpoints

## Known Limitations

1. **Streaming Tool Execution**: Tool execution in streaming mode is simplified. Clients should use non-streaming mode for tool-based operations.
2. **Authentication**: Current implementation uses mock headers for development. Production requires JWT authentication.
3. **Database Migrations**: Migrations must be run manually before deployment.

## Future Enhancements

1. **Full Streaming Support**: Complete tool execution in streaming mode
2. **WebSocket Support**: Alternative to SSE for real-time communication
3. **Multi-language Support**: i18n for chat interface
4. **Voice Input**: Speech-to-text integration
5. **Advanced Analytics**: Chat usage analytics and insights
6. **Custom Tools**: Allow admins to define custom inventory operations
7. **Context Improvement**: Enhanced conversation context management
8. **Batch Operations**: Support for bulk inventory operations

## Troubleshooting

### Backend Issues
- **"XAI_API_KEY is not configured"**: Set XAI_API_KEY in .env file
- **Database connection errors**: Check DATABASE_URL configuration
- **TypeScript compilation errors**: Run `npm run build` to see detailed errors

### Frontend Issues
- **API connection errors**: Verify VITE_API_BASE_URL points to backend
- **Build failures**: Check TypeScript configuration and dependencies

### Chat Issues
- **No response from AI**: Check xAI API key and network connectivity
- **Tool execution failures**: Verify user permissions and warehouse access
- **Rate limit errors**: Wait or increase rate limit configuration

## Support

For issues or questions:
1. Check the [CHAT_API.md](./CHAT_API.md) documentation
2. Review the code comments in source files
3. Check the console logs for error messages
4. Verify environment variables are correctly set

## License

MIT License - See LICENSE file for details
