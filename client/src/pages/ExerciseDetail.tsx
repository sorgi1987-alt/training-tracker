import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import type { Exercise } from '../types/exercise';

export function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['exercise', id],
    queryFn: () => apiFetch<{ exercise: Exercise }>(`/exercises/${id}`),
    enabled: Boolean(id)
  });

  if (isLoading) return <div className="page page-subtitle">Loading…</div>;
  if (isError || !data) return <div className="page page-subtitle">Exercise not found.</div>;

  const { exercise } = data;

  return (
    <div className="page">
      <Link to="/exercises" className="back-link">
        ‹ Exercises
      </Link>
      <h1 className="page-title">{exercise.name}</h1>
      <p className="page-subtitle">
        {[exercise.primaryMuscle, exercise.equipment, exercise.category].filter(Boolean).join(' · ')}
      </p>

      {exercise.secondaryMuscles.length > 0 && (
        <section className="card">
          <h2 className="card-title">Also works</h2>
          <p>{exercise.secondaryMuscles.join(', ')}</p>
        </section>
      )}

      {exercise.instructions && (
        <section className="card">
          <h2 className="card-title">Instructions</h2>
          <p>{exercise.instructions}</p>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">History</h2>
        <p>Your previous performances on this exercise will appear here once you start logging workouts.</p>
      </section>
    </div>
  );
}
