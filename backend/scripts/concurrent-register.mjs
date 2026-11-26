/**
 * Manual verification helper for the last-seat race.
 *
 * Prerequisites:
 *   - API running against Postgres
 *   - EVENT_ID set to a published upcoming event with capacity 1 (or almost full)
 *   - Two attendee accounts (defaults match seed data)
 *
 * Usage:
 *   node scripts/concurrent-register.mjs
 *   EVENT_ID=<uuid> node scripts/concurrent-register.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000/api';
const EVENT_ID = process.env.EVENT_ID;

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  return res.json();
}

async function register(token, eventId) {
  const res = await fetch(`${API}/events/${eventId}/registrations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  if (!EVENT_ID) {
    console.error('Set EVENT_ID to a published event UUID (ideally capacity 1).');
    process.exit(1);
  }

  const a = await login('attendee@example.com', 'password123');
  const b = await login('attendee2@example.com', 'password123');

  const [r1, r2] = await Promise.all([
    register(a.accessToken, EVENT_ID),
    register(b.accessToken, EVENT_ID),
  ]);

  console.log('Request A:', r1.status, r1.body);
  console.log('Request B:', r2.status, r2.body);

  const successes = [r1, r2].filter((r) => r.status >= 200 && r.status < 300);
  const conflicts = [r1, r2].filter((r) => r.status === 409);

  if (successes.length === 1 && conflicts.length === 1) {
    console.log('OK: exactly one registration succeeded; capacity held.');
    process.exit(0);
  }

  console.error('UNEXPECTED: expected one 2xx and one 409 for a last-seat race.');
  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
