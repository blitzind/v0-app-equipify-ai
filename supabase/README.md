# Supabase migrations (Equipify)

## Data API exposure — `public` tables and `GRANT`s

Supabase is changing how the **Data API** exposes objects in the **`public`** schema. **Never assume** a newly created `public.*` table is automatically accessible through:

- `supabase-js`
- PostgREST (`/rest/v1`)
- GraphQL
- SSR Supabase clients
- service-role-backed API routes that rely on PostgREST

**For every migration that creates a table in `public`:** add **explicit `GRANT` statements immediately after** table creation (and after any related sequences if inserts use `serial`/`identity`).

### Minimum standard (tighten per table if RLS design requires it)

```sql
grant select, insert, update, delete
on public.your_table
to authenticated;

grant select, insert, update, delete
on public.your_table
to service_role;
```

Many Equipify migrations use **narrower** `authenticated` grants (e.g. `select` only) when writes are service-only—**follow the security model of neighboring tables** in the same feature area.

`GRANT` enables role access at the SQL layer; **RLS still applies** and must be defined where the table is user-scoped.

---

## Catalog tables

These migrations define **`public.catalog_items`** and **`public.price_list_imports`**:

| File | Purpose |
|------|---------|
| `20260616100000_catalog_items_price_list_imports.sql` | Creates both tables, indexes, RLS (`is_org_member` / `has_org_role`), triggers, storage bucket `price-list-imports`. |
| `20260620120000_ai_human_verification.sql` | Adds AI verification columns to `catalog_items` and `price_list_imports`. |

PostgREST error **“Could not find the table 'public.catalog_items' in the schema cache”** means either:

1. **Migrations were not applied** to the Supabase project your app points at (`NEXT_PUBLIC_SUPABASE_URL`), or  
2. Rarely, PostgREST’s schema cache is stale after DDL outside the migration runner—use **Dashboard → Project Settings → API → Reload schema** (wording may vary by Supabase version).

### Apply migrations (CLI)

From `equipify-app`:

```bash
# Local: wipe + replay all migrations
supabase db reset

# Linked remote project: push pending migrations
supabase link --project-ref <ref>
supabase db push
```

### Verify tables exist (SQL Editor)

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('catalog_items', 'price_list_imports');
```

Both rows should appear after migrations succeed.
