import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { Exercise } from '../types/exercise';
import type { Plan } from '../types/plan';
import type { ImportExercisePreview, ImportValidateResponse } from '../types/planImport';

interface Resolution {
  exerciseId?: string;
  exerciseName?: string;
  createExerciseName?: string;
}

// Spec section 23's required workflow: Paste JSON -> Validate -> Match
// Exercises -> Preview -> Save. Nothing is written until the user has
// resolved every exercise and hits Import.
export function ImportPlan() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportValidateResponse | null>(null);
  const [resolutions, setResolutions] = useState<Resolution[][]>([]);

  const validate = useMutation({
    mutationFn: (doc: unknown) =>
      apiFetch<ImportValidateResponse>('/plans/import/validate', { method: 'POST', body: JSON.stringify(doc) }),
    onSuccess: (data) => {
      setPreview(data);
      setResolutions(
        data.workouts.map((workout) =>
          workout.exercises.map((exercise) =>
            exercise.match ? { exerciseId: exercise.match.exerciseId, exerciseName: exercise.match.name } : {}
          )
        )
      );
    }
  });

  const importPlan = useMutation({
    mutationFn: (payload: unknown) => apiFetch<{ plan: Plan }>('/plans/import', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: ({ plan }) => navigate(`/plans/${plan.id}`)
  });

  function handleValidate() {
    setParseError(null);
    setPreview(null);
    let doc: unknown;
    try {
      doc = JSON.parse(raw);
    } catch {
      setParseError('Malformed JSON — check the pasted text.');
      return;
    }
    validate.mutate(doc);
  }

  function setResolution(workoutIndex: number, exerciseIndex: number, resolution: Resolution) {
    setResolutions((prev) => {
      const next = prev.map((row) => row.slice());
      next[workoutIndex][exerciseIndex] = resolution;
      return next;
    });
  }

  const allResolved =
    preview !== null &&
    preview.errors.length === 0 &&
    resolutions.every((row) => row.every((resolution) => resolution.exerciseId || resolution.createExerciseName));

  function handleImport() {
    if (!preview) return;
    const payload = {
      name: preview.plan.name,
      description: preview.plan.description,
      durationWeeks: preview.plan.durationWeeks,
      startDate: preview.plan.startDate,
      workouts: preview.workouts.map((workout, workoutIndex) => ({
        name: workout.name,
        description: workout.description,
        notes: workout.notes,
        estimatedDurationMinutes: workout.estimatedDurationMinutes,
        exercises: workout.exercises.map((exercise, exerciseIndex) => {
          const resolution = resolutions[workoutIndex][exerciseIndex];
          return {
            exerciseId: resolution.exerciseId,
            createExerciseName: resolution.createExerciseName,
            restSeconds: exercise.restSeconds,
            notes: exercise.notes,
            sets: exercise.sets
          };
        })
      }))
    };
    importPlan.mutate(payload);
  }

  return (
    <div className="page">
      <Link to="/plans" className="back-link">
        ‹ Plans
      </Link>
      <h1 className="page-title">Import plan from JSON</h1>

      {!preview && (
        <>
          <textarea
            className="text-input json-textarea"
            rows={10}
            placeholder="Paste plan JSON here"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          {parseError && <p className="form-error">{parseError}</p>}
          {validate.isError && !parseError && <p className="form-error">Could not validate this plan.</p>}
          <button className="button-primary" onClick={handleValidate} disabled={validate.isPending || !raw.trim()}>
            {validate.isPending ? 'Validating…' : 'Validate'}
          </button>
        </>
      )}

      {preview && (
        <>
          {preview.errors.length > 0 && (
            <section className="card">
              <h2 className="card-title">Fix these before importing</h2>
              <ul className="pr-list">
                {preview.errors.map((error, index) => (
                  <li key={index} className="form-error">
                    {error}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2 className="card-title">{preview.plan.name || '(untitled plan)'}</h2>
            <p className="page-subtitle">
              {preview.plan.durationWeeks} weeks{preview.plan.startDate && ` · starts ${preview.plan.startDate}`}
            </p>
          </section>

          {preview.workouts.map((workout, workoutIndex) => (
            <section className="card" key={workoutIndex}>
              <h2 className="card-title">{workout.name || `Workout ${workoutIndex + 1}`}</h2>
              <ul className="plain-list">
                {workout.exercises.map((exercise, exerciseIndex) => (
                  <ImportExerciseRow
                    key={exerciseIndex}
                    exercise={exercise}
                    resolution={resolutions[workoutIndex]?.[exerciseIndex] ?? {}}
                    onResolve={(resolution) => setResolution(workoutIndex, exerciseIndex, resolution)}
                  />
                ))}
              </ul>
            </section>
          ))}

          <div className="action-row">
            <button className="button-primary" onClick={handleImport} disabled={!allResolved || importPlan.isPending}>
              {importPlan.isPending ? 'Importing…' : 'Import Plan'}
            </button>
            <button className="button-secondary" onClick={() => setPreview(null)}>
              Start over
            </button>
          </div>
          {importPlan.isError && <p className="form-error">Could not import this plan.</p>}
        </>
      )}
    </div>
  );
}

function ImportExerciseRow({
  exercise,
  resolution,
  onResolve
}: {
  exercise: ImportExercisePreview;
  resolution: Resolution;
  onResolve: (resolution: Resolution) => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [showPicker, setShowPicker] = useState(!exercise.match);

  const { data } = useQuery({
    queryKey: ['exercises', debouncedSearch],
    queryFn: () => apiFetch<{ exercises: Exercise[] }>(`/exercises?q=${encodeURIComponent(debouncedSearch)}`),
    enabled: debouncedSearch.length > 0 && showPicker
  });

  const resolved = Boolean(resolution.exerciseId || resolution.createExerciseName);

  return (
    <li className="import-exercise-row">
      <div className="reorderable-row-main-static">
        <span className="exercise-list-name">{exercise.importName}</span>
        {resolution.exerciseName && (
          <span className="exercise-list-meta">
            Matched: {resolution.exerciseName}
            {exercise.match && ` (${exercise.match.matchType})`}
          </span>
        )}
        {resolution.createExerciseName && <span className="exercise-list-meta">Will create as a new exercise</span>}
        {!resolved && <span className="form-error">Unresolved — pick a match or create new</span>}
      </div>

      {(!resolved || showPicker) && (
        <>
          <input
            className="text-input"
            placeholder="Search exercise library"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {data && data.exercises.length > 0 && (
            <ul className="picker-list">
              {data.exercises.map((ex) => (
                <li key={ex.id}>
                  <button
                    className="picker-item"
                    onClick={() => {
                      onResolve({ exerciseId: ex.id, exerciseName: ex.name });
                      setShowPicker(false);
                    }}
                  >
                    {ex.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="button-secondary"
            onClick={() => {
              onResolve({ createExerciseName: exercise.importName });
              setShowPicker(false);
            }}
          >
            + Create "{exercise.importName}" as a new exercise
          </button>
        </>
      )}

      {resolved && !showPicker && (
        <button className="button-secondary" onClick={() => setShowPicker(true)}>
          Change
        </button>
      )}
    </li>
  );
}
