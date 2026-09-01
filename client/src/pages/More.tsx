import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ListIcon, ScaleIcon, ChevronRightIcon, DownloadIcon } from '../components/icons';
import { useInstallPrompt } from '../lib/useInstallPrompt';

export function More() {
  return (
    <div className="page">
      <h1 className="page-title">More</h1>

      <div className="list-card">
        <ul className="list-rows">
          <li>
            <Link to="/plans" className="list-row">
              <span className="list-row-icon-wrap">
                <ListIcon className="list-row-icon" />
              </span>
              <span className="list-row-body">
                <span className="list-row-title">Training plans</span>
                <span className="list-row-meta">Create, edit, activate and duplicate plans</span>
              </span>
              <ChevronRightIcon className="list-row-chevron" />
            </Link>
          </li>
          <li>
            <Link to="/body-weight" className="list-row">
              <span className="list-row-icon-wrap">
                <ScaleIcon className="list-row-icon" />
              </span>
              <span className="list-row-body">
                <span className="list-row-title">Body weight</span>
                <span className="list-row-meta">Log and review your body weight over time</span>
              </span>
              <ChevronRightIcon className="list-row-chevron" />
            </Link>
          </li>
        </ul>
      </div>

      <InstallAppCard />

      <p className="page-subtitle">Settings land in a later phase.</p>
    </div>
  );
}

// Always renders a button rather than disappearing when the browser hasn't
// (yet, or ever will) fire its install-ready event — a button that's
// sometimes invisible is indistinguishable from a broken feature. Tapping
// it either installs directly when the browser supports it, or reveals the
// right manual steps for this device instead of doing nothing.
function InstallAppCard() {
  const { installed, canPromptInstall, showIosInstructions, promptInstall } = useInstallPrompt();
  const [showHelp, setShowHelp] = useState(false);

  if (installed) {
    return (
      <section className="card">
        <h2 className="card-title">
          <DownloadIcon className="card-title-icon" /> Install app
        </h2>
        <p className="page-subtitle">Already installed on this device.</p>
      </section>
    );
  }

  async function handleClick() {
    if (canPromptInstall) {
      await promptInstall();
    } else {
      setShowHelp(true);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">
        <DownloadIcon className="card-title-icon" /> Install app
      </h2>
      <p className="page-subtitle">Add Training Tracker to your home screen for quick, full-screen access.</p>
      <button className="button-primary" onClick={handleClick}>
        Add to home screen
      </button>
      {showHelp && !canPromptInstall && (
        <p className="page-subtitle" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          {showIosInstructions
            ? 'In Safari, tap the Share icon, then "Add to Home Screen".'
            : 'Your browser hasn\'t offered a one-tap install yet. Open your browser menu (⋮) and look for "Install app" or "Add to Home screen" — reloading the page first can help it notice.'}
        </p>
      )}
    </section>
  );
}
