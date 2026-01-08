# Clerk Authentication Setup Guide

This guide explains how to set up Clerk authentication for the AI-Powered Inventory Management System.

## Overview

The application uses Clerk for authentication with the following features:
- Protected routes with role-based access control (RBAC)
- User profile synchronization via webhooks
- Role hierarchy: ADMIN > MANAGER > STAFF > VIEWER
- Warehouse-level access control

## Setup Instructions

### 1. Create a Clerk Account

1. Go to [https://clerk.com](https://clerk.com) and sign up
2. Create a new application
3. Copy your **Publishable Key** and **Secret Key**

### 2. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-publishable-key-here
CLERK_SECRET_KEY=sk_test_your-secret-key-here
CLERK_WEBHOOK_SECRET=whsec_your-webhook-secret-here
```

### 3. Configure Clerk Webhook

To automatically sync users to your database:

1. Go to Clerk Dashboard > Webhooks
2. Click "Add Endpoint"
3. Enter your endpoint URL: `https://your-domain.com/api/webhooks/clerk`
4. Subscribe to these events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Copy the "Signing Secret" and add it to `CLERK_WEBHOOK_SECRET`

### 4. Database Migration

Run the database migration to create the `user_profiles` table:

```sql
-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  clerk_user_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(50) DEFAULT 'VIEWER' NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_clerk_user_id_idx ON user_profiles(clerk_user_id);
CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles(email);

-- Update Warehouse Access Table
ALTER TABLE warehouse_accesses 
  RENAME COLUMN user_id TO user_profile_id;

ALTER TABLE warehouse_accesses
  ADD CONSTRAINT fk_user_profile
  FOREIGN KEY (user_profile_id)
  REFERENCES user_profiles(id)
  ON DELETE CASCADE;
```

## User Roles

### ADMIN
- Full system access
- Can manage users and assign roles
- Can configure warehouses
- Access to all inventory operations

### MANAGER
- Manage inventory and stock
- View and edit purchase orders
- Manage warehouse transfers
- Cannot manage users or system settings

### STAFF
- Add, update inventory items
- Process stock movements
- View reports
- Cannot manage purchase orders

### VIEWER
- Read-only access
- Can view inventory, stock levels, and reports
- Cannot make any changes

## Protected Routes

### Public Routes
- `/sign-in` - Sign-in page
- `/sign-up` - Sign-up page

### Protected Routes
- `/dashboard` - Main dashboard (all authenticated users)
- `/unauthorized` - 403 error page

### Role-Restricted Routes Example
```tsx
<Route
  path="/admin/*"
  element={
    <ProtectedLayout>
      <ProtectedRoute requiredRoles={['ADMIN']}>
        <AdminPanel />
      </ProtectedRoute>
    </ProtectedLayout>
  }
/>
```

## API Usage

### Getting User Profile

```typescript
import { useUserAccess } from '@/hooks/useUserAccess';

function MyComponent() {
  const { userProfile, role, warehouseAccess, isLoading } = useUserAccess();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <p>Welcome, {userProfile?.full_name}</p>
      <p>Role: {role}</p>
      <p>Warehouses: {warehouseAccess.length}</p>
    </div>
  );
}
```

### Making Authenticated API Calls

```typescript
import { useAuthToken } from '@/hooks/useAuthToken';

function MyComponent() {
  const { getAuthToken, userId } = useAuthToken();
  
  const fetchData = async () => {
    const token = await getAuthToken();
    
    const response = await fetch('/api/some-endpoint', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Clerk-User-Id': userId || '',
      },
    });
    
    return response.json();
  };
  
  // ...
}
```

## Architecture Flow

```
User visits website
    ↓
ClerkProvider initializes (checks session)
    ↓
No valid login? → Redirect to /sign-in
    ↓
Valid login? → ProtectedLayout renders
    ↓
Fetch user profile from /api/auth/profile
    ↓
Check route's required role
    ↓
Role matches? → Show page
    ↓
Role doesn't match? → Show /unauthorized
```

## Troubleshooting

### User not found after sign-up
- Check that webhook is configured correctly
- Verify `CLERK_WEBHOOK_SECRET` is set
- Check Vercel/server logs for webhook errors
- Manually create user profile in database if needed

### Infinite redirect loop
- Check that `VITE_CLERK_PUBLISHABLE_KEY` is set correctly
- Ensure environment variables are prefixed with `VITE_` for client-side access
- Clear browser cache and cookies

### 403 Unauthorized errors
- Verify user has correct role in database
- Check that `requiredRoles` prop is set correctly
- Ensure user profile was created successfully

## Production Deployment

### Environment Variables on Vercel

1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Add all Clerk environment variables
3. Redeploy the application

### Important Notes

- Never commit `.env` files to Git
- Keep `CLERK_SECRET_KEY` and `CLERK_WEBHOOK_SECRET` secure
- Use different Clerk applications for development and production
- Test webhook in development mode using Clerk's webhook testing feature

## Security Best Practices

1. **Always verify JWT tokens** on the backend for sensitive operations
2. **Use HTTPS** in production
3. **Implement rate limiting** on webhook endpoints
4. **Validate webhook signatures** using Svix
5. **Use role-based access control** for all sensitive operations
6. **Log authentication events** for audit trail
7. **Regularly rotate secrets** in production

## Support

For issues or questions:
- Clerk Documentation: https://clerk.com/docs
- Clerk Support: https://clerk.com/support
- Project Issues: GitHub Issues page
