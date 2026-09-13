-- Category retire/archive: categories are foreign-keyed from
-- provider_categories (on delete cascade), so hard-deleting one would
-- silently strip that tag from every provider who has it. `active`
-- lets an admin retire a category from new selection without touching
-- any existing provider tag, job, or request that already references it.

alter table public.categories
  add column if not exists active boolean not null default true;
