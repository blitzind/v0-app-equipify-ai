/**
 * Soft-archive convention for org-scoped tables:
 * - **active** — `archived_at` is null
 * - **archived** — `archived_at` is not null
 * - **all** — no filter on `archived_at`
 *
 * Use {@link applyArchivedAtScope} with Supabase PostgREST query builders.
 */
export type ArchivedAtScope = "active" | "archived" | "all"

type ArchivedAtFilterable = {
  is: (column: string, value: null) => unknown
  not: (column: string, operator: string, value: null) => unknown
}

/** Apply archive scope on `archived_at` (default column name). */
export function applyArchivedAtScope<Q extends ArchivedAtFilterable>(
  query: Q,
  scope: ArchivedAtScope,
  column = "archived_at",
): Q {
  if (scope === "active") return query.is(column, null) as Q
  if (scope === "archived") return query.not(column, "is", null) as Q
  return query
}

/** Active-only shorthand for default listings. */
export function activeArchivedAt<Q extends ArchivedAtFilterable>(
  query: Q,
  column = "archived_at",
): Q {
  return query.is(column, null) as Q
}

export function rowIsArchived(archivedAt: string | null | undefined): boolean {
  return archivedAt != null && archivedAt !== ""
}
