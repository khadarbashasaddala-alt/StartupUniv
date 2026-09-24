import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Landing/public pages that don't need auth check
const PUBLIC_PATHS = [
  '/',
  '/about',
  '/program',
  '/plans',
  '/careers',
  '/blog',
  '/faq',
  '/contact',
  '/apply',
  '/for-students',
  '/for-professionals',
  '/for-corporates',
  '/for-universities',
  '/incubation',
  '/studio',
  '/problems',
  '/team',
  '/login',
  '/register',
  '/forgot-password',
];

// Check if current path is a public/landing page
const isPublicPage = () => {
  const path = window.location.pathname;
  return PUBLIC_PATHS.some(publicPath => 
    path === publicPath || path.startsWith('/team-application') || path.startsWith('/team-invite')
  );
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Track consecutive auth failures to prevent instant logout on transient errors
  const authFailCount = useRef(0);
  // Track whether the user just logged in (to protect against immediate refreshUser overwrite)
  const justLoggedIn = useRef(false);

  const refreshUser = useCallback(async () => {
    // Skip auth check on public/landing pages to avoid unnecessary 401 errors
    if (isPublicPage()) {
      setIsLoading(false);
      return;
    }

    // If user just logged in, skip the first automatic refresh to avoid race condition
    // where the session cookie may not yet be fully established in the store
    if (justLoggedIn.current) {
      justLoggedIn.current = false;
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        authFailCount.current = 0; // Reset fail counter on success
      } else if (response.status === 401) {
        // 401 = genuinely not authenticated
        // If user was already set (logged in), require 2 consecutive 401s before logging out
        // This prevents a single transient failure from causing instant logout
        authFailCount.current += 1;
        if (!user || authFailCount.current >= 2) {
          setUser(null);
          authFailCount.current = 0;
        } else {
          console.warn(`Auth check returned 401 (attempt ${authFailCount.current}/2) - retrying before logout`);
        }
      } else {
        // Non-401 error (500, network issues, etc.) - don't immediately log out
        // The session might still be valid, server could be temporarily unavailable
        console.warn(`Auth check returned ${response.status} - keeping current session`);
      }
    } catch (error) {
      // Network error - don't log the user out, server might be temporarily unreachable
      console.warn("Auth check failed (network):", error);
      // Only clear user if they were never logged in (initial load)
      if (!user) {
        setIsLoading(false);
      }
      return; // Don't clear user on network errors
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initialize auth state on mount
  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount, not when refreshUser changes

  // Auto-refresh session periodically to prevent expiration
  // Refresh every 30 minutes (1800000ms) to keep session alive
  useEffect(() => {
    if (!user) {
      return; // Don't refresh if user is not logged in
    }

    // Skip auto-refresh on public pages
    if (isPublicPage()) {
      return;
    }

    const refreshInterval = setInterval(() => {
      // Silently refresh the session to extend expiration
      refreshUser().catch((error) => {
        console.warn("Auto-refresh session failed:", error);
      });
    }, 30 * 60 * 1000); // 30 minutes

    // Also refresh when window regains focus (user comes back to tab)
    const handleFocus = () => {
      refreshUser().catch((error) => {
        console.warn("Focus refresh session failed:", error);
      });
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user, refreshUser]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      const data = await response.json();
      // Mark as just logged in to prevent the next refreshUser from overwriting
      justLoggedIn.current = true;
      authFailCount.current = 0;
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  };


  const logout = async () => {
    authFailCount.current = 0;
    justLoggedIn.current = false;
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
