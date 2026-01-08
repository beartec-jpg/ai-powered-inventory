import { SignIn as ClerkSignIn } from '@clerk/clerk-react';

/**
 * Sign-in page with Clerk hosted UI
 * Redirects to dashboard after successful sign-in
 */
export function SignIn() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to your inventory account</p>
        </div>
        <ClerkSignIn
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-lg',
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
