import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserAccess } from '@/hooks/useUserAccess';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: Array<'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'>;
}

/**
 * Protected route component that checks user role
 * Redirects to /unauthorized if user doesn't have required role
 */
export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { role, isLoading } = useUserAccess();

  // Show loading state while fetching user profile
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user has required role
  // If requiredRoles is specified but role is undefined (and not loading), redirect to unauthorized
  // This prevents users from bypassing role checks if the API fails
  if (requiredRoles && !role) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredRoles && role && !requiredRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
