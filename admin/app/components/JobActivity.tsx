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
                <div style={{ fontSize: 13, fontWeight: 700 }}>{EVENT_LABELS[e.event_type] ?? e.event_type}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {actorMap[e.actor_id] ?? 'Unknown'} · {stampTime(e.created_at)}
                  {e.from_step != null && e.to_step != null ? ` · step ${e.from_step} → ${e.to_step}` : ''}
                </div>
                {e.note ? <div style={{ fontSize: 12.5, marginTop: 2 }}>{e.note}</div> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">No events recorded yet.</div>
      )}

      <h2 style={{ marginTop: 28 }}>Chat transcript</h2>
      {messages.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
          {messages.map((m) => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.sender_role === 'provider' ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '80%', padding: '8px 12px', borderRadius: 10, fontSize: 13,
                  background: m.sender_role === 'provider' ? 'var(--accent-bg)' : 'var(--bg-input)',
                  border: '1px solid var(--border)',
                }}
              >
                {m.text}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
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
