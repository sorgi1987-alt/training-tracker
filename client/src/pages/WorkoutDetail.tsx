import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { Plan, PlanExercise, PlanSet } from '../types/plan';
import type { Exercise } from '../types/exercise';

function reordered<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...items];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

export function WorkoutDetail() {
  const { planId, workoutId } = useParams<{ planId: string; workoutId: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['plan', planId],
    queryFn: () => apiFetch<{ plan: Plan }>(`/plans/${planId}`),
    enabled: Boolean(planId)
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['plan', planId] });
  }

  const reorderExercises = useMutation({
    mutationFn: (exerciseIds: string[]) =>
      apiFetch(`/plans/${planId}/workouts/${workoutId}/exercises/reorder`, {
        method: 'POST',
        body: JSON.stringify({ exerciseIds })
      }),
    onSuccess: invalidate
  });

  const deleteExercise = useMutation({
    mutationFn: (planExerciseId: string) =>
      apiFetch(`/plans/${planId}/workouts/${workoutId}/exercises/${planExerciseId}`, { method: 'DELETE' }),
    onSuccess: invalidate
  });

  if (isLoading) return <div className="page page-subtitle">Loading…</div>;
  if (isError || !data) return <div className="page page-subtitle">Workout not found.</div>;

  const workout = data.plan.workouts?.find((w) => w.id === workoutId);
  if (!workout) return <div className="page page-subtitle">Workout not found.</div>;

  function moveExercise(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (!workout || target < 0 || target >= workout.exercises.length) return;
    reorderExercises.mutate(reordered(workout.exercises, index, target).map((e) => e.id));
  }

  return (
    <div className="page">
      <Link to={`/plans/${planId}`} className="back-link">
        ‹ {data.plan.name}
      </Link>
      <h1 className="page-title">{workout.name}</h1>
      {workout.notes && <p className="page-subtitle">{workout.notes}</p>}

      <ul className="plain-list">
        {workout.exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            planId={planId!}
            workoutId={workoutId!}
            exercise={exercise}
            isFirst={index === 0}
            isLast={index === workout.exercises.length - 1}
            onMoveUp={() => moveExercise(index, -1)}
            onMoveDown={() => moveExercise(index, 1)}
            onDelete={() => deleteExercise.mutate(exercise.id)}
            onChanged={invalidate}
          />
        ))}
      </ul>

      <AddExercise planId={planId!} workoutId={workoutId!} onAdded={invalidate} />
    </div>
  );
}

function AddExercise({
  planId,
  workoutId,
  onAdded
}: {
  planId: string;
  workoutId: string;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);

  const { data } = useQuery({
    queryKey: ['exercises', debouncedSearch],
    queryFn: () => apiFetch<{ exercises: Exercise[] }>(`/exercises?q=${encodeURIComponent(debouncedSearch)}`),
    enabled: debouncedSearch.length > 0
  });

  const addExercise = useMutation({
    mutationFn: (exerciseId: string) =>
      apiFetch(`/plans/${planId}/workouts/${workoutId}/exercises`, {
        method: 'POST',
        body: JSON.stringify({ exerciseId })
      }),
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
                <span className="exercise-list-meta">
                  {[exercise.primaryMuscle, exercise.equipment].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExerciseCard({
  planId,
  workoutId,
  exercise,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onChanged
}: {
  planId: string;
  workoutId: string;
  exercise: PlanExercise;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const basePath = `/plans/${planId}/workouts/${workoutId}/exercises/${exercise.id}`;

  const addSet = useMutation({
    mutationFn: () => apiFetch(`${basePath}/sets`, { method: 'POST', body: JSON.stringify({ type: 'working' }) }),
    onSuccess: onChanged
  });

  const updateSet = useMutation({
    mutationFn: ({ setId, patch }: { setId: string; patch: Partial<PlanSet> }) =>
      apiFetch(`${basePath}/sets/${setId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: onChanged
  });

  const deleteSet = useMutation({
    mutationFn: (setId: string) => apiFetch(`${basePath}/sets/${setId}`, { method: 'DELETE' }),
    onSuccess: onChanged
  });

  return (
    <li className="card">
      <div className="reorderable-row-main-static">
        <span className="exercise-list-name">{exercise.exerciseName ?? 'Unknown exercise'}</span>
        <span className="exercise-list-meta">
          {[exercise.exercisePrimaryMuscle, exercise.exerciseEquipment].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="reorderable-row-controls">
        <button className="icon-button" onClick={onMoveUp} disabled={isFirst} aria-label="Move up">
          ↑
        </button>
        <button className="icon-button" onClick={onMoveDown} disabled={isLast} aria-label="Move down">
          ↓
        </button>
        <button className="icon-button" onClick={onDelete} aria-label="Remove exercise">
          ✕
        </button>
      </div>

      <ul className="plain-list">
        {exercise.sets.map((set, index) => (
          <li key={set.id} className="set-row">
            <span className="set-row-index">{index + 1}</span>
            <select
              className="set-input set-type"
              defaultValue={set.type}
              onChange={(e) => updateSet.mutate({ setId: set.id, patch: { type: e.target.value } })}
            >
              <option value="warmup">Warm-up</option>
              <option value="working">Working</option>
              <option value="backoff">Backoff</option>
              <option value="dropset">Dropset</option>
              <option value="failure">Failure</option>
              <option value="other">Other</option>
            </select>
            <input
              className="set-input"
              type="number"
              placeholder="Reps min"
              defaultValue={set.targetRepsMin ?? ''}
              onBlur={(e) =>
                updateSet.mutate({ setId: set.id, patch: { targetRepsMin: e.target.value === '' ? null : Number(e.target.value) } })
              }
            />
            <input
              className="set-input"
              type="number"
              placeholder="Reps max"
              defaultValue={set.targetRepsMax ?? ''}
              onBlur={(e) =>
                updateSet.mutate({ setId: set.id, patch: { targetRepsMax: e.target.value === '' ? null : Number(e.target.value) } })
              }
            />
            <input
              className="set-input"
              type="number"
              placeholder="kg"
              defaultValue={set.targetWeight ?? ''}
              onBlur={(e) =>
                updateSet.mutate({ setId: set.id, patch: { targetWeight: e.target.value === '' ? null : Number(e.target.value) } })
              }
            />
            <button className="icon-button" onClick={() => deleteSet.mutate(set.id)} aria-label="Remove set">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button className="button-secondary" onClick={() => addSet.mutate()} disabled={addSet.isPending}>
        + Add set
      </button>
    </li>
  );
}
