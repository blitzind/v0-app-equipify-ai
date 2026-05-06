# Supabase migrations (Equipify)

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
