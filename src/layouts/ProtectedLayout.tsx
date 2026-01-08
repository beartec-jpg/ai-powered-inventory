import { ReactNode, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';

interface ProtectedLayoutProps {
  children: ReactNode;
}

// Default Clerk Account Portal sign-in URL
const DEFAULT_CLERK_SIGN_IN_URL = 'https://accounts.beartecai-inventory.uk/sign-in';

/**
 * Protected layout that enforces authentication
 * Redirects to Clerk's Account Portal if user is not authenticated
 * Shows loading spinner while Clerk initializes
 */
export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const redirectInitiated = useRef(false);

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

  // Redirect to Clerk's Account Portal if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn && !redirectInitiated.current) {
      redirectInitiated.current = true;
      const signInUrl = import.meta.env.VITE_CLERK_SIGN_IN_URL || DEFAULT_CLERK_SIGN_IN_URL;
      window.location.replace(signInUrl);
    }
  }, [isLoaded, isSignedIn]);

  // Show loading while redirecting
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // Render protected content
  return <>{children}</>;
}
