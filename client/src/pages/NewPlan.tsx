import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import type { Plan } from '../types/plan';

export function NewPlan() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationWeeks, setDurationWeeks] = useState('8');
  const [startDate, setStartDate] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ plan: Plan }>('/plans', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          durationWeeks: Number(durationWeeks),
          startDate: startDate || null
        })
      }),
    onSuccess: ({ plan }) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      navigate(`/plans/${plan.id}`);
    }
  });

  return (
    <div className="page">
      <Link to="/plans" className="back-link">
        ‹ Plans
      </Link>
      <h1 className="page-title">New training plan</h1>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label className="form-field">
          Name
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label className="form-field">
          Description
          <textarea
            className="text-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>

        <label className="form-field">
          Duration (weeks)
          <input
            className="text-input"
            type="number"
            min={1}
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(e.target.value)}
            required
          />
        </label>

        <label className="form-field">
          Start date (optional)
          <input
            className="text-input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>

        {mutation.isError && <p className="form-error">Could not create this plan.</p>}

        <button className="button-primary" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create plan'}
        </button>
      </form>
    </div>
  );
}
