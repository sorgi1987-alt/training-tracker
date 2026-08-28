import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
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
        <p className="page-subtitle">No sessions match these filters.</p>
      )}

      <ul className="plain-list">
        {sessionsQuery.data?.sessions.map((session) => (
          <li key={session.id}>
            <Link to={`/history/${session.id}`} className="reorderable-row-main history-session-row">
              <span className="exercise-list-name">{session.name}</span>
              <span className="exercise-list-meta">
                <span className={`status-badge status-${session.status}`}>{session.status.replace('_', ' ')}</span>
                {' · '}
                {new Date(session.startedTime).toLocaleDateString()}
                {session.durationSeconds != null && ` · ${Math.round(session.durationSeconds / 60)} min`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
