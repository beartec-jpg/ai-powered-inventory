import { SignUp as ClerkSignUp } from '@clerk/clerk-react';

/**
 * Sign-up page with Clerk hosted UI
 * Auto-creates user_profiles via webhook
 * Redirects to dashboard after successful sign-up
 */
export function SignUp() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Account</h1>
          <p className="text-muted-foreground">Join AI Inventory Management System</p>
        </div>
        <ClerkSignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-lg',
            },
          }}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
