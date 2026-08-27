import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getCatalyst } from '../auth/catalystSdk';

const LOGIN_ELEMENT_ID = 'catalyst-login';

export function Login() {
  const { isLoading, isAuthenticated } = useAuth();
  const hasMountedWidget = useRef(false);

  useEffect(() => {
    if (isLoading || isAuthenticated || hasMountedWidget.current) return;

    const sdk = getCatalyst();
    if (!sdk) return;

    // Mount exactly once: Catalyst's own service_url redirect handles
    // completed sign-in with a full page navigation, so nothing here needs
    // to re-check or re-mount the widget on a timer.
    hasMountedWidget.current = true;
    sdk.auth.signIn(LOGIN_ELEMENT_ID, {});
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="screen-loading" role="status">
        Loading…
      </div>
    );
  }

  return (
    <div className="login-screen">
      <h1 className="login-title">Training Tracker</h1>
      <div id={LOGIN_ELEMENT_ID} />
    </div>
  );
}
