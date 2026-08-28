import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import type { Plan } from '../types/plan';
import type { WorkoutSession } from '../types/session';

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
  const whoami = useQuery({
    queryKey: ['whoami'],
    queryFn: () => apiFetch<WhoAmI>('/health/whoami')
  });

  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiFetch<{ plans: Plan[] }>('/plans')
  });

  const inProgress = useQuery({
    queryKey: ['sessions', 'in_progress'],
    queryFn: () => apiFetch<{ sessions: WorkoutSession[] }>('/sessions?status=in_progress')
  });

  const activePlan = plans.data?.plans.find((plan) => plan.status === 'active');
  const activeSession = inProgress.data?.sessions[0];

  return (
    <div className="page">
      <h1 className="page-title">Home</h1>
      <p className="page-subtitle">Signed in</p>

      {activeSession && (
        <section className="card">
          <h2 className="card-title">Workout in progress</h2>
          <p>
            <strong>{activeSession.name}</strong>
            <br />
            <Link to="/workout">Resume workout</Link>
          </p>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Active plan</h2>
        {plans.isLoading && <p>Loading…</p>}
        {!plans.isLoading && !activePlan && (
          <p>
            No active plan. <Link to="/plans">Choose or create one</Link>.
          </p>
        )}
        {activePlan && (
          <p>
            <strong>{activePlan.name}</strong>
            {weekLabel(activePlan)}
            <br />
            <Link to={`/plans/${activePlan.id}`}>View plan</Link>
            {!activeSession && (
              <>
                {' · '}
                <Link to="/workout">Start Workout</Link>
              </>
            )}
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Foundation check</h2>
        {whoami.isLoading && <p>Checking server identity…</p>}
        {whoami.isError && <p>Could not reach the server.</p>}
        {whoami.data && (
          <p>
            Server confirms you as <strong>{whoami.data.user.email}</strong> (derived
            server-side — never sent by this client).
          </p>
        )}
      </section>
    </div>
  );
}

function weekLabel(plan: Plan): string {
  if (!plan.startDate || !plan.durationWeeks) return '';
  const start = new Date(plan.startDate).getTime();
  if (Number.isNaN(start)) return '';
  const days = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
  const week = Math.min(Math.max(Math.floor(days / 7) + 1, 1), plan.durationWeeks);
  return ` — Week ${week} of ${plan.durationWeeks}`;
}
