import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';

const queryClient = new QueryClient();

// `catalyst serve` namespaces the local client under /app/ so it can also
// serve functions at /server/*; the deployed project serves the client at
// its domain root instead. Detect which one we're in rather than hardcoding
// either.
const basename = window.location.pathname.startsWith('/app') ? '/app' : undefined;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basename}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
