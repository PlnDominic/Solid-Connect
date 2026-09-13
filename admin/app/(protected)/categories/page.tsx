import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { CreateCategoryForm } from './CreateCategoryForm';
import { updateCategory, setCategoryActive } from './actions';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ status?: string }> };

export default async function CategoriesPage({ searchParams }: Props) {
  const { status: requested } = await searchParams;
  const status = requested === 'archived' ? 'archived' : 'active';
  const supabase = await createServerSupabase();

  const [{ data: categories, error: catError }, { data: providerCounts, error: countError }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, abbr, default_label, sort_order, budget_min, budget_max, active')
      .eq('active', status === 'active')
      .order('sort_order', { ascending: true }),
    supabase.from('provider_categories').select('category_id'),
  ]);

  const errors = [catError?.message, countError?.message];

  const countByCategory: Record<string, number> = {};
  (providerCounts ?? []).forEach((row: { category_id: string }) => {
    countByCategory[row.category_id] = (countByCategory[row.category_id] ?? 0) + 1;
  });

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Content</div>
        <h1>Categories</h1>
        <p className="page-header-sub">Service categories used across matching, the category picker, and request forms.</p>
      </div>

      <ErrorBanner errors={errors} />

      {status === 'active' && <CreateCategoryForm />}

      <nav className="tabs" style={{ marginBottom: 14 }}>
        <Link href="/categories?status=active" className={status === 'active' ? 'selected' : ''}>Active</Link>
        <Link href="/categories?status=archived" className={status === 'archived' ? 'selected' : ''}>Archived</Link>
      </nav>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Name</th>
              <th>Code</th>
              <th>Default label</th>
              <th>Budget (GHS)</th>
              <th>Providers</th>
              <th>Save</th>
              <th>{status === 'active' ? 'Archive' : 'Restore'}</th>
            </tr>
          </thead>
          <tbody>
            {(categories ?? []).length > 0 ? (categories ?? []).map((c) => {
              const formId = `cat-form-${c.id}`;
              return (
                <tr key={c.id}>
                  <td style={{ width: 70 }}>
                    <input
                      form={formId}
                      name="sort_order"
                      type="number"
                      defaultValue={c.sort_order}
                      style={{ width: 56, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}
                    />
                  </td>
                  <td>
                    <input
                      form={formId}
                      name="name"
                      defaultValue={c.name}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}
                    />
                    <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>{c.id}</div>
                  </td>
                  <td>
                    <input
                      form={formId}
                      name="abbr"
                      defaultValue={c.abbr}
                      maxLength={3}
                      style={{ width: 52, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12, textAlign: 'center' }}
                    />
                  </td>
                  <td>
                    <input
                      form={formId}
                      name="default_label"
                      defaultValue={c.default_label}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        form={formId}
                        name="budget_min"
                        type="number"
                        defaultValue={c.budget_min ?? ''}
                        placeholder="min"
                        style={{ width: 60, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>–</span>
                      <input
                        form={formId}
                        name="budget_max"
                        type="number"
                        defaultValue={c.budget_max ?? ''}
                        placeholder="max"
                        style={{ width: 60, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}
                      />
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{countByCategory[c.id] ?? 0}</td>
                  <td>
                    <form id={formId} action={updateCategory.bind(null, c.id)} />
                    <button form={formId} className="filter-btn" style={{ padding: '6px 14px' }}>Save</button>
                  </td>
                  <td>
                    <form action={setCategoryActive.bind(null, c.id, status !== 'active')}>
                      <button className="filter-btn" style={{ padding: '6px 14px' }}>
                        {status === 'active' ? 'Archive' : 'Restore'}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={8} className="empty">No {status} categories.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
