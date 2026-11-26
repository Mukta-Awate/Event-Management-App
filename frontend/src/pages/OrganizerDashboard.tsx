import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { StatusBanner } from '../components/StatusBanner';
import { formatEventWhen } from '../format';
import type { AttendeeRow, EventItem, EventStatus } from '../types';

const emptyForm = {
  title: '',
  description: '',
  startAt: '',
  timeZone: 'Asia/Kolkata',
  venue: '',
  capacity: 10,
  status: 'draft' as EventStatus,
};

export function OrganizerDashboard() {
  const { token } = useAuth();
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<AttendeeRow[] | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    try {
      const data = await api<EventItem[]>('/events/mine', {}, token);
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load events');
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setMessage(null);
    setError(null);
    const body = {
      ...form,
      startAt: new Date(form.startAt).toISOString(),
      capacity: Number(form.capacity),
    };
    try {
      if (editingId) {
        await api(`/events/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }, token);
        setMessage('Event updated.');
      } else {
        await api('/events', { method: 'POST', body: JSON.stringify(body) }, token);
        setMessage('Event created.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    }
  }

  function startEdit(event: EventItem) {
    setEditingId(event.id);
    setForm({
      title: event.title,
      description: event.description,
      startAt: event.startAt.slice(0, 16),
      timeZone: event.timeZone,
      venue: event.venue,
      capacity: event.capacity,
      status: event.status,
    });
  }

  async function cancelEvent(id: string) {
    if (!token) return;
    try {
      await api(`/events/${id}/cancel`, { method: 'POST' }, token);
      setMessage('Event canceled.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cancel failed');
    }
  }

  async function showAttendees(id: string) {
    if (!token) return;
    setSelectedEventId(id);
    try {
      const rows = await api<AttendeeRow[]>(`/events/${id}/attendees`, {}, token);
      setAttendees(rows);
      setError(null);
    } catch (err) {
      setAttendees(null);
      setError(
        err instanceof ApiError ? err.message : 'Failed to load attendees',
      );
    }
  }

  if (!events && !error) return <p className="muted">Loading dashboard…</p>;

  return (
    <section className="panel">
      <h1>Organizer dashboard</h1>
      <p className="lede">Create events, watch capacity, and review attendees.</p>
      {message && <StatusBanner tone="success">{message}</StatusBanner>}
      {error && <StatusBanner tone="error">{error}</StatusBanner>}

      <form className="stack form-grid" onSubmit={onSubmit}>
        <h2 className="section-title">
          {editingId ? 'Edit event' : 'New event'}
        </h2>
        <label>
          Title
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </label>
        <label>
          Description
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            rows={3}
          />
        </label>
        <label>
          Start (local to your browser; stored with time zone)
          <input
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            required
          />
        </label>
        <label>
          Time zone (IANA)
          <input
            value={form.timeZone}
            onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
            required
          />
        </label>
        <label>
          Venue
          <input
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
            required
          />
        </label>
        <label>
          Capacity
          <input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) =>
              setForm({ ...form, capacity: Number(e.target.value) })
            }
            required
          />
        </label>
        <label>
          Status
          <select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as EventStatus })
            }
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="canceled">Canceled</option>
          </select>
        </label>
        <div className="row">
          <button type="submit">{editingId ? 'Save changes' : 'Create event'}</button>
          {editingId && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <h2 className="section-title">Your events</h2>
      {!events?.length ? (
        <p className="muted">No events yet.</p>
      ) : (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id} className="event-row static">
              <div>
                <h2>
                  {event.title}{' '}
                  <span className={`pill status-${event.status}`}>
                    {event.status}
                  </span>
                </h2>
                <p>{formatEventWhen(event.startAt, event.timeZone)}</p>
                <p className="muted">
                  {event.activeRegistrations} registered ·{' '}
                  {event.placesRemaining} available · capacity {event.capacity}
                </p>
                {event.status === 'published' && (
                  <p>
                    <Link to={`/events/${event.id}`}>Public page</Link>
                  </p>
                )}
              </div>
              <div className="row wrap">
                <button type="button" className="ghost" onClick={() => startEdit(event)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => showAttendees(event.id)}
                >
                  Attendees
                </button>
                {event.status !== 'canceled' && (
                  <button
                    type="button"
                    className="ghost danger"
                    onClick={() => cancelEvent(event.id)}
                  >
                    Cancel event
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedEventId && (
        <>
          <h2 className="section-title">Attendee list</h2>
          {!attendees?.length ? (
            <p className="muted">No active registrations for this event.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((row) => (
                  <tr key={row.registrationId}>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td>{new Date(row.registeredAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
