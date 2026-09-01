import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { TrendChart } from '../components/TrendChart';
import { PlayIcon } from '../components/icons';
import type { Exercise } from '../types/exercise';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

// No YouTube API key/credentials are wired up, so rather than fabricate a
// specific video link (which could easily be wrong or dead), this links out
// to a live YouTube search for the exercise — always resolves to real,
// current results.
function youtubeSearchUrl(exerciseName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} exercise proper form tutorial`)}`;
}

interface ExerciseHistoryEntry {
  sessionId: string;
  date: string;
  sets: { weight: number | null; reps: number | null; type: string }[];
}

interface ExerciseTrendPoint {
  date: string;
  estimated1RM: number;
  volume: number;
}

interface PersonalRecords {
  highestWeight: number | null;
  repsAtHighestWeight: number | null;
  bestEstimated1RM: number | null;
  estimated1RMFormula: string;
  highestSessionVolume: number | null;
}

export function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['exercise', id],
    queryFn: () => apiFetch<{ exercise: Exercise }>(`/exercises/${id}`),
    enabled: Boolean(id)
  });

  const history = useQuery({
    queryKey: ['exercise-history', id],
    queryFn: () =>
      apiFetch<{ history: ExerciseHistoryEntry[]; trend: ExerciseTrendPoint[]; personalRecords: PersonalRecords }>(
        `/exercises/${id}/history`
      ),
    enabled: Boolean(id)
  });

  if (isLoading) return <div className="page page-subtitle">Loading…</div>;
  if (isError || !data) return <div className="page page-subtitle">Exercise not found.</div>;

  const { exercise } = data;
  const records = history.data?.personalRecords;
  const hasRecords = records && (records.highestWeight !== null || records.bestEstimated1RM !== null);

  return (
    <div className="page">
      <Link to="/exercises" className="back-link">
        ‹ Exercises
      </Link>
      <div className="detail-header">
        <h1 className="page-title">{exercise.name}</h1>
        <div className="detail-chips">
          {exercise.primaryMuscle && <span className="meta-chip">{formatLabel(exercise.primaryMuscle)}</span>}
          {exercise.equipment && <span className="meta-chip">{formatLabel(exercise.equipment)}</span>}
          {exercise.category && <span className="meta-chip">{formatLabel(exercise.category)}</span>}
        </div>
      </div>

      <a className="video-link" href={youtubeSearchUrl(exercise.name)} target="_blank" rel="noopener noreferrer">
        <PlayIcon className="video-link-icon" />
        Watch tutorials on YouTube
      </a>

      {exercise.secondaryMuscles.length > 0 && (
        <section className="card">
          <h2 className="card-title">Also works</h2>
          <div className="detail-chips">
            {exercise.secondaryMuscles.map((muscle) => (
              <span className="meta-chip" key={muscle}>
                {formatLabel(muscle)}
              </span>
            ))}
          </div>
        </section>
      )}

      {exercise.instructions && (
        <section className="card">
          <h2 className="card-title">How to perform it</h2>
          <p>{exercise.instructions}</p>
        </section>
      )}

      {history.data && history.data.trend.length > 1 && (
        <section className="card">
          <h2 className="card-title">Estimated 1RM trend</h2>
          <TrendChart
            points={history.data.trend.map((point) => ({ date: point.date, value: point.estimated1RM }))}
            unit=" kg"
          />
        </section>
      )}

      {hasRecords && (
        <section className="card">
          <h2 className="card-title">Personal records</h2>
          <ul className="pr-list">
            {records!.highestWeight !== null && (
              <li>
                Heaviest set: <strong>{records!.highestWeight} kg × {records!.repsAtHighestWeight}</strong>
              </li>
            )}
            {records!.bestEstimated1RM !== null && (
              <li>
                Best estimated 1RM: <strong>{records!.bestEstimated1RM} kg</strong>
              </li>
            )}
            {records!.highestSessionVolume !== null && (
              <li>
                Best session volume: <strong>{records!.highestSessionVolume} kg</strong>
              </li>
            )}
          </ul>
          <p className="pr-formula">1RM estimated using {records!.estimated1RMFormula}.</p>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">History</h2>
        {history.isLoading && <p>Loading…</p>}
        {history.data && history.data.history.length === 0 && (
          <p>Your previous performances on this exercise will appear here once you log a workout.</p>
        )}
        {history.data && history.data.history.length > 0 && (
          <ul className="history-list">
            {history.data.history.map((entry) => (
              <li key={entry.sessionId} className="history-row">
                <span className="history-date">{new Date(entry.date).toLocaleDateString()}</span>
                <span>{entry.sets.map((set) => `${set.weight ?? '–'} kg × ${set.reps ?? '–'}`).join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
