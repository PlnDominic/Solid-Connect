import { EVENT_LABELS, type ChatMessage, type JobEvent } from '../../lib/jobActivity';

const stampTime = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));

/** The job_events audit trail plus (if one exists) the chat transcript -
 * the evidence an admin needs to see what actually happened on a job,
 * shared by the job detail and dispute detail pages. */
export function JobActivity({
  events,
  messages,
  actorMap,
}: {
  events: JobEvent[];
  messages: ChatMessage[];
  actorMap: Record<string, string>;
}) {
  return (
    <>
      <h2>Timeline</h2>
      {events.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{EVENT_LABELS[e.event_type] ?? e.event_type}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                  {actorMap[e.actor_id] ?? 'Unknown'} · {stampTime(e.created_at)}
                  {e.from_step != null && e.to_step != null ? ` · step ${e.from_step} → ${e.to_step}` : ''}
                </div>
                {e.note ? <div style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>{e.note}</div> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">No events recorded yet.</div>
      )}

      <h2 className="mt-28">Chat transcript</h2>
      {messages.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
          {messages.map((m) => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.sender_role === 'provider' ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  // The app's chat bubbles: ink for one side, recessed paperDim
                  // for the other, radii.lg with a tucked tail corner.
                  maxWidth: '78%', padding: '10px 14px', borderRadius: 'var(--r-lg)', fontSize: 'var(--fs-sm)', fontWeight: 500,
                  ...(m.sender_role === 'provider'
                    ? { background: 'var(--accent)', color: 'var(--on-accent)', borderBottomRightRadius: 'var(--r-sm)' }
                    : { background: 'var(--bg-input)', color: 'var(--text-primary)', borderBottomLeftRadius: 'var(--r-sm)' }),
                }}
              >
                {m.text}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                {m.sender_role === 'provider' ? 'Provider' : 'Customer'} · {stampTime(m.created_at)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">No messages were exchanged.</div>
      )}
    </>
  );
}
