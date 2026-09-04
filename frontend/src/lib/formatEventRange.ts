export function formatEventRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const endLabel = sameDay ? end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : end.toLocaleString();
  return `${start.toLocaleString()} – ${endLabel}`;
}
