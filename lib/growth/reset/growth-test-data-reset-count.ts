/**
 * Shared PostgREST count path for Growth reset audit — diagnostics + fallbacks.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthResetTableCatalogEntry } from "./growth-test-data-reset-table-inventory"

const GROWTH_RESET_SCHEMA = "growth"
const COUNT_SELECT_COLUMNS = ["id", "*"] as const

export type GrowthResetCountOperation = "count" | "preserved_id_count" | "preserved_fk_count"

export type GrowthResetCountError = {
  table: string
  classification: GrowthResetTableCatalogEntry["classification"]
  operation: GrowthResetCountOperation
  code: string | null
  message: string
  details: string | null
  hint: string | null
  http_status: number | null
  http_status_text: string | null
  schema: string
  select: string
  query: string
  count_source: "postgrest" | "management_api_sql"
  raw_error: unknown
  response_body: string | null
}

export type GrowthResetCountContext = {
  projectRef?: string | null
  accessToken?: string | null
}

export type GrowthResetCountResult =
  | { ok: true; count: number; source: GrowthResetCountError["count_source"] }
  | { ok: false; error: GrowthResetCountError }

type PostgrestCountResponse = {
  count: number | null
  error: unknown
  status?: number
  statusText?: string
  data?: unknown
}

function quoteGrowthTableIdent(table: string): string {
  if (!/^[a-z][a-z0-9_]*$/i.test(table)) {
    throw new Error(`Unsafe growth table identifier: ${table}`)
  }
  return `"${table}"`
}

export function describeGrowthResetCountQuery(
  schema: string,
  table: string,
  select: string,
  filters?: string[],
): string {
  const filterSuffix = filters?.length ? `&${filters.join("&")}` : ""
  return `${schema}.${table} HEAD/GET ?select=${encodeURIComponent(select)}${filterSuffix} (Prefer: count=exact)`
}

function truncateText(value: string, max = 2000): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

function readErrorField(error: unknown, key: string): unknown {
  if (error === null || error === undefined) return undefined
  if (typeof error === "object") {
    const record = error as Record<string, unknown>
    if (key in record) return record[key]
  }
  return undefined
}

function readErrorMessage(error: unknown): string | null {
  if (error === null || error === undefined) return null
  if (typeof error === "string") return error.trim() || null
  if (error instanceof Error) {
    const parts = [error.message, error.name !== "Error" ? error.name : ""].filter(Boolean)
    const combined = parts.join(": ").trim()
    return combined || null
  }

  const message = readErrorField(error, "message")
  if (typeof message === "string" && message.trim()) return message.trim()
  if (typeof message === "number" || typeof message === "boolean") return String(message)

  if (typeof error === "object") {
    const record = error as Record<string, unknown>
    const hasOnlyEmptyMessage =
      Object.keys(record).length > 0 &&
      Object.keys(record).every((key) => {
        const value = record[key]
        return value === null || value === undefined || value === ""
      })
    if (hasOnlyEmptyMessage) return null
  }

  try {
    const serialized = JSON.stringify(error)
    if (serialized && serialized !== "{}" && serialized !== "[]" && serialized !== '{"message":""}') {
      return serialized
    }
  } catch {
    // ignore
  }
  return String(error)
}

function readErrorCode(error: unknown): string | null {
  const code = readErrorField(error, "code")
  if (typeof code === "string" && code.trim()) return code.trim()
  if (typeof code === "number") return String(code)
  return null
}

function readErrorDetails(error: unknown): string | null {
  const details = readErrorField(error, "details")
  if (typeof details === "string" && details.trim()) return details.trim()
  if (details !== undefined && details !== null) {
    try {
      return truncateText(JSON.stringify(details), 1000)
    } catch {
      return String(details)
    }
  }
  return null
}

function readErrorHint(error: unknown): string | null {
  const hint = readErrorField(error, "hint")
  return typeof hint === "string" && hint.trim() ? hint.trim() : null
}

function synthesizeCountMessage(input: {
  error: unknown
  httpStatus: number | null
  httpStatusText: string | null
  responseBody: string | null
  table: string
  schema: string
}): string {
  const fromError = readErrorMessage(input.error)
  if (fromError) return fromError

  if (input.responseBody?.trim()) {
    try {
      const parsed = JSON.parse(input.responseBody) as unknown
      const parsedMessage = readErrorMessage(parsed)
      if (parsedMessage) return parsedMessage
    } catch {
      return truncateText(input.responseBody.trim(), 500)
    }
    return truncateText(input.responseBody.trim(), 500)
  }

  if (input.httpStatus !== null && input.httpStatus !== undefined) {
    const statusText = input.httpStatusText?.trim() ?? ""
    const base = `HTTP ${input.httpStatus}${statusText ? ` ${statusText}` : ""}`.trim()
    if (input.httpStatus === 401 || input.httpStatus === 403) {
      return `${base} — PostgREST denied access to ${input.schema}.${input.table}. This usually means the table is missing explicit GRANT SELECT privileges for service_role (RLS policies alone are not enough).`
    }
    return base
  }

  return "Growth reset count failed with no PostgREST error message"
}

function isMissingTableMessage(message: string): boolean {
  return /does not exist|Could not find|relation .* does not exist|PGRST205/i.test(message)
}

function isMissingColumnMessage(message: string): boolean {
  return /column .* does not exist|42703/i.test(message)
}

function isPermissionDenied(input: {
  message: string
  code: string | null
  httpStatus: number | null
}): boolean {
  if (input.httpStatus === 401 || input.httpStatus === 403) return true
  if (input.code === "42501") return true
  return /permission denied|insufficient privilege|row-level security|PGRST301/i.test(input.message)
}

function buildGrowthResetCountError(input: {
  table: string
  classification: GrowthResetTableCatalogEntry["classification"]
  operation: GrowthResetCountOperation
  select: string
  query: string
  countSource: GrowthResetCountError["count_source"]
  response: PostgrestCountResponse
  responseBody?: string | null
}): GrowthResetCountError {
  const httpStatus = input.response.status ?? null
  const httpStatusText = input.response.statusText ?? null
  const responseBody = input.responseBody ?? null
  const code = readErrorCode(input.response.error)
  const details = readErrorDetails(input.response.error)
  let hint = readErrorHint(input.response.error)
  const message = synthesizeCountMessage({
    error: input.response.error,
    httpStatus,
    httpStatusText,
    responseBody,
    table: input.table,
    schema: GROWTH_RESET_SCHEMA,
  })

  if (!hint && isPermissionDenied({ message, code, httpStatus })) {
    hint =
      "Grant SELECT (and DELETE for confirm reset) on this table to service_role, or run count via Supabase Management API SQL using SUPABASE_ACCESS_TOKEN."
  }

  return {
    table: input.table,
    classification: input.classification,
    operation: input.operation,
    code,
    message,
    details,
    hint,
    http_status: httpStatus,
    http_status_text: httpStatusText,
    schema: GROWTH_RESET_SCHEMA,
    select: input.select,
    query: input.query,
    count_source: input.countSource,
    raw_error: input.response.error ?? null,
    response_body: responseBody ? truncateText(responseBody) : null,
  }
}

async function runPostgrestCount(
  admin: SupabaseClient,
  table: string,
  select: string,
  applyFilters?: (
    query: ReturnType<ReturnType<SupabaseClient["schema"]>["from"]>,
  ) => ReturnType<ReturnType<SupabaseClient["schema"]>["from"]>,
): Promise<PostgrestCountResponse & { query: string }> {
  const queryDescription = describeGrowthResetCountQuery(GROWTH_RESET_SCHEMA, table, select)
  let builder = admin.schema(GROWTH_RESET_SCHEMA).from(table).select(select, { count: "exact", head: true })
  if (applyFilters) {
    builder = applyFilters(builder)
  }
  const response = (await builder) as PostgrestCountResponse
  return { ...response, query: queryDescription }
}

async function countViaManagementApiSql(input: {
  projectRef: string
  accessToken: string
  table: string
}): Promise<{ ok: true; count: number } | { ok: false; message: string; responseBody: string | null; httpStatus: number | null }> {
  const query = `select count(*)::bigint as count from ${GROWTH_RESET_SCHEMA}.${quoteGrowthTableIdent(input.table)}`
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${encodeURIComponent(input.projectRef)}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  )

  const responseBody = await response.text()
  if (!response.ok) {
    return {
      ok: false,
      message: `Management API SQL count failed: HTTP ${response.status} ${response.statusText}${responseBody ? ` — ${truncateText(responseBody, 300)}` : ""}`,
      responseBody: responseBody || null,
      httpStatus: response.status,
    }
  }

  let rows: unknown
  try {
    rows = JSON.parse(responseBody)
  } catch {
    return {
      ok: false,
      message: `Management API SQL count returned non-JSON: ${truncateText(responseBody, 300)}`,
      responseBody,
      httpStatus: response.status,
    }
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: true, count: 0 }
  }

  const first = rows[0] as Record<string, unknown>
  const rawCount = first.count ?? first.COUNT ?? first["count(*)"]
  const count = typeof rawCount === "number" ? rawCount : Number(rawCount)
  if (!Number.isFinite(count)) {
    return {
      ok: false,
      message: `Management API SQL count returned unexpected payload: ${truncateText(responseBody, 300)}`,
      responseBody,
      httpStatus: response.status,
    }
  }

  return { ok: true, count }
}

async function tryManagementApiCountFallback(input: {
  context: GrowthResetCountContext | undefined
  table: string
  classification: GrowthResetTableCatalogEntry["classification"]
  operation: GrowthResetCountOperation
  select: string
  query: string
  postgrestError: GrowthResetCountError
}): Promise<GrowthResetCountResult | null> {
  const projectRef = input.context?.projectRef?.trim()
  const accessToken = input.context?.accessToken?.trim()
  if (!projectRef || !accessToken) return null
  if (!isPermissionDenied({
    message: input.postgrestError.message,
    code: input.postgrestError.code,
    httpStatus: input.postgrestError.http_status,
  })) {
    return null
  }

  const sqlResult = await countViaManagementApiSql({
    projectRef,
    accessToken,
    table: input.table,
  })

  if (sqlResult.ok) {
    return { ok: true, count: sqlResult.count, source: "management_api_sql" }
  }

  return {
    ok: false,
    error: {
      ...input.postgrestError,
      message: `${input.postgrestError.message} | ${sqlResult.message}`,
      count_source: "management_api_sql",
      response_body: sqlResult.responseBody ? truncateText(sqlResult.responseBody) : input.postgrestError.response_body,
      http_status: sqlResult.httpStatus ?? input.postgrestError.http_status,
    },
  }
}

export async function countGrowthResetTableRows(
  admin: SupabaseClient,
  table: string,
  classification: GrowthResetTableCatalogEntry["classification"],
  operation: GrowthResetCountOperation = "count",
  context?: GrowthResetCountContext,
): Promise<GrowthResetCountResult> {
  let lastFailure: GrowthResetCountError | null = null

  for (const select of COUNT_SELECT_COLUMNS) {
    const response = await runPostgrestCount(admin, table, select)
    if (!response.error) {
      return { ok: true, count: response.count ?? 0, source: "postgrest" }
    }

    const failure = buildGrowthResetCountError({
      table,
      classification,
      operation,
      select,
      query: response.query,
      countSource: "postgrest",
      response,
    })
    lastFailure = failure

    if (isMissingTableMessage(failure.message)) {
      return { ok: true, count: 0, source: "postgrest" }
    }
    if (select === "id" && isMissingColumnMessage(failure.message)) {
      continue
    }
  }

  if (lastFailure) {
    const fallback = await tryManagementApiCountFallback({
      context,
      table,
      classification,
      operation,
      select: lastFailure.select,
      query: lastFailure.query,
      postgrestError: lastFailure,
    })
    if (fallback) return fallback
    return { ok: false, error: lastFailure }
  }

  return {
    ok: false,
    error: {
      table,
      classification,
      operation,
      code: null,
      message: "Growth reset count failed before PostgREST returned a response",
      details: null,
      hint: null,
      http_status: null,
      http_status_text: null,
      schema: GROWTH_RESET_SCHEMA,
      select: COUNT_SELECT_COLUMNS[0],
      query: describeGrowthResetCountQuery(GROWTH_RESET_SCHEMA, table, COUNT_SELECT_COLUMNS[0]),
      count_source: "postgrest",
      raw_error: null,
      response_body: null,
    },
  }
}

export async function countGrowthResetFilteredRows(
  admin: SupabaseClient,
  input: {
    table: string
    classification: GrowthResetTableCatalogEntry["classification"]
    operation: Exclude<GrowthResetCountOperation, "count">
    select?: string
    filterDescription: string
    applyFilters: (
      query: ReturnType<ReturnType<SupabaseClient["schema"]>["from"]>,
    ) => ReturnType<ReturnType<SupabaseClient["schema"]>["from"]>
  },
  context?: GrowthResetCountContext,
): Promise<GrowthResetCountResult> {
  const select = input.select ?? "id"
  const response = await runPostgrestCount(admin, input.table, select, input.applyFilters)
  if (!response.error) {
    return { ok: true, count: response.count ?? 0, source: "postgrest" }
  }

  const failure = buildGrowthResetCountError({
    table: input.table,
    classification: input.classification,
    operation: input.operation,
    select,
    query: `${response.query} (${input.filterDescription})`,
    countSource: "postgrest",
    response,
  })

  if (input.operation === "preserved_fk_count" && isMissingColumnMessage(failure.message)) {
    return { ok: true, count: 0, source: "postgrest" }
  }

  const fallback = await tryManagementApiCountFallback({
    context,
    table: input.table,
    classification: input.classification,
    operation: input.operation,
    select,
    query: failure.query,
    postgrestError: failure,
  })
  if (fallback) return fallback

  return { ok: false, error: failure }
}

/** @internal Test helper — formats a PostgREST count failure with full diagnostics. */
export function formatGrowthResetCountFailureForTest(input: {
  table: string
  classification: GrowthResetTableCatalogEntry["classification"]
  operation?: GrowthResetCountOperation
  select?: string
  response: PostgrestCountResponse
}): GrowthResetCountError {
  const select = input.select ?? "id"
  return buildGrowthResetCountError({
    table: input.table,
    classification: input.classification,
    operation: input.operation ?? "count",
    select,
    query: describeGrowthResetCountQuery(GROWTH_RESET_SCHEMA, input.table, select),
    countSource: "postgrest",
    response: input.response,
  })
}
