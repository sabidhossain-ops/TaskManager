const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDateTime = (iso) => (iso ? dateTimeFmt.format(new Date(iso)) : '—');

export const initials = (text = '') =>
  text
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';

/** Date → value for <input type="datetime-local"> in the browser's time zone. */
export const toLocalInput = (d) => {
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** <input type="datetime-local"> value → ISO string (or null). */
export const fromLocalInput = (s) => (s ? new Date(s).toISOString() : null);
