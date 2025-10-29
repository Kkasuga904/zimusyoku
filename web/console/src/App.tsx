import { useEffect, useRef, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import HelpModal from "./components/HelpModal";
import LoginForm from "./components/LoginForm";
import { useStrings } from "./i18n/strings";
import JobDetail from "./pages/JobDetail";
import Jobs from "./pages/Jobs";
import Summary from "./pages/Summary";
import Approvals from "./pages/Approvals";
import Upload from "./pages/Upload";
import { initializeToken, login as performLogin, logout as performLogout } from "./modules/authClient";
import { ApiError, UnauthorizedError } from "./modules/apiClient";
import { subscribeToUnauthorized } from "./modules/authEvents";

const App = () => {
  const strings = useStrings();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [token, setToken] = useState<string | null>(() => initializeToken());
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);

  const openHelp = () => setIsHelpOpen(true);
  const closeHelp = () => {
    setIsHelpOpen(false);
    helpButtonRef.current?.focus();
  };

  useEffect(() => {
    const unsubscribe = subscribeToUnauthorized(() => {
      performLogout();
      setToken(null);
      setAuthError(strings.auth.sessionExpired);
    });
    return unsubscribe;
  }, [strings.auth.sessionExpired]);

  const handleLogin = async (email: string, password: string) => {
    setIsAuthLoading(true);
    try {
      const newToken = await performLogin(email, password);
      setToken(newToken);
      setAuthError(null);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[auth] login failed", error);
      if (error instanceof UnauthorizedError) {
        setAuthError(strings.auth.invalid);
      } else if (error instanceof ApiError) {
        setAuthError(`${strings.auth.invalid} (status ${error.status})`);
      } else if (error instanceof Error && error.message) {
        setAuthError(`${strings.auth.invalid} (${error.message})`);
      } else {
        setAuthError(strings.auth.invalid);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    performLogout();
    setToken(null);
    setAuthError(null);
  };

  if (!token) {
    return (
      <div className="app-shell unauthenticated">
        <header className="top-bar">
          <h1>{strings.common.appTitle}</h1>
        </header>
        <main className="content">
          <LoginForm onSubmit={handleLogin} error={authError} isLoading={isAuthLoading} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>{strings.common.appTitle}</h1>
        <nav aria-label="Main navigation">
          <ul className="nav-links">
            <li>
              <NavLink to="/" end>
                {strings.nav.dashboard}
              </NavLink>
            </li>
            <li>
              <NavLink to="/upload">{strings.nav.upload}</NavLink>
            </li>
            <li>
              <NavLink to="/jobs">{strings.nav.jobs}</NavLink>
            </li>
            <li>
              <NavLink to="/approvals">{strings.nav.approvals}</NavLink>
            </li>
          </ul>
        </nav>
        <div className="header-actions">
          <button
            type="button"
            ref={helpButtonRef}
            className="help-button"
            onClick={openHelp}
            aria-haspopup="dialog"
            aria-expanded={isHelpOpen}
          >
            <span aria-hidden="true">?</span> {strings.nav.help}
          </button>
          <button type="button" className="link-button" onClick={handleLogout}>
            {strings.auth.logout}
          </button>
        </div>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Summary />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/approvals" element={<Approvals />} />
        </Routes>
      </main>
      <HelpModal isOpen={isHelpOpen} onClose={closeHelp} strings={strings.help} />
    </div>
  );
};

export default App;
