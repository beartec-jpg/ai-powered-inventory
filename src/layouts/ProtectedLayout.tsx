import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';

interface ProtectedLayoutProps {
  children: ReactNode;
}

/**
 * Protected layout that enforces authentication
 * Redirects to /sign-in if user is not authenticated
 * Shows loading spinner while Clerk initializes
 */
export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  // Show loading state while Clerk initializes
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  // Render protected content
  return <>{children}</>;
}
