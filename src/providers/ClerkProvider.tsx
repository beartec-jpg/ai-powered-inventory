import { ClerkProvider as ClerkProviderBase } from '@clerk/clerk-react';
import { ReactNode } from 'react';

interface ClerkProviderProps {
  children: ReactNode;
}

/**
 * Clerk authentication provider wrapper
 * Wraps the application with Clerk authentication context
 */
export function ClerkProvider({ children }: ClerkProviderProps) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Configuration Error</h1>
          <p className="text-muted-foreground mb-4">
            Missing Clerk publishable key. Please set VITE_CLERK_PUBLISHABLE_KEY in your environment variables.
          </p>
          <p className="text-xs text-muted-foreground">
            Check .env.example for configuration instructions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProviderBase publishableKey={publishableKey}>
      {children}
    </ClerkProviderBase>
  );
}
