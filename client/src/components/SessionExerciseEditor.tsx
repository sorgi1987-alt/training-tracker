import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { SessionExercise } from '../types/session';
import type { Exercise } from '../types/exercise';

// Shared between the active workout screen and a historical session's edit
// view — spec section 9 requires completed sessions to stay just as
// correctable (weights, reps, notes, skipped, sets) as an in-progress one.
// `allowSubstitute` is the one behavioral difference: substituting an
// exercise is a during-the-workout action (section 12), not something the
// spec asks for when correcting history afterwards.
export function SessionExerciseEditor({
  sessionId,
  exercise,
  onChanged,
  allowSubstitute = true
}: {
  sessionId: string;
  exercise: SessionExercise;
  onChanged: () => void;
  allowSubstitute?: boolean;
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
        {allowSubstitute && (
          <button className="button-secondary" onClick={() => setShowSubstitute((v) => !v)}>
            Substitute
          </button>
        )}
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
