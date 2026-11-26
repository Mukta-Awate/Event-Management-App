import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './auth';
import { AttendeeDashboard } from './pages/AttendeeDashboard';
import { EventDetailPage } from './pages/EventDetailPage';
import { EventsPage } from './pages/EventsPage';
import { LoginPage } from './pages/LoginPage';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import { RegisterPage } from './pages/RegisterPage';

function RequireAuth({
  role,
  children,
}: {
  role?: 'organizer' | 'attendee';
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          EventDesk
        </Link>
        <nav>
          <Link to="/">Discover</Link>
          {user?.role === 'organizer' && <Link to="/organizer">Dashboard</Link>}
          {user?.role === 'attendee' && <Link to="/me">My registrations</Link>}
          {!user && <Link to="/login">Sign in</Link>}
          {!user && <Link to="/register">Register</Link>}
          {user && (
            <button type="button" className="linkish" onClick={logout}>
              Sign out ({user.name})
            </button>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/organizer"
            element={
              <RequireAuth role="organizer">
                <OrganizerDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/me"
            element={
              <RequireAuth role="attendee">
                <AttendeeDashboard />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
