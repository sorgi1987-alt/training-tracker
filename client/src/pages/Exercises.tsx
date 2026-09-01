import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { DumbbellIcon, ChevronRightIcon } from '../components/icons';
import type { Exercise } from '../types/exercise';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export function Exercises() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['exercises', debouncedSearch],
    queryFn: () =>
      apiFetch<{ exercises: Exercise[] }>(
        `/exercises${debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : ''}`
      )
  });

  return (
    <div className="page">
      <h1 className="page-title">Exercises</h1>

      <input
        className="text-input"
        type="search"
        inputMode="search"
        placeholder="Search exercises"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search exercises"
      />

      <Link to="/exercises/new" className="button-secondary exercises-add-link">
        + Add custom exercise
      </Link>

      {isLoading && <p className="page-subtitle">Loading…</p>}
      {isError && <p className="page-subtitle">Could not load exercises.</p>}

      {data && data.exercises.length > 0 && (
        <div className="list-card">
          <ul className="list-rows">
            {data.exercises.map((exercise) => (
              <li key={exercise.id}>
                <Link to={`/exercises/${exercise.id}`} className="list-row">
                  <span className="list-row-icon-wrap">
                    <DumbbellIcon className="list-row-icon" />
                  </span>
                  <span className="list-row-body">
                    <span className="list-row-title">{exercise.name}</span>
                    <span className="list-row-meta">
                      {exercise.primaryMuscle && <span className="meta-chip">{formatLabel(exercise.primaryMuscle)}</span>}
                      {exercise.equipment && <span className="meta-chip">{formatLabel(exercise.equipment)}</span>}
                      {exercise.isOwn && <span className="meta-chip">Yours</span>}
                    </span>
                  </span>
                  <ChevronRightIcon className="list-row-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && data.exercises.length === 0 && (
        <p className="empty-state">No exercises found.</p>
      )}
    </div>
  );
}
