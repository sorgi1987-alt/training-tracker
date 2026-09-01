import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { TrendChart } from '../components/TrendChart';
import type { BodyMeasurement } from '../types/measurement';

// Deliberately simple per spec section 22 — weight + optional note, a
// basic reverse-chronological list, plus a lightweight trend chart. No
// other measurement types yet ("do not overbuild these measurements now").
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

      <section className="card">
        <h2 className="card-title">Log today's weight</h2>
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
      </section>

      {isLoading && <p className="page-subtitle">Loading…</p>}
      {isError && <p className="page-subtitle">Could not load body weight history.</p>}
      {data && data.measurements.length === 0 && <p className="empty-state">No entries yet.</p>}

      {data && data.measurements.length > 1 && (
        <section className="card">
          <h2 className="card-title">Trend</h2>
          <TrendChart
            points={[...data.measurements]
              .reverse()
              .map((entry) => ({ date: entry.recordedTime, value: entry.weight }))}
            unit=" kg"
            color="var(--color-completed)"
          />
        </section>
      )}

      {data && data.measurements.length > 0 && (
        <div className="list-card">
          <ul className="list-rows">
            {data.measurements.map((entry) => (
              <li key={entry.id}>
                <div className="list-row">
                  <span className="list-row-icon-wrap">
                    <span className="body-weight-value">{entry.weight}</span>
                  </span>
                  <span className="list-row-body">
                    <span className="list-row-title">{entry.weight} kg</span>
                    <span className="list-row-meta">
                      <span>{new Date(entry.recordedTime).toLocaleDateString()}</span>
                      {entry.note && <span>{entry.note}</span>}
                    </span>
                  </span>
                  <button className="icon-button" onClick={() => deleteMeasurement.mutate(entry.id)} aria-label="Delete entry">
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
