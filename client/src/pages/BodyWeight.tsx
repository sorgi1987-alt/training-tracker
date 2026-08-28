import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import type { BodyMeasurement } from '../types/measurement';

// Deliberately simple per spec section 22 — weight + optional note, a
// basic reverse-chronological list. No charting, no other measurement
// types yet ("do not overbuild these measurements now").
export function BodyWeight() {
  const queryClient = useQueryClient();
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['measurements'],
    queryFn: () => apiFetch<{ measurements: BodyMeasurement[] }>('/measurements')
  });

  const addMeasurement = useMutation({
    mutationFn: () =>
      apiFetch<{ measurement: BodyMeasurement }>('/measurements', {
        method: 'POST',
        body: JSON.stringify({ weight: Number(weight), note: note || undefined })
      }),
    onSuccess: () => {
      setWeight('');
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
    }
  });

  const deleteMeasurement = useMutation({
    mutationFn: (id: string) => apiFetch(`/measurements/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['measurements'] })
  });

  return (
    <div className="page">
      <Link to="/more" className="back-link">
        ‹ More
      </Link>
      <h1 className="page-title">Body weight</h1>

      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (weight.trim()) addMeasurement.mutate();
        }}
      >
        <input
          className="text-input"
          type="number"
          step="0.1"
          placeholder="kg"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          required
        />
        <input
          className="text-input"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="button-secondary" type="submit" disabled={addMeasurement.isPending}>
          Log
        </button>
      </form>

      {isLoading && <p className="page-subtitle">Loading…</p>}
      {isError && <p className="page-subtitle">Could not load body weight history.</p>}
      {data && data.measurements.length === 0 && <p className="page-subtitle">No entries yet.</p>}

      <ul className="history-list">
        {data?.measurements.map((entry) => (
          <li key={entry.id} className="history-row">
            <span className="history-date">{new Date(entry.recordedTime).toLocaleDateString()}</span>
            <span>
              {entry.weight} kg{entry.note ? ` — ${entry.note}` : ''}
            </span>
            <button className="icon-button" onClick={() => deleteMeasurement.mutate(entry.id)} aria-label="Delete entry">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
