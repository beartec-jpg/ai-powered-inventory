# AI-Powered Inventory Management System 🚀

An intelligent inventory management system that uses natural language processing to execute operations through conversational commands. Built with modern technologies and BEAR TEC brand integration.

[![CI/CD Pipeline](https://github.com/beartec-jpg/ai-powered-inventory/actions/workflows/ci.yml/badge.svg)](https://github.com/beartec-jpg/ai-powered-inventory/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue)](https://www.typescriptlang.org/)

## 🌟 Features

- **Natural Language Interface**: Execute inventory operations using plain English commands
- **AI-Powered**: Leverages xAI's Grok for intelligent command interpretation
- **Multi-Warehouse Management**: Track inventory across multiple locations
- **Customer & Job Tracking**: Associate parts lists with specific projects and clients
- **Stock Queries**: Instant visibility into stock levels and locations
- **Audit Trail**: Complete command history and activity logging
- **Real-time Updates**: Live inventory updates and notifications
- **Responsive Design**: BEAR TEC branded UI with Tailwind CSS

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/beartec-jpg/ai-powered-inventory.git
cd ai-powered-inventory
```

### 2. Install Dependencies

```bash
# Install all dependencies (root, backend, and frontend)
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 3. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Set Up Database

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
cd ..
```

### 5. Start Development Servers

```bash
npm run dev  # Starts both backend and frontend
```

Visit http://localhost:5173 for the frontend and http://localhost:3000 for the backend API.

## 📁 Project Structure

```
ai-powered-inventory/
├── backend/           # Express.js backend with Prisma
├── frontend/          # React + Vite frontend
├── docs/              # Documentation
├── .github/           # GitHub workflows and templates
└── ...config files
```

## 💻 Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Made with ❤️ by the BEAR TEC team**
