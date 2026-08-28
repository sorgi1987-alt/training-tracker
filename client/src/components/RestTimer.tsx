import { useEffect, useState } from 'react';

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Spec section 18: simple rest timer, must never block navigation within
// the workout — rendered as a small floating banner, not a modal. `resetKey`
// changing (bumped by the parent whenever a set is marked complete)
// restarts the countdown at `durationSeconds`.
export function RestTimer({
  durationSeconds,
  resetKey,
  onDismiss
}: {
  durationSeconds: number;
  resetKey: number;
  onDismiss: () => void;
}) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setRemaining(durationSeconds);
    setPaused(false);
  }, [resetKey, durationSeconds]);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paused, resetKey]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = durationSeconds > 0 ? remaining / durationSeconds : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const isDone = remaining === 0;

  return (
    <div className={`rest-timer${isDone ? ' is-done' : ''}`}>
      <div className="rest-timer-ring-wrap">
        <svg className="rest-timer-ring" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r={RADIUS} className="rest-timer-ring-track" />
          <circle
            cx="30"
            cy="30"
            r={RADIUS}
            className="rest-timer-ring-progress"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="rest-timer-time">
          {isDone ? 'Go' : `${minutes}:${String(seconds).padStart(2, '0')}`}
        </span>
      </div>
      <div className="rest-timer-controls">
        <button className="button-secondary" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button className="button-secondary" onClick={() => setRemaining((r) => r + 15)}>
          +15s
        </button>
        <button className="button-secondary" onClick={onDismiss}>
          Skip
        </button>
      </div>
    </div>
  );
}
