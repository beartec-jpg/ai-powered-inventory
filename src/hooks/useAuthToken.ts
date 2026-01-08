import { useAuth } from '@clerk/clerk-react';

/**
 * Hook to get Clerk authentication token for API calls
 * Returns the session token to use in Authorization header
 */
export function useAuthToken() {
  const { getToken, userId } = useAuth();

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const token = await getToken();
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  return {
    getAuthToken,
    userId,
  };
}
