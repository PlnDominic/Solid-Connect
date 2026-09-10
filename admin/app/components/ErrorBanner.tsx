/** Surfaces a failed query instead of letting it render as a silent,
 * misleading "No results" empty state. */
export function ErrorBanner({ errors }: { errors: Array<string | undefined> }) {
  const messages = errors.filter((e): e is string => Boolean(e));
  if (!messages.length) return null;
  return (
    <div className="empty" style={{ marginBottom: 16, color: 'var(--red)' }}>
      Some data failed to load: {messages[0]}
    </div>
  );
}
