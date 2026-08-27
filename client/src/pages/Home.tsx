import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

interface WhoAmI {
  user: {
    zuid: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export function Home() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['whoami'],
    queryFn: () => apiFetch<WhoAmI>('/health/whoami')
  });

  return (
    <div className="page">
      <h1 className="page-title">Home</h1>
      <p className="page-subtitle">Signed in</p>

      <section className="card">
        <h2 className="card-title">Foundation check</h2>
        {isLoading && <p>Checking server identity…</p>}
        {isError && <p>Could not reach the server.</p>}
        {data && (
          <p>
            Server confirms you as <strong>{data.user.email}</strong> (derived
            server-side — never sent by this client).
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Coming soon</h2>
        <p>Training plans, your next workout, and quick actions land here in a later phase.</p>
      </section>
    </div>
  );
}
