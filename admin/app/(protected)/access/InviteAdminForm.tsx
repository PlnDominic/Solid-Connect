'use client';

import { useActionState } from 'react';
import { inviteAdmin } from './actions';

export function InviteAdminForm() {
  const [state, action, pending] = useActionState(inviteAdmin, {});

  return (
    <form action={action} className="table-card" style={{ padding: 20, marginBottom: 16, display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 500 }}>Invite an admin</h3>
      <div className="flex-wrap-10">
        <input
          type="email"
          name="email"
          required
          placeholder="name@example.com"
          className="search-input"
          style={{ flex: 1, minWidth: 220 }}
        />
        <select
          name="role"
          defaultValue="support"
          className="input"
        >
          <option value="support">Support</option>
          <option value="owner">Owner</option>
        </select>
        <button className="btn" disabled={pending}>
          {pending ? 'Sending invite…' : 'Send invite'}
        </button>
      </div>
      {state.error && <p className="notice">{state.error}</p>}
      {state.success && <p className="text-green-sm">Invite sent.</p>}
    </form>
  );
}
