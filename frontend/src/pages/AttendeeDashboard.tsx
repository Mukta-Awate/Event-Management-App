import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { StatusBanner } from '../components/StatusBanner';
import { formatEventWhen } from '../format';
import type { RegistrationItem } from '../types';

export function AttendeeDashboard() {
  const { token } = useAuth();
  const [items, setItems] = useState<RegistrationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    try {
      const data = await api<RegistrationItem[]>('/me/registrations', {}, token);
      setItems(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load registrations',
      );
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function cancel(id: string) {
    if (!token) return;
    setMessage(null);
    try {
      await api(`/registrations/${id}/cancel`, { method: 'POST' }, token);
      setMessage('Registration canceled. Your place was released.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cancel failed');
    }
  }

  if (error && !items) return <StatusBanner tone="error">{error}</StatusBanner>;
  if (!items) return <p className="muted">Loading your registrations…</p>;

  const upcoming = items.filter((r) => r.status === 'active');
  const canceled = items.filter((r) => r.status === 'canceled');

  return (
    <section className="panel">
      <h1>My registrations</h1>
      <p className="lede">Upcoming events you are signed up for.</p>
      {message && <StatusBanner tone="success">{message}</StatusBanner>}
      {error && <StatusBanner tone="error">{error}</StatusBanner>}

      {upcoming.length === 0 ? (
        <p className="muted">
          No active registrations.{' '}
          <Link to="/">Browse events</Link>
        </p>
      ) : (
        <ul className="event-list">
          {upcoming.map((reg) => (
            <li key={reg.id} className="event-row static">
              <div>
                <h2>
                  <Link to={`/events/${reg.event.id}`}>{reg.event.title}</Link>
                </h2>
                <p>{formatEventWhen(reg.event.startAt, reg.event.timeZone)}</p>
                <p className="muted">{reg.event.venue}</p>
              </div>
              <button type="button" className="ghost" onClick={() => cancel(reg.id)}>
                Cancel
              </button>
            </li>
          ))}
        </ul>
      )}

      {canceled.length > 0 && (
        <>
          <h2 className="section-title">Canceled</h2>
          <ul className="event-list muted-list">
            {canceled.map((reg) => (
              <li key={reg.id} className="event-row static">
                <div>
                  <h2>{reg.event.title}</h2>
                  <p className="muted">Canceled registration</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
