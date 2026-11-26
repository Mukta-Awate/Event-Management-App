import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { StatusBanner } from '../components/StatusBanner';
import { formatEventWhen } from '../format';
import type { EventItem } from '../types';

export function EventsPage() {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<EventItem[]>('/events');
        if (!cancelled) setEvents(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load events');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <StatusBanner tone="error">{error}</StatusBanner>;
  }

  if (!events) {
    return <p className="muted">Loading upcoming events…</p>;
  }

  if (events.length === 0) {
    return (
      <section className="panel">
        <h1>Discover events</h1>
        <p className="lede">No published upcoming events right now.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Discover events</h1>
      <p className="lede">Published upcoming events open for registration.</p>
      <ul className="event-list">
        {events.map((event) => (
          <li key={event.id}>
            <Link to={`/events/${event.id}`} className="event-row">
              <div>
                <h2>{event.title}</h2>
                <p>{formatEventWhen(event.startAt, event.timeZone)}</p>
                <p className="muted">{event.venue}</p>
              </div>
              <div className="places">
                {event.placesRemaining} / {event.capacity} left
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
