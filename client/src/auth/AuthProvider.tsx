import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCatalyst, type CatalystUser } from './catalystSdk';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: CatalystUser | null;
  refresh: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

// Catalyst's SDK scripts load asynchronously; poll briefly for `window.catalyst`
// instead of assuming it's ready on first render.
function waitForCatalystSdk(timeoutMs = 5000): Promise<ReturnType<typeof getCatalyst>> {
  return new Promise((resolve) => {
    const existing = getCatalyst();
    if (existing) {
      resolve(existing);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      const sdk = getCatalyst();
      if (sdk || Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(sdk);
      }
    }, 100);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<CatalystUser | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      setIsLoading(true);
      const sdk = await waitForCatalystSdk();
      if (cancelled) return;

      if (!sdk) {
        // SDK never loaded (e.g. plain `vite dev` without Catalyst serving it).
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await sdk.auth.isUserAuthenticated();
        if (!cancelled) setUser(currentUser);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const value = useMemo<AuthState>(
    () => ({
      isLoading,
      isAuthenticated: user !== null,
      user,
      refresh: () => setNonce((n) => n + 1)
    }),
    [isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
