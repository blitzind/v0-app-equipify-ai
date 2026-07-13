/** GE-DATAMOON-1A — Datamoon HTTP client with safe error handling. Server-only. */

import "server-only"

import {
  DATAMOON_DEFAULT_MAX_RETRIES,
  DATAMOON_DEFAULT_REQUEST_TIMEOUT_MS,
} from "@/lib/growth/providers/datamoon/datamoon-config"
import type { DatamoonApiErrorCategory } from "@/lib/growth/providers/datamoon/datamoon-types"

export type DatamoonHttpAuthMode = "header" | "body"

export type DatamoonHttpResult<T> = {
  ok: boolean
  status: number
  data: T | null
  error: string | null
  error_category: DatamoonApiErrorCategory | null
  validation_errors: Record<string, string[]> | null
  allowed_fields: string[] | null
  latency_ms: number
  attempts: number
}

export type DatamoonFetchImpl = typeof fetch

type DatamoonJsonRequestInput = {
  url: string
  method?: "GET" | "POST"
  authMode: DatamoonHttpAuthMode
  apiKey: string
  body?: Record<string, unknown>
  timeout_ms?: number
  max_retries?: number
  fetchImpl?: DatamoonFetchImpl
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function redactSensitiveText(text: string): string {
  return text
    .replace(/api_key[=:]["']?[^"'&\s]+/gi, "api_key=[REDACTED]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]")
}

function parseValidationPayload(payload: unknown): {
  validation_errors: Record<string, string[]> | null
  allowed_fields: string[] | null
  message: string | null
} {
  if (!payload || typeof payload !== "object") {
    return { validation_errors: null, allowed_fields: null, message: null }
  }
  const record = payload as Record<string, unknown>
  const validation_errors =
    record.errors && typeof record.errors === "object"
      ? (record.errors as Record<string, string[]>)
      : null
  const allowed_fields = Array.isArray(record.allowed_fields)
    ? record.allowed_fields.filter((field): field is string => typeof field === "string")
    : null
  const message = typeof record.message === "string" ? record.message : null
  return { validation_errors, allowed_fields, message }
}

export function classifyDatamoonHttpStatus(status: number): DatamoonApiErrorCategory | null {
  switch (status) {
    case 400:
      return "bad_request"
    case 401:
      return "unauthorized"
    case 403:
      return "forbidden"
    case 404:
      return "not_found"
    case 422:
      return "validation"
    case 500:
      return "server_error"
    default:
      return status >= 500 ? "server_error" : null
  }
}

function buildErrorMessage(
  status: number,
  payload: unknown,
  fallback: string,
): { error: string; error_category: DatamoonApiErrorCategory | null; validation_errors: Record<string, string[]> | null; allowed_fields: string[] | null } {
  const parsed = parseValidationPayload(payload)
  const category = classifyDatamoonHttpStatus(status)
  const baseMessage = parsed.message ?? fallback
  return {
    error: redactSensitiveText(baseMessage),
    error_category: category,
    validation_errors: parsed.validation_errors,
    allowed_fields: parsed.allowed_fields,
  }
}

export async function fetchDatamoonJson<T>(input: DatamoonJsonRequestInput): Promise<DatamoonHttpResult<T>> {
  const started = performance.now()
  const method = input.method ?? "GET"
  const timeout_ms = input.timeout_ms ?? DATAMOON_DEFAULT_REQUEST_TIMEOUT_MS
  const max_retries = input.max_retries ?? DATAMOON_DEFAULT_MAX_RETRIES
  const fetchImpl = input.fetchImpl ?? fetch
  let attempts = 0
  let lastError: string | null = null
  let lastStatus = 0
  let lastCategory: DatamoonApiErrorCategory | null = null
  let lastValidationErrors: Record<string, string[]> | null = null
  let lastAllowedFields: string[] | null = null

  const requestBody =
    input.authMode === "body"
      ? { ...(input.body ?? {}), api_key: input.apiKey }
      : input.body

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (input.authMode === "header") {
    headers["X-Api-Key"] = input.apiKey
  }

  for (let attempt = 0; attempt <= max_retries; attempt += 1) {
    attempts = attempt + 1
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout_ms)

    try {
      const res = await fetchImpl(input.url, {
        method,
        headers,
        body: method === "POST" && requestBody != null ? JSON.stringify(requestBody) : undefined,
        signal: controller.signal,
      })
      clearTimeout(timer)
      lastStatus = res.status

      const text = await res.text()
      let parsed: T | null = null
      if (text.trim()) {
        try {
          parsed = JSON.parse(text) as T
        } catch {
          lastError = redactSensitiveText(`Datamoon response parse failed (${res.status}).`)
          lastCategory = classifyDatamoonHttpStatus(res.status) ?? "network"
          if (res.status >= 500 && attempt < max_retries) {
            await sleep(250 * 2 ** attempt)
            continue
          }
          break
        }
      }

      if (!res.ok) {
        const built = buildErrorMessage(res.status, parsed, `Datamoon request failed (${res.status}).`)
        lastError = built.error
        lastCategory = built.error_category
        lastValidationErrors = built.validation_errors
        lastAllowedFields = built.allowed_fields
        if (res.status >= 500 && attempt < max_retries) {
          await sleep(250 * 2 ** attempt)
          continue
        }
        break
      }

      return {
        ok: true,
        status: res.status,
        data: parsed,
        error: null,
        error_category: null,
        validation_errors: null,
        allowed_fields: null,
        latency_ms: Math.round(performance.now() - started),
        attempts,
      }
    } catch (err) {
      clearTimeout(timer)
      lastError = redactSensitiveText(err instanceof Error ? err.message : "Datamoon request failed.")
      lastCategory = "network"
      if (attempt < max_retries) {
        await sleep(250 * 2 ** attempt)
        continue
      }
    }
  }

  return {
    ok: false,
    status: lastStatus,
    data: null,
    error: lastError ?? "Datamoon request failed.",
    error_category: lastCategory,
    validation_errors: lastValidationErrors,
    allowed_fields: lastAllowedFields,
    latency_ms: Math.round(performance.now() - started),
    attempts,
  }
}
