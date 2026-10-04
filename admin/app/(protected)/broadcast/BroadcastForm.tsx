'use client';

import { useActionState, useRef } from 'react';
import { sendBroadcast } from './actions';

export function BroadcastForm() {
  const [state, action, pending] = useActionState(sendBroadcast, {});
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await action(formData);
        formRef.current?.reset();
      }}
      className="table-card"
      style={{ padding: 20, display: 'grid', gap: 14, maxWidth: 560 }}
    >
      <div>
        <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
          Audience
        </label>
        <select
          name="audience"
          defaultValue="everyone"
          className="input" style={{ width: '100%' }}
        >
          <option value="everyone">Everyone</option>
          <option value="customer">All customers</option>
          <option value="provider">All providers</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
          Title
        </label>
        <input name="title" required placeholder="e.g. New payment methods coming soon" className="search-input" />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
          Message
        </label>
        <textarea name="body" required placeholder="Write the announcement..." className="field" style={{ minHeight: 100 }} />
      </div>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
        <input type="checkbox" name="essential" style={{ marginTop: 2 }} />
        <span>
          Send regardless of notification preferences (operational notice - outage, policy change). Leave unchecked
          for anything promotional: those only reach users who opted in, per the Privacy Policy.
        </span>
      </label>

      <button className="btn" disabled={pending} style={{ justifySelf: 'start' }}>
        {pending ? 'Sending…' : 'Send broadcast'}
      </button>

      {state.error && <p className="notice">{state.error}</p>}
      {state.success && <p className="text-green-sm">Sent to {state.count} recipient{state.count === 1 ? '' : 's'}.</p>}
    </form>
  );
}
