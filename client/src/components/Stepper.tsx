import { MinusIcon, PlusIcon } from './icons';

// Tap-to-adjust numeric control for logging weight/reps mid-workout —
// typing on a number pad works too, but +/- is faster and more tactile for
// one-handed use between sets (spec section 27: minimal typing, easy
// one-handed operation). `onChange` updates what's displayed immediately;
// `onCommit` is when the value should actually be saved — instantly for a
// +/- tap (one discrete, exact intent), on blur for typed input (so a
// half-typed number doesn't fire a save per keystroke).
export function Stepper({
  value,
  onChange,
  onCommit,
  step,
  min = 0,
  suffix,
  placeholder,
  ariaLabel
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  onCommit: (value: number | null) => void;
  step: number;
  min?: number;
  suffix?: string;
  placeholder?: string;
  ariaLabel: string;
}) {
  function bump(delta: number) {
    const base = value ?? 0;
    const next = Math.max(min, Math.round((base + delta) * 100) / 100);
    onChange(next);
    onCommit(next);
  }

  return (
    <div className="stepper">
      <button type="button" className="stepper-btn" onClick={() => bump(-step)} aria-label={`Decrease ${ariaLabel}`}>
        <MinusIcon className="stepper-icon" />
      </button>
      <div className="stepper-value-wrap">
        <input
          className="stepper-value"
          type="number"
          inputMode="decimal"
          placeholder={placeholder}
          value={value ?? ''}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          onBlur={() => onCommit(value)}
        />
        {suffix && <span className="stepper-suffix">{suffix}</span>}
      </div>
      <button type="button" className="stepper-btn" onClick={() => bump(step)} aria-label={`Increase ${ariaLabel}`}>
        <PlusIcon className="stepper-icon" />
      </button>
    </div>
  );
}
