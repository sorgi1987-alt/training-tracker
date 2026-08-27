// Thin wrapper around the global `catalyst` object injected by
// catalystWebSDK.js + /__catalyst/sdk/init.js (see index.html). Both scripts
// only resolve when served through Catalyst (catalyst serve, or deployed) —
// never through a bare `vite dev` server.

export interface CatalystUser {
  zuid: string;
  user_id: string;
  email_id: string;
  first_name: string;
  last_name: string;
  [key: string]: unknown;
}

interface CatalystAuth {
  isUserAuthenticated: () => Promise<CatalystUser>;
  signIn: (elementId: string, config?: Record<string, unknown>) => void;
  signOut: (redirectUrl?: string) => void;
}

interface CatalystGlobal {
  auth: CatalystAuth;
}

declare global {
  interface Window {
    catalyst?: CatalystGlobal;
  }
}

export function getCatalyst(): CatalystGlobal | undefined {
  return window.catalyst;
}
