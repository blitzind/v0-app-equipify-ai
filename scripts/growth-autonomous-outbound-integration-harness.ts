/**
 * GE-AI-2I-PROD-2 — In-memory Supabase harness for autonomous outbound repository integration tests.
 * Not used in production — certification harness only.
 */
import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

type Row = Record<string, unknown>

type Store = Record<string, Row[]>

type QueryState = {
  op: "select" | "insert" | "update"
  table: string
  filters: Array<{ column: string; value: unknown; op: "eq" | "in" }>
  order?: { column: string; ascending: boolean }
  limit?: number
  insertRow?: Row
  updatePatch?: Row
  selectColumns?: string
}

function cloneRow(row: Row): Row {
  return JSON.parse(JSON.stringify(row)) as Row
}

function matchesFilters(row: Row, filters: QueryState["filters"]): boolean {
  for (const filter of filters) {
    if (filter.op === "eq" && row[filter.column] !== filter.value) return false
    if (filter.op === "in" && !(filter.value as unknown[]).includes(row[filter.column])) return false
  }
  return true
}

function sortRows(rows: Row[], order?: QueryState["order"]): Row[] {
  if (!order) return rows
  return [...rows].sort((a, b) => {
    const left = String(a[order.column] ?? "")
    const right = String(b[order.column] ?? "")
    const cmp = left.localeCompare(right)
    return order.ascending ? cmp : -cmp
  })
}

function buildQueryBuilder(store: Store, table: string) {
  const state: QueryState = {
    op: "select",
    table,
    filters: [],
  }

  const builder = {
    select(columns: string) {
      state.selectColumns = columns
      return builder
    },
    insert(row: Row) {
      state.op = "insert"
      state.insertRow = row
      return builder
    },
    update(patch: Row) {
      state.op = "update"
      state.updatePatch = patch
      return builder
    },
    eq(column: string, value: unknown) {
      state.filters.push({ column, value, op: "eq" })
      return builder
    },
    in(column: string, values: unknown[]) {
      state.filters.push({ column, value: values, op: "in" })
      return builder
    },
    order(column: string, options?: { ascending?: boolean }) {
      state.order = { column, ascending: options?.ascending ?? true }
      return builder
    },
    limit(count: number) {
      state.limit = count
      return builder
    },
    async maybeSingle() {
      const result = await builder.execute()
      if (result.error) return result
      const row = Array.isArray(result.data) ? result.data[0] ?? null : result.data
      return { data: row, error: null }
    },
    async single() {
      const result = await builder.execute()
      if (result.error) return result
      const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : []
      if (rows.length !== 1) {
        return { data: null, error: { message: rows.length === 0 ? "no rows" : "multiple rows" } }
      }
      return { data: rows[0], error: null }
    },
    then(onFulfilled: (value: { data: unknown; error: unknown }) => unknown) {
      return builder.execute().then(onFulfilled)
    },
    async execute(): Promise<{ data: unknown; error: { message: string } | null }> {
      if (!store[state.table]) store[state.table] = []
      const rows = store[state.table]

      if (state.op === "insert") {
        const row = cloneRow(state.insertRow ?? {})
        if (state.table === "autonomous_outbound_scope_actions") {
          const key = row.idempotency_key as string | null | undefined
          if (key) {
            const duplicate = rows.find(
              (existing) =>
                existing.organization_id === row.organization_id && existing.idempotency_key === key,
            )
            if (duplicate) {
              return { data: null, error: { message: "duplicate key value violates unique constraint" } }
            }
          }
        }
        if (!row.id) row.id = randomUUID()
        if (!row.created_at) row.created_at = new Date().toISOString()
        if (!row.updated_at) row.updated_at = row.created_at
        rows.push(row)
        return { data: cloneRow(row), error: null }
      }

      if (state.op === "update") {
        const index = rows.findIndex((row) => matchesFilters(row, state.filters))
        if (index < 0) return { data: null, error: { message: "no rows updated" } }
        rows[index] = {
          ...rows[index],
          ...state.updatePatch,
          updated_at: new Date().toISOString(),
        }
        return { data: cloneRow(rows[index]), error: null }
      }

      let matched = rows.filter((row) => matchesFilters(row, state.filters))
      matched = sortRows(matched, state.order)
      if (state.limit !== undefined) matched = matched.slice(0, state.limit)
      return { data: matched.map(cloneRow), error: null }
    },
  }

  return builder
}

export function createAutonomousOutboundIntegrationHarness(): {
  admin: SupabaseClient
  store: Store
} {
  const store: Store = {
    autonomous_outbound_scopes: [],
    autonomous_outbound_scope_actions: [],
    autonomous_outbound_scope_events: [],
  }

  const admin = {
    schema(schemaName: string) {
      return {
        from(table: string) {
          if (schemaName !== "growth") {
            throw new Error(`unsupported schema ${schemaName}`)
          }
          if (!store[table]) store[table] = []
          return buildQueryBuilder(store, table)
        },
      }
    },
    from(table: string) {
      if (!store[table]) store[table] = []
      return buildQueryBuilder(store, table)
    },
  } as unknown as SupabaseClient

  return { admin, store }
}

export function createMissingSchemaHarnessAdmin(): SupabaseClient {
  return {
    schema() {
      return {
        from() {
          const builder = {
            select() {
              return builder
            },
            limit() {
              return Promise.resolve({
                data: null,
                error: { message: 'relation "growth.autonomous_outbound_scopes" does not exist', code: "42P01" },
              })
            },
          }
          return builder
        },
      }
    },
  } as unknown as SupabaseClient
}
