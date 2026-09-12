'use client';

import { useActionState } from 'react';
import { createCategory } from './actions';

export function CreateCategoryForm() {
  const [state, action, pending] = useActionState(createCategory, {});

  return (
    <form action={action} className="table-card" style={{ padding: 20, marginBottom: 16, display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Add a category</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input name="name" required placeholder="Name (e.g. Roofing)" className="search-input" style={{ flex: 2, minWidth: 160 }} />
        <input name="abbr" required maxLength={3} placeholder="Code (e.g. RF)" className="search-input" style={{ flex: 1, minWidth: 90 }} />
        <input name="default_label" placeholder="Default label (e.g. Roofing · Leak repair)" className="search-input" style={{ flex: 2, minWidth: 200 }} />
        <input name="sort_order" type="number" defaultValue={0} placeholder="Order" className="search-input" style={{ flex: 0.5, minWidth: 80 }} />
        <input name="budget_min" type="number" placeholder="Budget min (GHS)" className="search-input" style={{ flex: 1, minWidth: 130 }} />
        <input name="budget_max" type="number" placeholder="Budget max (GHS)" className="search-input" style={{ flex: 1, minWidth: 130 }} />
        <button className="btn" disabled={pending} style={{ padding: '10px 20px' }}>
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {state.error && <p className="notice">{state.error}</p>}
      {state.success && <p style={{ color: 'var(--green)', fontSize: 13, margin: 0 }}>Category added.</p>}
    </form>
  );
}
