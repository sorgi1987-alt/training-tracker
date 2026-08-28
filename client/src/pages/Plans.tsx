import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import type { Plan } from '../types/plan';

export function Plans() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiFetch<{ plans: Plan[] }>('/plans')
  });

  return (
    <div className="page">
      <h1 className="page-title">Training plans</h1>

      <Link to="/plans/new" className="button-secondary exercises-add-link">
        + New plan
      </Link>

      {isLoading && <p className="page-subtitle">Loading…</p>}
      {isError && <p className="page-subtitle">Could not load plans.</p>}

      <ul className="exercise-list">
        {data?.plans.map((plan) => (
          <li key={plan.id}>
            <Link to={`/plans/${plan.id}`} className="exercise-list-item">
              <span className="exercise-list-name">{plan.name}</span>
              <span className="exercise-list-meta">
                <span className={`status-badge status-${plan.status}`}>{plan.status}</span>
                {' · '}
                {plan.durationWeeks} weeks
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {data && data.plans.length === 0 && (
        <p className="page-subtitle">No plans yet — create your first one.</p>
      )}
    </div>
  );
}
