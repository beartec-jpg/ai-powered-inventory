import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * Unauthorized (403) page
 * Shown when user doesn't have required role/permissions
 */
export function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-destructive mb-4">403</h1>
          <h2 className="text-3xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to access this page. If you believe this is an error,
            please contact your administrator.
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline">
            Go Back
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
