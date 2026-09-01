import { Outlet } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';

// BottomNav is a sibling of .app-shell, not a child inside it — some mobile
// browsers mishandle a `position: fixed` element that's a direct child of a
// `display: flex` container (treating it as part of flex layout instead of
// out-of-flow), which pushes it down on long pages instead of pinning it to
// the viewport. Keeping it fully outside the flex tree sidesteps that.
export function AppShell() {
  return (
    <>
      <div className="app-shell">
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </>
  );
}
