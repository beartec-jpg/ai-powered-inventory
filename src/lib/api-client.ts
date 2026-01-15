/**
 * API Client for authenticated requests to backend
 * 
 * This module provides helper functions for making authenticated API requests
 * to the backend. It automatically includes the Clerk user ID in request headers.
 */

/**
 * Make an authenticated API request
 * 
 * @param endpoint - API endpoint path (e.g., '/api/inventory/catalogue')
 * @param userId - Clerk user ID from useAuth hook
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Response from the API
 */
export async function apiRequest(
  endpoint: string,
  userId: string | null | undefined,
  options: RequestInit = {}
): Promise<Response> {
  // Ensure userId is provided
  if (!userId) {
    throw new Error('User ID is required for API requests. User must be authenticated.');
  }

  // Build headers with authentication
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'x-clerk-user-id': userId,
    ...options.headers,
  };

  // Make the request
  return fetch(endpoint, {
    ...options,
    headers,
  });
}

/**
 * Make an authenticated GET request
 */
export async function apiGet<T = any>(
  endpoint: string,
  userId: string | null | undefined
): Promise<T> {
  const response = await apiRequest(endpoint, userId, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Make an authenticated POST request
 */
export async function apiPost<T = any>(
  endpoint: string,
  userId: string | null | undefined,
  body: any
): Promise<T> {
  const response = await apiRequest(endpoint, userId, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Make an authenticated PUT request
 */
export async function apiPut<T = any>(
  endpoint: string,
  userId: string | null | undefined,
  body: any
): Promise<T> {
  const response = await apiRequest(endpoint, userId, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Make an authenticated DELETE request
 */
export async function apiDelete<T = any>(
  endpoint: string,
  userId: string | null | undefined
): Promise<T> {
  const response = await apiRequest(endpoint, userId, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}
