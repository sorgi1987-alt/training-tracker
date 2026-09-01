import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../lib/apiClient';
import type { Exercise } from '../types/exercise';

export function NewExercise() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [instructions, setInstructions] = useState('');
  const [duplicate, setDuplicate] = useState<Exercise | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ exercise: Exercise }>('/exercises', {
        method: 'POST',
        body: JSON.stringify({ name, primaryMuscle, equipment, instructions })
      }),
    onSuccess: ({ exercise }) => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      navigate(`/exercises/${exercise.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { exercise?: Exercise };
        setDuplicate(body.exercise ?? null);
      }
    }
  });

  return (
    <div className="page">
      <Link to="/exercises" className="back-link">
        ‹ Exercises
      </Link>
      <h1 className="page-title">Add custom exercise</h1>

      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          setDuplicate(null);
          mutation.mutate();
        }}
      >
        <label className="form-field">
          Name
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="form-field">
          Primary muscle
          <input
            className="text-input"
            value={primaryMuscle}
            onChange={(e) => setPrimaryMuscle(e.target.value)}
            placeholder="e.g. chest"
          />
        </label>

        <label className="form-field">
          Equipment
          <input
            className="text-input"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            placeholder="e.g. dumbbell"
          />
        </label>

        <label className="form-field">
          Instructions
          <textarea
            className="text-input"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
          />
        </label>

        {duplicate && (
          <p className="form-error">
            An exercise called <strong>{duplicate.name}</strong> already exists.{' '}
            <Link to={`/exercises/${duplicate.id}`}>View it</Link> instead, or change the name above.
          </p>
        )}
        {mutation.isError && !duplicate && <p className="form-error">Could not save this exercise.</p>}

        <button className="button-primary" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save exercise'}
        </button>
      </form>
    </div>
  );
}
