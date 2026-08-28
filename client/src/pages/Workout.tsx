import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { Plan } from '../types/plan';
import type { SessionExercise, WorkoutSession } from '../types/session';
import type { Exercise } from '../types/exercise';

export function Workout() {
  const queryClient = useQueryClient();

  const activeSessionQuery = useQuery({
    queryKey: ['sessions', 'in_progress'],
    queryFn: () => apiFetch<{ sessions: WorkoutSession[] }>('/sessions?status=in_progress')
  });

  const activeSessionSummary = activeSessionQuery.data?.sessions[0];

  const sessionTreeQuery = useQuery({
    queryKey: ['session', activeSessionSummary?.id],
    queryFn: () => apiFetch<{ session: WorkoutSession }>(`/sessions/${activeSessionSummary!.id}`),
    enabled: Boolean(activeSessionSummary)
  });

  function refreshActiveSession() {
    if (activeSessionSummary) queryClient.invalidateQueries({ queryKey: ['session', activeSessionSummary.id] });
  }

  function onSessionEnded() {
    queryClient.invalidateQueries({ queryKey: ['sessions', 'in_progress'] });
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
  }

  if (activeSessionQuery.isLoading) return <div className="page page-subtitle">Loading…</div>;

  if (activeSessionSummary && sessionTreeQuery.data) {
    return <ActiveWorkout session={sessionTreeQuery.data.session} onChanged={refreshActiveSession} onEnded={onSessionEnded} />;
  }

  return <StartWorkout onStarted={onSessionEnded} />;
}

function StartWorkout({ onStarted }: { onStarted: () => void }) {
  const plansQuery = useQuery({ queryKey: ['plans'], queryFn: () => apiFetch<{ plans: Plan[] }>('/plans') });
  const activePlan = plansQuery.data?.plans.find((plan) => plan.status === 'active');

  const planTreeQuery = useQuery({
    queryKey: ['plan', activePlan?.id],
    queryFn: () => apiFetch<{ plan: Plan }>(`/plans/${activePlan!.id}`),
    enabled: Boolean(activePlan)
  });

  const recentSessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiFetch<{ sessions: WorkoutSession[] }>('/sessions'),
    enabled: Boolean(activePlan)
  });

  const startSession = useMutation({
    mutationFn: (planWorkoutId: string) =>
      apiFetch<{ session: WorkoutSession }>('/sessions', { method: 'POST', body: JSON.stringify({ planWorkoutId }) }),
    onSuccess: onStarted
  });

  if (plansQuery.isLoading) return <div className="page page-subtitle">Loading…</div>;

  if (!activePlan) {
    return (
      <div className="page">
        <h1 className="page-title">Workout</h1>
        <p className="page-subtitle">
          No active plan. <Link to="/plans">Choose or create one</Link>.
        </p>
      </div>
    );
  }

  const workouts = planTreeQuery.data?.plan.workouts ?? [];
  // Suggest the workout after whichever one was last completed for this
  // plan, wrapping back to the first — keeps the sequence without forcing
  // workouts onto weekdays (spec section 5).
  const lastCompleted = recentSessionsQuery.data?.sessions.find(
    (session) => session.status === 'completed' && session.planId === activePlan.id
  );
  const lastIndex = lastCompleted ? workouts.findIndex((w) => w.id === lastCompleted.planWorkoutId) : -1;
  const nextWorkout = workouts.length ? workouts[(lastIndex + 1) % workouts.length] : null;

  return (
    <div className="page">
      <h1 className="page-title">Workout</h1>
      <p className="page-subtitle">{activePlan.name}</p>

      {nextWorkout ? (
        <section className="card">
          <h2 className="card-title">Next up: {nextWorkout.name}</h2>
          <button className="button-primary" onClick={() => startSession.mutate(nextWorkout.id)} disabled={startSession.isPending}>
            Start Workout
          </button>
        </section>
      ) : (
        <p className="page-subtitle">
          This plan has no workouts yet. <Link to={`/plans/${activePlan.id}`}>Add one</Link>.
        </p>
      )}

      {workouts.length > 1 && (
        <section className="card">
          <h2 className="card-title">Or pick a workout</h2>
          <ul className="plain-list">
            {workouts
              .filter((w) => w.id !== nextWorkout?.id)
              .map((workout) => (
                <li key={workout.id}>
                  <button
                    className="picker-item"
                    onClick={() => startSession.mutate(workout.id)}
                    disabled={startSession.isPending}
                  >
                    {workout.name}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ActiveWorkout({
  session,
  onChanged,
  onEnded
}: {
  session: WorkoutSession;
  onChanged: () => void;
  onEnded: () => void;
}) {
  const [notes, setNotes] = useState(session.notes ?? '');

  const finish = useMutation({
    mutationFn: () => apiFetch(`/sessions/${session.id}/finish`, { method: 'POST' }),
    onSuccess: onEnded
  });

  const abandon = useMutation({
    mutationFn: () => apiFetch(`/sessions/${session.id}/abandon`, { method: 'POST' }),
    onSuccess: onEnded
  });

  const saveNotes = useMutation({
    mutationFn: () => apiFetch(`/sessions/${session.id}`, { method: 'PATCH', body: JSON.stringify({ notes }) })
  });

  const exercises = session.exercises ?? [];

  return (
    <div className="page">
      <h1 className="page-title">{session.name}</h1>
      <p className="page-subtitle">In progress</p>

      <ul className="plain-list">
        {exercises.map((exercise) => (
          <SessionExerciseCard key={exercise.id} sessionId={session.id} exercise={exercise} onChanged={onChanged} />
        ))}
      </ul>

      <AddSessionExercise sessionId={session.id} onAdded={onChanged} />

      <section className="card">
        <h2 className="card-title">Workout notes</h2>
        <textarea
          className="text-input"
          rows={2}
          placeholder="e.g. Poor sleep today. Shoulder slightly irritated."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => saveNotes.mutate()}
        />
      </section>

      <div className="action-row">
        <button className="button-primary" onClick={() => finish.mutate()} disabled={finish.isPending}>
          Finish Workout
        </button>
        <button className="button-secondary" onClick={() => abandon.mutate()} disabled={abandon.isPending}>
          Abandon
        </button>
      </div>
    </div>
  );
}

function SessionExerciseCard({
  sessionId,
  exercise,
  onChanged
}: {
  sessionId: string;
  exercise: SessionExercise;
  onChanged: () => void;
}) {
  const [showSubstitute, setShowSubstitute] = useState(false);
  const basePath = `/sessions/${sessionId}/exercises/${exercise.id}`;

  const addSet = useMutation({
    mutationFn: () => apiFetch(`${basePath}/sets`, { method: 'POST', body: JSON.stringify({ type: 'working' }) }),
    onSuccess: onChanged
  });

  const updateSet = useMutation({
    mutationFn: ({ setId, patch }: { setId: string; patch: Record<string, unknown> }) =>
      apiFetch(`${basePath}/sets/${setId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: onChanged
  });

  const deleteSet = useMutation({
    mutationFn: (setId: string) => apiFetch(`${basePath}/sets/${setId}`, { method: 'DELETE' }),
    onSuccess: onChanged
  });

  const patchExercise = useMutation({
    mutationFn: (patch: Record<string, unknown>) => apiFetch(basePath, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => {
      setShowSubstitute(false);
      onChanged();
    }
  });

  return (
    <li className={`card${exercise.skipped ? ' is-skipped' : ''}`}>
      <div className="reorderable-row-main-static">
        <span className="exercise-list-name">{exercise.actualExerciseName ?? 'Unknown exercise'}</span>
        {exercise.substituted && exercise.plannedExerciseName && (
          <span className="exercise-list-meta">Substituted for {exercise.plannedExerciseName}</span>
        )}
      </div>

      {exercise.previousPerformance.length > 0 && (
        <p className="previous-performance">
          Previous: {exercise.previousPerformance.map((set) => `${set.weight ?? '–'} kg × ${set.reps ?? '–'}`).join(', ')}
        </p>
      )}

      <ul className="plain-list">
        {exercise.sets.map((set, index) => (
          <li key={set.id} className={`set-row${set.skipped ? ' is-skipped' : ''}`}>
            <span className="set-row-index">{index + 1}</span>
            <input
              className="set-input"
              type="number"
              placeholder="kg"
              defaultValue={set.weight ?? ''}
              onBlur={(e) => updateSet.mutate({ setId: set.id, patch: { weight: e.target.value === '' ? null : Number(e.target.value) } })}
            />
            <input
              className="set-input"
              type="number"
              placeholder="reps"
              defaultValue={set.reps ?? ''}
              onBlur={(e) => updateSet.mutate({ setId: set.id, patch: { reps: e.target.value === '' ? null : Number(e.target.value) } })}
            />
            <label className="set-complete">
              <input
                type="checkbox"
                checked={set.completed}
                onChange={(e) => updateSet.mutate({ setId: set.id, patch: { completed: e.target.checked } })}
              />
            </label>
            <button
              className="icon-button"
              onClick={() => updateSet.mutate({ setId: set.id, patch: { skipped: !set.skipped } })}
              aria-label="Toggle skip set"
            >
              ⤫
            </button>
            <button className="icon-button" onClick={() => deleteSet.mutate(set.id)} aria-label="Remove set">
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="action-row">
        <button className="button-secondary" onClick={() => addSet.mutate()} disabled={addSet.isPending}>
          + Add set
        </button>
        <button className="button-secondary" onClick={() => patchExercise.mutate({ skipped: !exercise.skipped })}>
          {exercise.skipped ? 'Unskip exercise' : 'Skip exercise'}
        </button>
        <button className="button-secondary" onClick={() => setShowSubstitute((v) => !v)}>
          Substitute
        </button>
      </div>

      {showSubstitute && <SubstitutePicker onPick={(exerciseId) => patchExercise.mutate({ exerciseId })} />}
    </li>
  );
}

function SubstitutePicker({ onPick }: { onPick: (exerciseId: string) => void }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);

  const { data } = useQuery({
    queryKey: ['exercises', debouncedSearch],
    queryFn: () => apiFetch<{ exercises: Exercise[] }>(`/exercises?q=${encodeURIComponent(debouncedSearch)}`),
    enabled: debouncedSearch.length > 0
  });

  return (
    <div>
      <input
        className="text-input"
        placeholder="Search replacement exercise"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {data && data.exercises.length > 0 && (
        <ul className="picker-list">
          {data.exercises.map((exercise) => (
            <li key={exercise.id}>
              <button className="picker-item" onClick={() => onPick(exercise.id)}>
                {exercise.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddSessionExercise({ sessionId, onAdded }: { sessionId: string; onAdded: () => void }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);

  const { data } = useQuery({
    queryKey: ['exercises', debouncedSearch],
    queryFn: () => apiFetch<{ exercises: Exercise[] }>(`/exercises?q=${encodeURIComponent(debouncedSearch)}`),
    enabled: debouncedSearch.length > 0
  });

  const addExercise = useMutation({
    mutationFn: (exerciseId: string) =>
      apiFetch(`/sessions/${sessionId}/exercises`, { method: 'POST', body: JSON.stringify({ exerciseId }) }),
    onSuccess: () => {
      setSearch('');
      onAdded();
    }
  });

  return (
    <section className="card">
      <h2 className="card-title">Add exercise</h2>
      <input
        className="text-input"
        placeholder="Search exercises"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {data && data.exercises.length > 0 && (
        <ul className="picker-list">
          {data.exercises.map((exercise) => (
            <li key={exercise.id}>
              <button className="picker-item" onClick={() => addExercise.mutate(exercise.id)}>
                {exercise.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
