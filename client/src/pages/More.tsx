import { Link } from 'react-router-dom';

export function More() {
  return (
    <div className="page">
      <h1 className="page-title">More</h1>

      <ul className="exercise-list">
        <li>
          <Link to="/plans" className="exercise-list-item">
            <span className="exercise-list-name">Training plans</span>
            <span className="exercise-list-meta">Create, edit, activate and duplicate plans</span>
          </Link>
        </li>
      </ul>

      <p className="page-subtitle">Body weight, JSON import/export and settings land in later phases.</p>
    </div>
  );
}
