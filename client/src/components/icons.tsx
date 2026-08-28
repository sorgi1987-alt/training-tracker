// Small stroke-based icon set for the bottom nav — inline SVG, no external
// icon font/dependency, inherits color via currentColor so active/inactive
// styling is pure CSS.
type IconProps = { className?: string };

export function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 11.5 12 4l8 7.5M6 9.5V19a1 1 0 0 0 1 1h3.5v-5a1.5 1.5 0 0 1 1.5-1.5v0A1.5 1.5 0 0 1 13.5 15v5H17a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DumbbellIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.5 9v6M4 10.5v3M17.5 9v6M20 10.5v3M8.5 12h7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="5.5" y="7.5" width="2.5" height="9" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="16" y="7.5" width="2.5" height="9" rx="1" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function HistoryIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 7v5.5l3.5 2M20 12a8 8 0 1 1-2.34-5.66"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 4v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 6.5h11M8 12h11M8 17.5h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="4.3" cy="6.5" r="1.1" fill="currentColor" />
      <circle cx="4.3" cy="12" r="1.1" fill="currentColor" />
      <circle cx="4.3" cy="17.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function MoreIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12.5 9.5 17 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function MinusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
