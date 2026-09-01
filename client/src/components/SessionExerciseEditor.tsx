import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { recordPendingSetPatch, clearPendingSetPatch } from '../lib/offlineDraft';
import { Stepper } from './Stepper';
import { CheckIcon } from './icons';
import type { SessionExercise, SessionSet } from '../types/session';
import type { Exercise } from '../types/exercise';

// Shown before a set is completed so people know what to aim for; once
// completed, the progression badge (if any) takes over the same slot.
function formatTargetReps(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return min === max ? `${min} reps` : `${min}–${max} reps`;
  if (min !== null) return `${min}+ reps`;
  if (max !== null) return `up to ${max} reps`;
  return null;
}

const SET_TYPE_LABELS: Record<string, string> = {
  warmup: 'Warm-up',
  working: 'Working',
  backoff: 'Backoff',
  dropset: 'Dropset',
  failure: 'Failure',
  other: 'Other'
};

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
  allowSubstitute = true,
  onSetCompleted
}: {
  sessionId: string;
  exercise: SessionExercise;
  onChanged: () => void;
  allowSubstitute?: boolean;
  // Only passed by the active workout screen — starts the rest timer.
  // History editing (SessionDetail) omits this; correcting a past set
  // shouldn't kick off a rest countdown.
  onSetCompleted?: (restSeconds: number) => void;
}) {
  const [showSubstitute, setShowSubstitute] = useState(false);
  const basePath = `/sessions/${sessionId}/exercises/${exercise.id}`;

  const addSet = useMutation({
    mutationFn: () => apiFetch(`${basePath}/sets`, { method: 'POST', body: JSON.stringify({ type: 'working' }) }),
    onSuccess: onChanged
  });

  const updateSet = useMutation({
    // Record the intended value before attempting the network call — if it
    // fails (offline), the draft survives a refresh; if it succeeds, it's
    // cleared immediately below (spec section 20).
    mutationFn: ({ setId, patch }: { setId: string; patch: Record<string, unknown> }) => {
      recordPendingSetPatch(sessionId, exercise.id, setId, patch);
      return apiFetch(`${basePath}/sets/${setId}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    onSuccess: (_data, { setId }) => {
      clearPendingSetPatch(sessionId, setId);
      onChanged();
    }
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

  const doneCount = exercise.sets.filter((s) => s.completed).length;

  return (
    <li className={`exercise-card${exercise.skipped ? ' is-skipped' : ''}`}>
      <div className="exercise-card-header">
        <div className="reorderable-row-main-static">
          <span className="exercise-list-name">{exercise.actualExerciseName ?? 'Unknown exercise'}</span>
          {exercise.substituted && exercise.plannedExerciseName && (
            <span className="exercise-list-meta">Substituted for {exercise.plannedExerciseName}</span>
          )}
        </div>
        {exercise.sets.length > 0 && (
          <div className="set-progress-dots" aria-label={`${doneCount} of ${exercise.sets.length} sets logged`}>
            {exercise.sets.map((set) => (
              <span
                key={set.id}
                className={`set-dot${set.completed ? ' is-done' : ''}${set.skipped ? ' is-skipped' : ''}`}
              />
            ))}
          </div>
        )}
      </div>

      {exercise.previousPerformance.length > 0 && (
        <p className="previous-performance">
          Previous: {exercise.previousPerformance.map((set) => `${set.weight ?? '–'} kg × ${set.reps ?? '–'}`).join(', ')}
        </p>
      )}

      <ul className="set-list">
        {exercise.sets.map((set, index) => (
          <SetRow
            key={set.id}
            set={set}
            index={index}
            onUpdate={(patch) => updateSet.mutate({ setId: set.id, patch })}
            onDelete={() => deleteSet.mutate(set.id)}
            onCompleted={() => onSetCompleted?.(exercise.restSeconds ?? 90)}
          />
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

function SetRow({
  set,
  index,
  onUpdate,
  onDelete,
  onCompleted
}: {
  set: SessionSet;
  index: number;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onCompleted: () => void;
}) {
  const [weight, setWeight] = useState(set.weight);
  const [reps, setReps] = useState(set.reps);

  const hitTarget = set.completed && set.targetRepsMax !== null && (set.reps ?? -Infinity) >= set.targetRepsMax;
  const targetLabel = formatTargetReps(set.targetRepsMin, set.targetRepsMax);

  function toggleComplete() {
    const next = !set.completed;
    onUpdate({ completed: next });
    if (next) onCompleted();
  }

  return (
    <li className={`set-row set-row-${set.type}${set.completed ? ' is-complete' : ''}${set.skipped ? ' is-skipped' : ''}`}>
      <div className="set-row-top">
        <span className="set-index-badge">{index + 1}</span>
        <span className={`set-type-chip set-type-chip-${set.type}`}>{SET_TYPE_LABELS[set.type] ?? set.type}</span>
        {!set.completed && targetLabel && <span className="set-target-label">{targetLabel}</span>}
        {hitTarget && (
          <span className="progression-badge" title="Hit the top of the target rep range">
            🔼 add weight next time
          </span>
        )}
        <div className="set-row-icon-actions">
          <button className="icon-button" onClick={() => onUpdate({ skipped: !set.skipped })} aria-label="Toggle skip set">
            ⤫
          </button>
          <button className="icon-button" onClick={onDelete} aria-label="Remove set">
            ✕
          </button>
        </div>
      </div>

      <div className="set-row-body">
        <Stepper
          value={weight}
          onChange={setWeight}
          onCommit={(value) => onUpdate({ weight: value })}
          step={2.5}
          suffix="kg"
          placeholder="0"
          ariaLabel={`Set ${index + 1} weight`}
        />
        <Stepper
          value={reps}
          onChange={setReps}
          onCommit={(value) => onUpdate({ reps: value })}
          step={1}
          suffix="reps"
          placeholder="0"
          ariaLabel={`Set ${index + 1} reps`}
        />
        <button
          type="button"
          className={`set-complete-toggle${set.completed ? ' is-complete' : ''}`}
          onClick={toggleComplete}
          aria-pressed={set.completed}
          aria-label={set.completed ? 'Mark set incomplete' : 'Mark set complete'}
        >
          <CheckIcon className="set-complete-icon" />
        </button>
      </div>
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
