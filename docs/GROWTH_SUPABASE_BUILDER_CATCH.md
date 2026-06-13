# Growth Supabase Builder `.catch()` Guardrail

Phase 15.3F / 15.3G — prevent reintroduction of synchronous failures from calling `.catch()` or `.finally()` directly on Supabase Postgrest builders.

## Rule

Supabase query builders (`admin.from(...)`, `admin.schema(...).from(...)`, `table(admin).select(...)`, etc.) are **thenables**, not full Promises. They expose `.then()` but **not** `.catch()` or `.finally()`.

Calling `.catch()` or `.finally()` directly on a builder chain throws synchronously:

```txt
TypeError: ... .catch is not a function
```

### Never

```ts
admin.from("leads").select("id").catch(() => ({ data: [], error: null }))

admin
  .schema("growth")
  .from("opportunities")
  .insert({ ... })
  .catch(() => undefined)
```

### Always insert `.then(...)` before `.catch(...)`

```ts
// SELECT — preserve result shape
const { data, error } = await admin
  .from("leads")
  .select("id")
  .then((result) => result)
  .catch(() => ({ data: [], error: null }))

// INSERT/UPDATE fire-and-forget
void admin
  .schema("growth")
  .from("timeline_events")
  .insert({ ... })
  .then(() => undefined)
  .catch(() => undefined)
```

### Safe without `.then()` (not builders)

These are normal Promises — direct `.catch()` is fine:

```ts
fetch(url).catch(() => null)
someAsyncFunction(admin).catch(() => [])
appendGrowthLeadTimelineEvent(admin, payload).catch(() => undefined)
```

## Enforcement

| Gate | Command |
|------|---------|
| Fixture self-test | `pnpm test:growth-supabase-builder-catch-fixtures` |
| Production tree scan | `pnpm test:growth-supabase-builder-catch` |
| Prebuild (mandatory) | Both commands run before `pnpm build` |
| CI | Both commands run in `.github/workflows/growth-supabase-builder-catch.yml` |

Scanner implementation: `lib/growth/guardrails/supabase-builder-catch-scanner.ts`

Fixtures: `scripts/fixtures/growth-supabase-builder-catch/`

Scanned directories:

- `lib/growth`
- `app/api/platform/growth`
- `app/api/cron`

There is **no bypass flag**. A violation fails CI and `pnpm build`.
