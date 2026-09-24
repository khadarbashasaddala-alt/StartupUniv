import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on 401/403 errors (authentication issues)
        if (error?.message?.includes('401') || error?.message?.includes('403') || error?.message?.includes('Unauthorized')) {
          return false;
        }
        return failureCount < 2;
      },
      queryFn: async ({ queryKey }) => {
        let path = Array.isArray(queryKey) ? queryKey[0] : queryKey;
        if (typeof path !== 'string' || !path.startsWith('/')) {
          throw new Error('Invalid query key');
        }
        
        // Remove /api prefix if it's already there (to avoid /api/api/...)
        if (path.startsWith('/api/')) {
          path = path.substring(4); // Remove '/api' but keep the leading '/'
        }
        
        console.log(`🔍 Fetching: /api${path}`);
        
        const response = await fetch(`/api${path}`, {
          credentials: 'include',
        });
        
        // Check content type before parsing
        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');
        
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          
          // Try to parse error as JSON, but handle non-JSON responses
          if (isJson) {
            try {
              const error = await response.json();
              errorMessage = error.message || errorMessage;
            } catch (e) {
              // If JSON parsing fails, try to get text
              const text = await response.text().catch(() => '');
              errorMessage = text || errorMessage;
            }
          } else {
            // Not JSON, try to get text
            const text = await response.text().catch(() => '');
            if (text) {
              errorMessage = text.substring(0, 200); // Limit length
            }
          }
          
          console.error(`❌ API Error for /api${path}:`, response.status, errorMessage);
          
          // Provide helpful error messages
          if (response.status === 401) {
            throw new Error('Unauthorized - Please log out and log back in');
          } else if (response.status === 403) {
            throw new Error('Forbidden - You do not have permission to access this resource');
          }
          
          throw new Error(errorMessage);
        }
        
        // Parse response based on content type
        let data;
        if (isJson) {
          try {
            const text = await response.text();
            data = JSON.parse(text);
          } catch (e) {
            console.error(`❌ JSON Parse Error for /api${path}:`, e);
            throw new Error(`Invalid JSON response from server: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        } else {
          const text = await response.text();
          console.warn(`⚠️ Non-JSON response from /api${path}:`, text.substring(0, 100));
          throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
        }
        
        console.log(`✅ Fetched /api${path}:`, data);
        return data;
      },
    },
  },
});

export async function apiRequest(
  method: string,
  path: string,
  data?: any,
  requestOptions?: { headers?: Record<string, string> }
): Promise<any> {
  // Remove /api prefix if it's already there (to avoid /api/api/...)
  let normalizedPath = path;
  if (path.startsWith('/api/')) {
    normalizedPath = path.substring(4); // Remove '/api' but keep the leading '/'
  }
  
  console.log(`🔍 API ${method}: /api${normalizedPath}`, data ? { ...data, password: data.password ? '***' : undefined } : '');
  
  const fetchOptions: RequestInit = {
    method,
    headers: {
      ...(requestOptions?.headers || {}),
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
    // If it's an ArrayBuffer or Blob, send as-is (for file uploads)
    if (data instanceof ArrayBuffer || data instanceof Blob) {
      fetchOptions.body = data;
      // Remove Content-Type for binary data, let browser set it
      delete (fetchOptions.headers as any)["Content-Type"];
    } else {
      fetchOptions.body = JSON.stringify(data);
    }
  }

  const response = await fetch(`/api${normalizedPath}`, fetchOptions);

  // Check content type
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    let errorBody: any = null;

    // Try to parse error as JSON, but handle non-JSON responses
    if (isJson) {
      try {
        const error = await response.json();
        errorBody = error;
        errorMessage = error.message || errorMessage;
      } catch (e) {
        // If JSON parsing fails, try to get text
        const text = await response.text().catch(() => '');
        errorMessage = text || errorMessage;
      }
    } else {
      // Not JSON, try to get text
      const text = await response.text().catch(() => '');
      if (text) {
        errorMessage = text.substring(0, 200); // Limit length
      }
    }

    console.error(`❌ API ${method} Error for /api${normalizedPath}:`, response.status, errorMessage);

    // Not every non-2xx is a failure worth shouting about. A shared task that
    // is still waiting on other assignees, for instance, answers 409 with
    // `informational: true` — the caller needs the status and the parsed body
    // to tell that apart from a genuine error, so carry both on the Error.
    const fail = (message: string) => {
      const err = new Error(message) as Error & { status?: number; body?: any };
      err.status = response.status;
      err.body = errorBody;
      return err;
    };

    // Provide helpful error messages
    if (response.status === 401) {
      throw fail('Session expired. Please log out and log back in.');
    } else if (response.status === 403) {
      // Use server's specific message if it's meaningful, otherwise use a clean fallback
      const serverMsg = errorMessage && errorMessage !== 'Forbidden' && !errorMessage.startsWith('HTTP ') ? errorMessage : null;
      throw fail(serverMsg || "You don't have permission to perform this action. Contact your mentor or admin if you think this is a mistake.");
    }

    throw fail(errorMessage);
  }

  // Parse response based on content type
  let result;
  if (isJson) {
    try {
      const text = await response.text();
      result = JSON.parse(text);
    } catch (e) {
      console.error(`❌ JSON Parse Error for /api${normalizedPath}:`, e);
      throw new Error(`Invalid JSON response from server: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  } else {
    result = await response.text();
    console.warn(`⚠️ Non-JSON response from /api${normalizedPath}:`, result.substring(0, 100));
  }
  
  console.log(`✅ API ${method} Success for /api${normalizedPath}:`, result);
  return result;
}

