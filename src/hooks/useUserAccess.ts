import { useQuery } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';

interface WarehouseAccess {
  warehouse_id: string;
  warehouse_name: string;
  access_level: string;
}

interface UserProfile {
  id: string;
  clerk_user_id: string;
  email: string;
  full_name: string | null;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';
  phone: string | null;
  warehouse_access: WarehouseAccess[];
}

interface UserProfileResponse {
  success: boolean;
  data: UserProfile;
}

/**
 * Hook to fetch user profile with role and warehouse access
 * Uses React Query for caching and automatic refetching
 */
export function useUserAccess() {
  const { getAuthToken, userId } = useAuthToken();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: async (): Promise<UserProfile> => {
      const token = await getAuthToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiUrl}/auth/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Clerk-User-Id': userId || '',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch user profile' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result: UserProfileResponse = await response.json();
      
      if (!result.success) {
        throw new Error('Failed to fetch user profile');
      }

      return result.data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  return {
    userProfile: data,
    role: data?.role,
    warehouseAccess: data?.warehouse_access || [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
