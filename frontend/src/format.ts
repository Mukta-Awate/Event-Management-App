export function formatEventWhen(startAt: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(startAt));
  } catch {
    return new Date(startAt).toLocaleString();
  }
}
