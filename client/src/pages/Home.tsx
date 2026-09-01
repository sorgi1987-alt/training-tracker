import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import type { Plan } from '../types/plan';
import type { WorkoutSession } from '../types/session';

interface SessionStats {
  completedThisMonth: number;
  currentStreakWeeks: number;
}

interface TopLift {
  exerciseId: string;
  exerciseName: string;
  timesPerformed: number;
  bestEstimated1RM: number;
}

export function Home() {
  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiFetch<{ plans: Plan[] }>('/plans')
  });

  const inProgress = useQuery({
    queryKey: ['sessions', 'in_progress'],
    queryFn: () => apiFetch<{ sessions: WorkoutSession[] }>('/sessions?status=in_progress')
  });

  const stats = useQuery({
    queryKey: ['sessions', 'stats'],
    queryFn: () => apiFetch<SessionStats>('/sessions/stats')
  });

  const topLifts = useQuery({
    queryKey: ['exercises', 'top-lifts'],
    queryFn: () => apiFetch<{ topLifts: TopLift[] }>('/exercises/top-lifts?limit=3')
  });

  const activePlan = plans.data?.plans.find((plan) => plan.status === 'active');
  const activeSession = inProgress.data?.sessions[0];
  const progress = activePlan ? planProgress(activePlan) : null;

  return (
    <div className="page">
      <h1 className="page-title">Home</h1>
      <p className="page-subtitle">Your training at a glance</p>

      {activeSession && (
        <section className="cta-card">
          <span className="cta-card-eyebrow">Workout in progress</span>
          <h2 className="cta-card-title">{activeSession.name}</h2>
          <Link className="button-primary button-large" to="/workout">
            Resume workout
          </Link>
        </section>
      )}

      {!activeSession && activePlan && (
        <section className="cta-card">
          <span className="cta-card-eyebrow">Active plan</span>
          <h2 className="cta-card-title">{activePlan.name}</h2>
          <p className="cta-card-meta">{progress ? `Week ${progress.week} of ${activePlan.durationWeeks}` : 'Ready when you are'}</p>
          <Link className="button-primary button-large" to="/workout">
            Start Workout
          </Link>
          <Link className="cta-card-link" to={`/plans/${activePlan.id}`}>
            View plan
          </Link>
        </section>
      )}

      {!activeSession && !activePlan && (
        <section className="card">
          <h2 className="card-title">Active plan</h2>
          {plans.isLoading && <p>Loading…</p>}
          {!plans.isLoading && (
            <p>
              No active plan. <Link to="/plans">Choose or create one</Link>.
            </p>
          )}
        </section>
      )}

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-value">{stats.data ? stats.data.completedThisMonth : '–'}</span>
          <span className="stat-label">{stats.data?.completedThisMonth === 1 ? 'Workout this month' : 'Workouts this month'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.data ? stats.data.currentStreakWeeks : '–'}</span>
          <span className="stat-label">Week streak</span>
        </div>
      </div>

      {activePlan && progress && (
        <section className="card">
          <h2 className="card-title">Plan progress</h2>
          <div className="session-progress">
            <div className="session-progress-track">
              <div className="session-progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <span className="session-progress-label">
              Week {progress.week} of {activePlan.durationWeeks} · {progress.percent}%
            </span>
          </div>
        </section>
      )}

      {topLifts.data && topLifts.data.topLifts.length > 0 && (
        <section className="card">
          <h2 className="card-title">Top lifts</h2>
          <ul className="top-lifts-list">
            {topLifts.data.topLifts.map((lift) => (
              <li key={lift.exerciseId}>
                <Link to={`/exercises/${lift.exerciseId}`} className="top-lift-row">
                  <span className="top-lift-name">{lift.exerciseName}</span>
                  <span className="top-lift-value">
                    {lift.bestEstimated1RM} kg <small>e1RM</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function planProgress(plan: Plan): { week: number; percent: number } | null {
  if (!plan.startDate || !plan.durationWeeks) return null;
  const start = new Date(plan.startDate).getTime();
  if (Number.isNaN(start)) return null;
  const totalDays = plan.durationWeeks * 7;
  const elapsedDays = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
  const clampedDays = Math.min(Math.max(elapsedDays, 0), totalDays);
  const week = Math.min(Math.max(Math.floor(elapsedDays / 7) + 1, 1), plan.durationWeeks);
  const percent = totalDays > 0 ? Math.round((clampedDays / totalDays) * 100) : 0;
  return { week, percent };
}
