'use client';

import { useActionState } from 'react';
import { createCategory } from './actions';

export function CreateCategoryForm() {
  const [state, action, pending] = useActionState(createCategory, {});

  return (
    <form action={action} className="table-card" style={{ padding: 20, marginBottom: 16, display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 500 }}>Add a category</h3>
      <div className="flex-wrap-10">
        <input name="name" required placeholder="Name (e.g. Roofing)" className="search-input" style={{ flex: 2, minWidth: 160 }} />
        <input name="abbr" required maxLength={3} placeholder="Code (e.g. RF)" className="search-input" style={{ flex: 1, minWidth: 90 }} />
        <input name="default_label" placeholder="Default label (e.g. Roofing · Leak repair)" className="search-input" style={{ flex: 2, minWidth: 200 }} />
        <input name="sort_order" type="number" defaultValue={0} placeholder="Order" className="search-input" style={{ flex: 0.5, minWidth: 80 }} />
        <input name="budget_min" type="number" placeholder="Budget min (GHS)" className="search-input" style={{ flex: 1, minWidth: 130 }} />
        <input name="budget_max" type="number" placeholder="Budget max (GHS)" className="search-input" style={{ flex: 1, minWidth: 130 }} />
        <button className="btn" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {state.error && <p className="notice">{state.error}</p>}
      {state.success && <p className="text-green-sm">Category added.</p>}
    </form>
  );
}
