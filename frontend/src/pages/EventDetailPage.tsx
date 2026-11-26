import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { StatusBanner } from '../components/StatusBanner';
import { formatEventWhen } from '../format';
import type { EventItem } from '../types';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<EventItem>(`/events/${id}`);
      setEvent(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load event');
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function register() {
    if (!id || !token) return;
    setRegistering(true);
    setMessage(null);
    setError(null);
    try {
      await api(`/events/${id}/registrations`, { method: 'POST' }, token);
      setMessage('You are registered. See My registrations for details.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setRegistering(false);
    }
  }

  if (loading) return <p className="muted">Loading event…</p>;
  if (error && !event) return <StatusBanner tone="error">{error}</StatusBanner>;
  if (!event) return null;

  const canRegister =
    user?.role === 'attendee' && event.placesRemaining > 0;

  return (
    <section className="panel">
      <p className="eyebrow">
        <Link to="/">← All events</Link>
      </p>
      <h1>{event.title}</h1>
      <p className="lede">{event.description}</p>
      {message && <StatusBanner tone="success">{message}</StatusBanner>}
      {error && <StatusBanner tone="error">{error}</StatusBanner>}
      <dl className="meta-grid">
        <div>
          <dt>When</dt>
          <dd>{formatEventWhen(event.startAt, event.timeZone)}</dd>
        </div>
        <div>
          <dt>Time zone</dt>
          <dd>{event.timeZone}</dd>
        </div>
        <div>
          <dt>Venue</dt>
          <dd>{event.venue}</dd>
        </div>
        <div>
          <dt>Capacity</dt>
          <dd>
            {event.activeRegistrations} registered · {event.placesRemaining}{' '}
            places remaining
          </dd>
        </div>
      </dl>
      {!user && (
        <p className="muted">
          <Link to="/login">Sign in</Link> as an attendee to register.
        </p>
      )}
      {user?.role === 'organizer' && (
        <p className="muted">Organizers manage events from the dashboard.</p>
      )}
      {user?.role === 'attendee' && event.placesRemaining === 0 && (
        <StatusBanner tone="info">This event is full.</StatusBanner>
      )}
      {canRegister && (
        <button type="button" onClick={register} disabled={registering}>
          {registering ? 'Registering…' : 'Register for this event'}
        </button>
      )}
    </section>
  );
}
