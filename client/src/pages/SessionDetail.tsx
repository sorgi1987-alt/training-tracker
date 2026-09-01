import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { SessionExerciseEditor } from '../components/SessionExerciseEditor';
import type { WorkoutSession } from '../types/session';

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['session', id],
    queryFn: () => apiFetch<{ session: WorkoutSession }>(`/sessions/${id}`),
    enabled: Boolean(id)
  });

  const [notes, setNotes] = useState<string | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['session', id] });
  }

  const saveNotes = useMutation({
    mutationFn: (value: string) => apiFetch(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ notes: value }) })
  });

  if (isLoading) return <div className="page page-subtitle">Loading…</div>;
  if (isError || !data) return <div className="page page-subtitle">Session not found.</div>;

  const { session } = data;
  const exercises = session.exercises ?? [];

  return (
    <div className="page">
      <Link to="/history" className="back-link">
        ‹ History
      </Link>
      <div className="detail-header">
        <h1 className="page-title">{session.name}</h1>
        <div className="detail-chips">
          <span className={`status-badge status-${session.status}`}>{session.status.replace('_', ' ')}</span>
          <span className="meta-chip">{new Date(session.startedTime).toLocaleString()}</span>
          {session.durationSeconds != null && (
            <span className="meta-chip">{Math.round(session.durationSeconds / 60)} min</span>
          )}
        </div>
      </div>

      <ul className="plain-list">
        {exercises.map((exercise) => (
          <SessionExerciseEditor
            key={exercise.id}
            sessionId={session.id}
            exercise={exercise}
            onChanged={refresh}
            allowSubstitute={false}
          />
        ))}
      </ul>

      {exercises.length === 0 && <p className="page-subtitle">This session has no exercises recorded.</p>}

      <section className="card">
        <h2 className="card-title">Workout notes</h2>
        <textarea
          className="text-input"
          rows={2}
          defaultValue={session.notes ?? ''}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== null && saveNotes.mutate(notes)}
        />
      </section>
    </div>
  );
}
