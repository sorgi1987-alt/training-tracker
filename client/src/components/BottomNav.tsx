import { NavLink } from 'react-router-dom';
import { DumbbellIcon, HistoryIcon, HomeIcon, ListIcon, MoreIcon } from './icons';

const TABS = [
  { to: '/', label: 'Home', end: true, Icon: HomeIcon },
  { to: '/workout', label: 'Workout', Icon: DumbbellIcon },
  { to: '/history', label: 'History', Icon: HistoryIcon },
  { to: '/exercises', label: 'Exercises', Icon: ListIcon },
  { to: '/more', label: 'More', Icon: MoreIcon }
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map(({ to, label, end, Icon }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `bottom-nav-item${isActive ? ' is-active' : ''}`}>
          <span className="bottom-nav-icon-wrap">
            <Icon className="bottom-nav-icon" />
          </span>
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
