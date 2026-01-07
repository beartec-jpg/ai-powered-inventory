# AI-Powered Inventory Management System

An intelligent stock management system that uses natural language processing to execute inventory operations. Built with Drizzle ORM, Clerk Authentication, and designed for deployment on Vercel + Neon PostgreSQL.

## 🚀 Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **Authentication**: Clerk
- **Deployment**: Vercel Serverless

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Authentication**: Clerk React
- **Deployment**: Vercel

## ✨ Features

- **Natural Language Interface**: AI-powered commands for inventory operations
- **Multi-Warehouse Support**: Manage inventory across multiple locations
- **Real-time Stock Tracking**: Track quantities, transfers, and movements
- **Supplier Management**: Manage products and purchase orders
- **AI Assistant**: xAI-powered chat for intelligent inventory queries
- **Role-Based Access**: Admin, Manager, Staff, and Viewer roles
- **Audit Trail**: Complete activity logging

## 📦 Project Structure

```
ai-powered-inventory/
├── backend/              # Express backend with Drizzle ORM
│   ├── src/
│   │   ├── db/          # Database schema and migrations
│   │   ├── services/    # Business logic layer
│   │   ├── middleware/  # Clerk auth, logging
│   │   └── routes/      # API endpoints
│   └── drizzle.config.ts
├── frontend/            # React frontend
│   └── src/
├── vercel.json          # Vercel deployment config
└── .env.example         # Environment variables template
```

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon recommended)
- Clerk account for authentication

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   npm install
   ```

2. Configure environment:
   ```bash
   cp ../.env.example .env
   # Edit .env with your credentials
   ```

3. Setup database:
   ```bash
   npm run db:generate    # Generate migrations
   npm run db:migrate     # Run migrations
   npm run db:seed        # Seed test data (optional)
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   # Edit with your Clerk publishable key
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

## 🔐 Authentication

This project uses Clerk for authentication. You'll need to:

1. Create a Clerk account at https://clerk.dev
2. Create a new application
3. Get your API keys from the Clerk dashboard
4. Add them to your `.env` files

## 📊 Database Schema

The system includes 14 tables covering:
- User management and authentication
- Warehouse and location tracking
- Product catalog and suppliers
- Stock levels and movements
- Purchase orders and transfers
- AI chat conversations
- Activity audit logs

See `backend/src/db/schema.ts` for the complete schema definition.

## 🚀 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import the repository in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy!

The `vercel.json` configuration handles both frontend and backend deployment.

## 📝 Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://...          # Neon PostgreSQL
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
PORT=3000
NODE_ENV=development
```

### Frontend (.env.local)
```env
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## 🔧 Available Scripts

### Backend
- `npm run dev` - Development server
- `npm run build` - Build for production
- `npm run type-check` - TypeScript validation
- `npm run db:generate` - Generate migrations
- `npm run db:migrate` - Run migrations
- `npm run db:seed` - Seed database

### Frontend
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run preview` - Preview production build

## 📖 API Documentation

### Health Endpoints
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system info

### Protected Endpoints (Require Authentication)
- Product CRUD operations
- Warehouse management
- Stock operations and transfers
- AI chat interface

## 🔀 Git Branch Management

### How to Delete a Branch

#### Delete Local Branch
To delete a local branch that you no longer need:

```bash
# Make sure you're not on the branch you want to delete
git checkout main  # or any other branch

# Delete the branch
git branch -d branch-name    # Safe delete (only if merged)
git branch -D branch-name    # Force delete (even if not merged)
```

#### Delete Remote Branch
To delete a branch from the remote repository (GitHub):

```bash
# Delete remote branch using git
git push origin --delete branch-name

# Alternative syntax
git push origin :branch-name
```

#### Delete Both Local and Remote
To delete a branch completely from both local and remote:

```bash
# Delete local branch
git branch -d branch-name

# Delete remote branch
git push origin --delete branch-name
```

#### Using GitHub Web UI
You can also delete branches directly on GitHub:

1. Go to your repository on GitHub
2. Click on the "branches" link (usually shows "X branches")
3. Find the branch you want to delete
4. Click the trash/delete icon next to the branch name
5. Confirm the deletion

**Note**: You cannot delete the default branch (usually `main` or `master`) or a branch that you're currently on.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Drizzle ORM](https://orm.drizzle.team/)
- Authentication by [Clerk](https://clerk.dev/)
- Hosted on [Vercel](https://vercel.com/)
- Database by [Neon](https://neon.tech/)
