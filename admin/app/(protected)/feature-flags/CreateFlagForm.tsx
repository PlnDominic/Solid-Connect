'use client';

import { useActionState } from 'react';
import { createFlag } from './actions';

export function CreateFlagForm() {
  const [state, action, pending] = useActionState(createFlag, {});

  return (
    <form action={action} className="table-card" style={{ padding: 20, marginBottom: 16, display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>New flag</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="text"
          name="key"
          required
          placeholder="live_payments"
          pattern="[a-z][a-z0-9_]*"
          className="search-input mono"
          style={{ flex: '1 1 180px', minWidth: 160 }}
        />
        <input
          type="text"
          name="description"
          placeholder="What this flag controls"
          className="search-input"
          style={{ flex: '2 1 260px', minWidth: 220 }}
        />
        <button className="btn" disabled={pending} style={{ padding: '10px 20px' }}>
          {pending ? 'Creating…' : 'Create flag'}
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
        Starts off, 0% rollout - turn it on and dial up the percentage once created.
      </p>
      {state.error && <p className="notice">{state.error}</p>}
      {state.success && <p style={{ color: 'var(--green)', fontSize: 13, margin: 0 }}>Flag created.</p>}
    </form>
  );
}
