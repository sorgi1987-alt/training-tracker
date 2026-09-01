import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { ListIcon, ChevronRightIcon } from '../components/icons';
import type { Plan } from '../types/plan';

export function Plans() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiFetch<{ plans: Plan[] }>('/plans')
  });

  return (
    <div className="page">
      <h1 className="page-title">Training plans</h1>

      <div className="action-row">
        <Link to="/plans/new" className="button-secondary">
          + New plan
        </Link>
        <Link to="/plans/import" className="button-secondary">
          Import from JSON
        </Link>
      </div>

      {isLoading && <p className="page-subtitle">Loading…</p>}
      {isError && <p className="page-subtitle">Could not load plans.</p>}

      {data && data.plans.length > 0 && (
        <div className="list-card">
          <ul className="list-rows">
            {data.plans.map((plan) => (
              <li key={plan.id}>
                <Link to={`/plans/${plan.id}`} className="list-row">
                  <span className="list-row-icon-wrap">
                    <ListIcon className="list-row-icon" />
                  </span>
                  <span className="list-row-body">
                    <span className="list-row-title">{plan.name}</span>
                    <span className="list-row-meta">
                      <span className={`status-badge status-${plan.status}`}>{plan.status}</span>
                      <span>{plan.durationWeeks} weeks</span>
                    </span>
                  </span>
                  <ChevronRightIcon className="list-row-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && data.plans.length === 0 && (
        <p className="empty-state">No plans yet — create your first one.</p>
      )}
    </div>
  );
}
