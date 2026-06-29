/** GE-PROVIDERS-1A — PDL HTTP client with timeout, retry, and rate-limit backoff. Server-only. */

import "server-only"

import {
  PDL_DEFAULT_MAX_RETRIES,
  PDL_DEFAULT_REQUEST_TIMEOUT_MS,
} from "@/lib/growth/providers/pdl/pdl-config"
import { isPdlRateLimitError } from "@/lib/growth/providers/pdl/pdl-provider-diagnostics"

export type PdlHttpResult<T> = {
  ok: boolean
  status: number
  data: T | null
  error: string | null
  rate_limited: boolean
  latency_ms: number
  attempts: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchPdlJson<T>(input: {
  url: string
  apiKey: string
  method?: "GET" | "POST"
  body?: unknown
  timeout_ms?: number
  max_retries?: number
}): Promise<PdlHttpResult<T>> {
  const started = performance.now()
  const method = input.method ?? "GET"
  const timeout_ms = input.timeout_ms ?? PDL_DEFAULT_REQUEST_TIMEOUT_MS
  const max_retries = input.max_retries ?? PDL_DEFAULT_MAX_RETRIES
  let attempts = 0
  let lastError: string | null = null
  let lastStatus = 0
  let rate_limited = false

  for (let attempt = 0; attempt <= max_retries; attempt += 1) {
    attempts = attempt + 1
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout_ms)

    try {
      const res = await fetch(input.url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Api-Key": input.apiKey,
        },
        body: method === "POST" && input.body != null ? JSON.stringify(input.body) : undefined,
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
          lastError = `PDL response parse failed (${res.status}).`
          if (attempt < max_retries) {
            await sleep(250 * 2 ** attempt)
            continue
          }
          break
        }
      }

      if (res.status === 429 || isPdlRateLimitError(text)) {
        rate_limited = true
        lastError = `PDL rate limited (${res.status}).`
        if (attempt < max_retries) {
          await sleep(500 * 2 ** attempt)
          continue
        }
        break
      }

      if (!res.ok) {
        lastError =
          typeof parsed === "object" &&
          parsed &&
          "error" in parsed &&
          typeof (parsed as { error?: unknown }).error === "string"
            ? String((parsed as { error: string }).error)
            : `PDL request failed (${res.status}).`
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
        rate_limited: false,
        latency_ms: Math.round(performance.now() - started),
        attempts,
      }
    } catch (err) {
      clearTimeout(timer)
      lastError = err instanceof Error ? err.message : "PDL request failed."
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
    error: lastError ?? "PDL request failed.",
    rate_limited,
    latency_ms: Math.round(performance.now() - started),
    attempts,
  }
}
