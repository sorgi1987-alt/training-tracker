import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Home', end: true },
  { to: '/workout', label: 'Workout' },
  { to: '/history', label: 'History' },
  { to: '/exercises', label: 'Exercises' },
  { to: '/more', label: 'More' }
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' is-active' : ''}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
