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
        <li>
          <Link to="/body-weight" className="exercise-list-item">
            <span className="exercise-list-name">Body weight</span>
            <span className="exercise-list-meta">Log and review your body weight over time</span>
          </Link>
        </li>
      </ul>

      <p className="page-subtitle">Settings land in a later phase.</p>
    </div>
  );
}
