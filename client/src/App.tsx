import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './layouts/AppShell';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Placeholder } from './pages/Placeholder';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route
            path="/workout"
            element={<Placeholder title="Workout" note="Active workout logging arrives in Phase 4." />}
          />
          <Route
            path="/history"
            element={<Placeholder title="History" note="Session history arrives in Phase 5." />}
          />
          <Route
            path="/exercises"
            element={<Placeholder title="Exercises" note="The exercise library arrives in Phase 2." />}
          />
          <Route
            path="/more"
            element={<Placeholder title="More" note="Settings, body weight and import/export land in later phases." />}
          />
        </Route>
      </Route>
    </Routes>
  );
}
