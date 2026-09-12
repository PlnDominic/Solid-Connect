'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '../../../lib/supabase';
import { createAdminClient } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

type ActionResult = { error?: string; success?: boolean };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function requireAdmin(): Promise<{ id: string; email: string } | null> {
  const sessionClient = await createServerSupabase();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user?.email) return null;
  const adminClient = createAdminClient();
  const { data: admin } = await adminClient.from('admins').select('id, disabled_at').eq('id', user.id).maybeSingle();
  if (!admin || admin.disabled_at) return null;
  return { id: user.id, email: user.email };
}

export async function createCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'Only signed-in admins can do this.' };

  const name = String(formData.get('name') ?? '').trim();
  const abbr = String(formData.get('abbr') ?? '').trim().toUpperCase();
  const defaultLabel = String(formData.get('default_label') ?? '').trim();
  const sortOrder = Number(formData.get('sort_order') ?? 0);
  const budgetMinRaw = formData.get('budget_min');
  const budgetMaxRaw = formData.get('budget_max');
  const budgetMin = budgetMinRaw ? Number(budgetMinRaw) : null;
  const budgetMax = budgetMaxRaw ? Number(budgetMaxRaw) : null;

  if (!name) return { error: 'Name is required.' };
  if (!abbr) return { error: 'A short code (e.g. PL) is required.' };
  if (budgetMin != null && budgetMax != null && budgetMin > budgetMax) {
    return { error: 'Budget min cannot be greater than budget max.' };
  }

  const id = slugify(name);
  if (!id) return { error: 'Could not derive an id from that name.' };

  const adminClient = createAdminClient();
  const { data: existing } = await adminClient.from('categories').select('id').eq('id', id).maybeSingle();
  if (existing) return { error: `A category with id "${id}" already exists.` };

  const { error } = await adminClient.from('categories').insert({
    id,
    name,
    abbr,
    default_label: defaultLabel || name,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    budget_min: budgetMin,
    budget_max: budgetMax,
  });
  if (error) return { error: error.message };

  await logAdminAction(admin, 'CREATED_CATEGORY', { targetType: 'category', targetId: id, note: name });
  revalidatePath('/categories');
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const name = String(formData.get('name') ?? '').trim();
  const abbr = String(formData.get('abbr') ?? '').trim().toUpperCase();
  const defaultLabel = String(formData.get('default_label') ?? '').trim();
  const sortOrder = Number(formData.get('sort_order') ?? 0);
  const budgetMinRaw = formData.get('budget_min');
  const budgetMaxRaw = formData.get('budget_max');
  const budgetMin = budgetMinRaw ? Number(budgetMinRaw) : null;
  const budgetMax = budgetMaxRaw ? Number(budgetMaxRaw) : null;
  if (!name || !abbr) return;
  if (budgetMin != null && budgetMax != null && budgetMin > budgetMax) return;

  const adminClient = createAdminClient();
  await adminClient
    .from('categories')
    .update({
      name, abbr, default_label: defaultLabel || name,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      budget_min: budgetMin, budget_max: budgetMax,
    })
    .eq('id', id);

  await logAdminAction(admin, 'UPDATED_CATEGORY', { targetType: 'category', targetId: id, note: name });
  revalidatePath('/categories');
}
