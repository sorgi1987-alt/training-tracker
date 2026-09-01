import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { ChevronRightIcon } from '../components/icons';
import type { Plan, PlanWorkout } from '../types/plan';

function reordered<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

export function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => apiFetch<{ plan: Plan }>(`/plans/${id}`),
    enabled: Boolean(id)
  });

  const [newWorkoutName, setNewWorkoutName] = useState('');

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['plan', id] });
    queryClient.invalidateQueries({ queryKey: ['plans'] });
  }

  const statusAction = useMutation({
    mutationFn: (action: 'activate' | 'archive' | 'complete') =>
      apiFetch<{ plan: Plan }>(`/plans/${id}/${action}`, { method: 'POST' }),
    onSuccess: invalidate
  });

  const duplicateAction = useMutation({
    mutationFn: () => apiFetch<{ plan: Plan }>(`/plans/${id}/duplicate`, { method: 'POST' }),
    onSuccess: ({ plan }) => {
      invalidate();
      navigate(`/plans/${plan.id}`);
    }
  });

  const [exportJson, setExportJson] = useState<string | null>(null);
  const exportAction = useMutation({
    mutationFn: () => apiFetch<Record<string, unknown>>(`/plans/${id}/export`),
    onSuccess: (json) => setExportJson(JSON.stringify(json, null, 2))
  });

  const addWorkout = useMutation({
    mutationFn: (name: string) =>
      apiFetch(`/plans/${id}/workouts`, { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      setNewWorkoutName('');
      invalidate();
    }
  });

  const deleteWorkout = useMutation({
    mutationFn: (workoutId: string) => apiFetch(`/plans/${id}/workouts/${workoutId}`, { method: 'DELETE' }),
    onSuccess: invalidate
  });

  const reorderWorkouts = useMutation({
    mutationFn: (workoutIds: string[]) =>
      apiFetch(`/plans/${id}/workouts/reorder`, { method: 'POST', body: JSON.stringify({ workoutIds }) }),
    onSuccess: invalidate
  });

  if (isLoading) return <div className="page page-subtitle">Loading…</div>;
  if (isError || !data) return <div className="page page-subtitle">Plan not found.</div>;

  const { plan } = data;
  const workouts = plan.workouts ?? [];

  function moveWorkout(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= workouts.length) return;
    reorderWorkouts.mutate(reordered(workouts, index, target).map((w) => w.id));
  }

  return (
    <div className="page">
      <Link to="/plans" className="back-link">
        ‹ Plans
      </Link>
      <div className="detail-header">
        <h1 className="page-title">{plan.name}</h1>
        <div className="detail-chips">
          <span className={`status-badge status-${plan.status}`}>{plan.status}</span>
          <span className="meta-chip">{plan.durationWeeks} weeks</span>
          {plan.startDate && <span className="meta-chip">starts {plan.startDate}</span>}
        </div>
      </div>
      {plan.description && <p className="page-subtitle">{plan.description}</p>}

      <div className="action-row">
        {plan.status !== 'active' && (
          <button className="button-secondary" onClick={() => statusAction.mutate('activate')}>
            Activate
          </button>
        )}
        {plan.status !== 'completed' && (
          <button className="button-secondary" onClick={() => statusAction.mutate('complete')}>
            Mark complete
          </button>
        )}
        {plan.status !== 'archived' && (
          <button className="button-secondary" onClick={() => statusAction.mutate('archive')}>
            Archive
          </button>
        )}
        <button className="button-secondary" onClick={() => duplicateAction.mutate()}>
          Duplicate
        </button>
        <button className="button-secondary" onClick={() => exportAction.mutate()} disabled={exportAction.isPending}>
          Export JSON
        </button>
      </div>

      {exportJson && (
        <section className="card">
          <h2 className="card-title">Exported JSON</h2>
          <textarea className="text-input json-textarea" rows={10} readOnly value={exportJson} onFocus={(e) => e.target.select()} />
          <div className="action-row">
            <button
              className="button-secondary"
              onClick={() => navigator.clipboard.writeText(exportJson)}
            >
              Copy to clipboard
            </button>
            <button className="button-secondary" onClick={() => setExportJson(null)}>
              Close
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Workouts</h2>

        {workouts.length === 0 && <p className="page-subtitle">No workouts yet.</p>}

        <ul className="plain-list">
          {workouts.map((workout, index) => (
            <WorkoutRow
              key={workout.id}
              planId={plan.id}
              workout={workout}
              isFirst={index === 0}
              isLast={index === workouts.length - 1}
              onMoveUp={() => moveWorkout(index, -1)}
              onMoveDown={() => moveWorkout(index, 1)}
              onDelete={() => deleteWorkout.mutate(workout.id)}
            />
          ))}
        </ul>

        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (newWorkoutName.trim()) addWorkout.mutate(newWorkoutName.trim());
          }}
        >
          <input
            className="text-input"
            placeholder="New workout name"
            value={newWorkoutName}
            onChange={(e) => setNewWorkoutName(e.target.value)}
          />
          <button className="button-secondary" type="submit" disabled={addWorkout.isPending}>
            Add
          </button>
        </form>
      </section>
    </div>
  );
}

function WorkoutRow({
  planId,
  workout,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete
}: {
  planId: string;
  workout: PlanWorkout;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="reorderable-row">
      <Link to={`/plans/${planId}/workouts/${workout.id}`} className="reorderable-row-main">
        <span className="exercise-list-name">{workout.name}</span>
        <span className="exercise-list-meta">{workout.exercises.length} exercises</span>
      </Link>
      <ChevronRightIcon className="list-row-chevron" />
      <div className="reorderable-row-controls">
        <button className="icon-button" onClick={onMoveUp} disabled={isFirst} aria-label="Move up">
          ↑
        </button>
        <button className="icon-button" onClick={onMoveDown} disabled={isLast} aria-label="Move down">
          ↓
        </button>
        <button className="icon-button" onClick={onDelete} aria-label="Delete workout">
          ✕
        </button>
      </div>
    </li>
  );
}
