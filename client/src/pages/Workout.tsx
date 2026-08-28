import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { SessionExerciseEditor } from '../components/SessionExerciseEditor';
import { RestTimer } from '../components/RestTimer';
import { mergeDraftIntoSets, getPendingCount, getPendingPatches, clearPendingSetPatch } from '../lib/offlineDraft';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import type { Plan } from '../types/plan';
import type { WorkoutSession } from '../types/session';
import type { Exercise } from '../types/exercise';

// Applies any locally-drafted (not yet confirmed synced) set edits over the
// server's copy — a refresh while offline should show what was actually
// typed, not a stale server value (spec section 20).
function withDrafts(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises?.map((exercise) => ({
      ...exercise,
      sets: mergeDraftIntoSets(session.id, exercise.sets)
    }))
  };
}

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
    return (
      <ActiveWorkout
        session={withDrafts(sessionTreeQuery.data.session)}
        onChanged={refreshActiveSession}
        onEnded={onSessionEnded}
      />
    );
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
        <section className="cta-card">
          <span className="cta-card-eyebrow">Next up</span>
          <h2 className="cta-card-title">{nextWorkout.name}</h2>
          <p className="cta-card-meta">{nextWorkout.exercises.length} exercises</p>
          <button
            className="button-primary button-large"
            onClick={() => startSession.mutate(nextWorkout.id)}
            disabled={startSession.isPending}
          >
            {startSession.isPending ? 'Starting…' : 'Start Workout'}
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
  const [restTimer, setRestTimer] = useState<{ seconds: number; key: number } | null>(null);
  const isOnline = useOnlineStatus();
  const pendingCount = getPendingCount(session.id);

  function startRestTimer(seconds: number) {
    setRestTimer((prev) => ({ seconds, key: (prev?.key ?? 0) + 1 }));
  }

  // Predictable retry: on reconnect, replay whatever the user most recently
  // typed for each still-unsynced set. Each patch is just "the desired
  // current state" (not a request log), so replaying is safe even if
  // several edits to the same field happened while offline.
  useEffect(() => {
    if (!isOnline) return;
    const pending = getPendingPatches(session.id);
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const { exerciseId, setId, patch } of pending) {
        try {
          await apiFetch(`/sessions/${session.id}/exercises/${exerciseId}/sets/${setId}`, {
            method: 'PATCH',
            body: JSON.stringify(patch)
          });
          if (!cancelled) clearPendingSetPatch(session.id, setId);
        } catch {
          // Still offline or a transient failure — leave queued, the next
          // 'online' event (or next mount) will retry.
        }
      }
      if (!cancelled) onChanged();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, session.id]);

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
  const allSets = exercises.flatMap((exercise) => exercise.sets);
  const totalSets = allSets.length;
  const doneSets = allSets.filter((set) => set.completed).length;
  const progressPct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

  return (
    <div className="page">
      <h1 className="page-title">{session.name}</h1>
      <p className="page-subtitle">In progress</p>

      {totalSets > 0 && (
        <div className="session-progress" aria-label={`${doneSets} of ${totalSets} sets logged`}>
          <div className="session-progress-track">
            <div className="session-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="session-progress-label">
            {doneSets} / {totalSets} sets · {progressPct}%
          </span>
        </div>
      )}

      {!isOnline && (
        <p className="sync-banner sync-offline">You're offline — entries are kept on this device and will save once you're back online.</p>
      )}
      {isOnline && pendingCount > 0 && (
        <p className="sync-banner sync-pending">Syncing {pendingCount} unsaved {pendingCount === 1 ? 'change' : 'changes'}…</p>
      )}

      {restTimer && (
        <RestTimer
          durationSeconds={restTimer.seconds}
          resetKey={restTimer.key}
          onDismiss={() => setRestTimer(null)}
        />
      )}

      <ul className="plain-list">
        {exercises.map((exercise) => (
          <SessionExerciseEditor
            key={exercise.id}
            sessionId={session.id}
            exercise={exercise}
            onChanged={onChanged}
            onSetCompleted={startRestTimer}
          />
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

      <div className="finish-row">
        <button className="button-primary button-large" onClick={() => finish.mutate()} disabled={finish.isPending}>
          {finish.isPending ? 'Finishing…' : 'Finish Workout'}
        </button>
        <button className="button-ghost-muted" onClick={() => abandon.mutate()} disabled={abandon.isPending}>
          Abandon workout
        </button>
      </div>
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
