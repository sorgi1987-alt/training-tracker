import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { HistoryIcon, ChevronRightIcon } from '../components/icons';
import type { Plan } from '../types/plan';
import type { SessionStatus, WorkoutSession } from '../types/session';

const STATUS_OPTIONS: { value: SessionStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned' },
  { value: 'in_progress', label: 'In progress' }
];

export function History() {
  const [status, setStatus] = useState<SessionStatus | ''>('');
  const [planId, setPlanId] = useState('');

  const plansQuery = useQuery({ queryKey: ['plans'], queryFn: () => apiFetch<{ plans: Plan[] }>('/plans') });

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (planId) params.set('planId', planId);

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'history', status, planId],
    queryFn: () => apiFetch<{ sessions: WorkoutSession[] }>(`/sessions?${params.toString()}`)
  });

  return (
    <div className="page">
      <h1 className="page-title">History</h1>

      <div className="filter-row">
        <select className="text-input" value={status} onChange={(e) => setStatus(e.target.value as SessionStatus | '')}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="text-input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">All plans</option>
          {plansQuery.data?.plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </div>

      {sessionsQuery.isLoading && <p className="page-subtitle">Loading…</p>}
      {sessionsQuery.data && sessionsQuery.data.sessions.length === 0 && (
        <p className="empty-state">No sessions match these filters.</p>
      )}

      {sessionsQuery.data && sessionsQuery.data.sessions.length > 0 && (
        <div className="list-card">
          <ul className="list-rows">
            {sessionsQuery.data.sessions.map((session) => (
              <li key={session.id}>
                <Link to={`/history/${session.id}`} className="list-row">
                  <span className="list-row-icon-wrap">
                    <HistoryIcon className="list-row-icon" />
                  </span>
                  <span className="list-row-body">
                    <span className="list-row-title">{session.name}</span>
                    <span className="list-row-meta">
                      <span className={`status-badge status-${session.status}`}>{session.status.replace('_', ' ')}</span>
                      <span>{new Date(session.startedTime).toLocaleDateString()}</span>
                      {session.durationSeconds != null && <span>{Math.round(session.durationSeconds / 60)} min</span>}
                    </span>
                  </span>
                  <ChevronRightIcon className="list-row-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
