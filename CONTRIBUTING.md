# Contributing to AI-Powered Inventory Management System

Thank you for your interest in contributing to the AI-Powered Inventory Management System! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Message Standards](#commit-message-standards)
- [Pull Request Process](#pull-request-process)
- [Code Quality Standards](#code-quality-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: v14 or higher
- **Git**: Latest version

### Local Setup Instructions

1. **Clone the repository**

   ```bash
   git clone https://github.com/beartec-jpg/ai-powered-inventory.git
   cd ai-powered-inventory
   ```

2. **Install dependencies**

   This is a monorepo with separate backend and frontend workspaces:

   ```bash
   # Install root dependencies
   npm install

   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install

   # Return to root
   cd ..
   ```

3. **Set up environment variables**

   ```bash
   # Copy the example environment file
   cp .env.example .env

   # Edit .env with your local configuration
   # Ensure you set DATABASE_URL with your PostgreSQL credentials
   ```

4. **Set up the database**

   ```bash
   # Navigate to backend
   cd backend

   # Generate Prisma client
   npm run prisma:generate

   # Run database migrations
   npm run prisma:migrate

   # Seed the database (optional)
   npm run prisma:seed

   # Return to root
   cd ..
   ```

5. **Start development servers**

   ```bash
   # Terminal 1 - Start backend server
   cd backend
   npm run dev

   # Terminal 2 - Start frontend server
   cd frontend
   npm run dev
   ```

6. **Verify installation**

   - Backend API: http://localhost:3000/health
   - Frontend: http://localhost:5173

## Branch Naming Conventions

We follow a structured branch naming convention to keep the repository organized:

### Format

```
<type>/<short-description>
```

### Types

- `feature/` - New features or enhancements
- `fix/` - Bug fixes
- `hotfix/` - Critical production fixes
- `refactor/` - Code refactoring without functionality changes
- `docs/` - Documentation updates
- `test/` - Adding or updating tests
- `chore/` - Maintenance tasks, dependency updates
- `perf/` - Performance improvements

### Examples

```
feature/ai-powered-search
fix/inventory-count-error
refactor/database-queries
docs/api-documentation
test/user-authentication
chore/update-dependencies
```

## Commit Message Standards

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

### Examples

```
feat(inventory): add AI-powered search functionality

fix(auth): resolve JWT token expiration issue

docs(api): update API endpoint documentation

refactor(database): optimize query performance

test(inventory): add unit tests for stock movement
```

### Rules

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Keep subject line under 72 characters
- Capitalize the subject line
- Don't end subject line with a period
- Separate subject from body with a blank line
- Wrap body at 72 characters
- Use body to explain what and why, not how

## Pull Request Process

### Before Creating a PR

1. **Ensure your branch is up to date**

   ```bash
   git checkout main
   git pull origin main
   git checkout your-feature-branch
   git rebase main
   ```

2. **Run all checks**

   ```bash
   # Lint code
   npm run lint

   # Format code
   npm run format

   # Type check
   npm run type-check

   # Run tests
   npm run test

   # Build project
   npm run build
   ```

3. **Ensure code quality**
   - All tests pass
   - No linting errors
   - Code is properly formatted
   - No TypeScript errors
   - All new features have tests

### Creating a PR

1. **Push your branch**

   ```bash
   git push origin your-feature-branch
   ```

2. **Create the Pull Request**

   - Use the PR template that appears automatically
   - Provide a clear, descriptive title
   - Fill out all sections of the template
   - Link related issues using keywords (e.g., "Closes #123")
   - Add appropriate labels
   - Request reviews from maintainers

3. **PR Title Format**

   ```
   <type>: <description>
   ```

   Examples:
   - `feat: Add AI-powered inventory search`
   - `fix: Resolve database connection timeout`
   - `docs: Update contributing guidelines`

### PR Expectations

- **Code Review**: At least one approval from a maintainer
- **CI/CD**: All automated checks must pass
- **Conflicts**: Resolve any merge conflicts
- **Documentation**: Update relevant documentation
- **Tests**: Add tests for new features
- **Breaking Changes**: Clearly document in PR description

### After PR Approval

1. **Squash commits** if requested
2. **Rebase** if main has been updated
3. **Wait** for a maintainer to merge

## Code Quality Standards

### General Principles

- **KISS**: Keep It Simple, Stupid
- **DRY**: Don't Repeat Yourself
- **SOLID**: Follow SOLID principles
- **Clean Code**: Write self-documenting code
- **Comments**: Only when necessary to explain "why", not "what"

### TypeScript Standards

- **Strict Mode**: Always use TypeScript strict mode
- **Type Safety**: Avoid `any` type when possible
- **Interfaces**: Define interfaces for all data structures
- **Enums**: Use enums for fixed sets of values
- **Null Safety**: Handle null/undefined explicitly

### Backend Standards

- **Error Handling**: Always use try-catch blocks
- **Validation**: Validate all inputs using Joi or similar
- **Security**: Follow OWASP security best practices
- **Logging**: Use structured logging
- **Database**: Use transactions for multi-step operations

### Frontend Standards

- **Components**: Keep components small and focused
- **State Management**: Use React hooks appropriately
- **Props**: Define PropTypes or TypeScript interfaces
- **Styling**: Use Tailwind CSS classes
- **Accessibility**: Follow WCAG 2.1 AA standards

### File Organization

```
backend/
├── src/
│   ├── controllers/     # Route handlers
│   ├── middleware/      # Express middleware
│   ├── models/          # Prisma models (generated)
│   ├── routes/          # Route definitions
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   ├── types/           # TypeScript types
│   └── index.ts         # Entry point

frontend/
├── src/
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page components
│   ├── services/        # API services
│   ├── utils/           # Helper functions
│   ├── types/           # TypeScript types
│   ├── styles/          # Global styles
│   ├── App.tsx          # Root component
│   └── main.tsx         # Entry point
```

## Testing Guidelines

### Backend Testing

- **Unit Tests**: Test individual functions and services
- **Integration Tests**: Test API endpoints
- **Coverage**: Aim for 80%+ code coverage
- **Mocking**: Mock external dependencies

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Frontend Testing

- **Component Tests**: Test component rendering and behavior
- **Integration Tests**: Test user interactions
- **E2E Tests**: Test complete user flows
- **Coverage**: Aim for 70%+ code coverage

### Test Structure

```typescript
describe('Feature/Component Name', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something specific', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## Documentation

### Code Documentation

- **JSDoc**: Document all exported functions and classes
- **README**: Update README for significant changes
- **API Docs**: Update API documentation for endpoint changes
- **Architecture**: Document architectural decisions

### Example JSDoc

```typescript
/**
 * Retrieves stock information for a specific product
 * @param productId - The unique identifier for the product
 * @param warehouseId - Optional warehouse identifier to filter by
 * @returns Promise resolving to stock information
 * @throws {NotFoundError} If product doesn't exist
 * @throws {DatabaseError} If database query fails
 */
async function getProductStock(
  productId: string,
  warehouseId?: string
): Promise<StockInfo> {
  // Implementation
}
```

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the project
- Show empathy towards other contributors

## Questions or Issues?

- Open an issue for bugs or feature requests
- Use discussions for questions and ideas
- Contact maintainers for urgent matters

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to the AI-Powered Inventory Management System! 🚀
