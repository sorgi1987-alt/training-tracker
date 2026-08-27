import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { Exercise } from '../types/exercise';

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

      <ul className="exercise-list">
        {data?.exercises.map((exercise) => (
          <li key={exercise.id}>
            <Link to={`/exercises/${exercise.id}`} className="exercise-list-item">
              <span className="exercise-list-name">{exercise.name}</span>
              <span className="exercise-list-meta">
                {[exercise.primaryMuscle, exercise.equipment].filter(Boolean).join(' · ')}
                {exercise.isOwn && ' · Yours'}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {data && data.exercises.length === 0 && <p className="page-subtitle">No exercises found.</p>}
    </div>
  );
}
