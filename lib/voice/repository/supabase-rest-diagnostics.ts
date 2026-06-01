/** Supabase PostgREST response diagnostics for voice media streaming (Railway websocket service). */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER } from "@/lib/voice/media-streaming/voice-stream-lifecycle"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export const VOICE_SUPABASE_REST_DIAGNOSTICS_QA_MARKER = "voice-supabase-rest-diagnostics-v1" as const

const RESPONSE_PREVIEW_MAX_CHARS = 200
const JWT_LIKE_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g

export function sanitizeSupabaseRestResponsePreview(body: string): string {
  const compact = body.replace(/\s+/g, " ").trim()
  const redacted = compact.replace(JWT_LIKE_RE, "[REDACTED_JWT]")
  if (redacted.length <= RESPONSE_PREVIEW_MAX_CHARS) return redacted
  return `${redacted.slice(0, RESPONSE_PREVIEW_MAX_CHARS)}…`
}

export function sanitizeSupabaseRestUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    return `${url.origin}${url.pathname}`
  } catch {
    return rawUrl.split("?")[0] ?? rawUrl
  }
}

export function classifySupabaseRestEndpoint(rawUrl: string): "postgrest" | "rpc" | "auth" | "storage" | "other" {
  const path = sanitizeSupabaseRestUrl(rawUrl).toLowerCase()
  if (path.includes("/rest/v1/rpc/")) return "rpc"
  if (path.includes("/rest/v1/")) return "postgrest"
  if (path.includes("/auth/v1/")) return "auth"
  if (path.includes("/storage/v1/")) return "storage"
  return "other"
}

export function isHtmlSupabaseRestResponse(contentType: string, bodyPreview: string): boolean {
  const normalizedType = contentType.toLowerCase()
  if (normalizedType.includes("text/html")) return true
  const trimmed = bodyPreview.trim().toLowerCase()
  return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html") || trimmed.includes("cloudflare")
}

export type VoiceMediaRepositoryQueryContext = {
  operation: string
  table: string
  organizationId?: string
  mediaSessionId?: string
  transcriptSessionId?: string
}

export function logVoiceMediaRepositoryQueryFailure(
  context: VoiceMediaRepositoryQueryContext,
  error: unknown,
  extra: Record<string, unknown> = {},
): void {
  const message = error instanceof Error ? error.message : String(error)
  const htmlDetected =
    message.toLowerCase().includes("<html") ||
    message.toLowerCase().includes("<!doctype") ||
    message.toLowerCase().includes("cloudflare")

  logVoiceInfrastructure("voice_supabase_rest_query_failed", {
    qaMarker: VOICE_SUPABASE_REST_DIAGNOSTICS_QA_MARKER,
    foundationMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
    operation: context.operation,
    table: context.table,
    organizationId: context.organizationId ?? null,
    mediaSessionId: context.mediaSessionId ?? null,
    transcriptSessionId: context.transcriptSessionId ?? null,
    message: sanitizeSupabaseRestResponsePreview(message),
    responseLooksLikeHtml: htmlDetected,
    bodyPreview: htmlDetected ? sanitizeSupabaseRestResponsePreview(message) : null,
    ...extra,
  })
}

export async function executeVoiceMediaRepositoryQuery<T>(
  context: VoiceMediaRepositoryQueryContext,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    logVoiceMediaRepositoryQueryFailure(context, error, {
      supabaseUrlHost: sanitizeSupabaseRestUrl(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "unset"),
      endpointKind: "postgrest",
    })
    throw error
  }
}

export function createInstrumentedSupabaseRestFetch(input: {
  service: string
}): typeof fetch {
  return async (requestInput, init) => {
    const requestUrl =
      typeof requestInput === "string"
        ? requestInput
        : requestInput instanceof URL
          ? requestInput.toString()
          : requestInput.url
    const method = init?.method ?? (typeof requestInput !== "string" && !(requestInput instanceof URL) ? requestInput.method : "GET")
    const sanitizedUrl = sanitizeSupabaseRestUrl(requestUrl)

    try {
      const response = await fetch(requestInput, init)
      const contentType = response.headers.get("content-type") ?? "unknown"
      const shouldCaptureBody = !response.ok || !contentType.toLowerCase().includes("json")

      if (shouldCaptureBody) {
        const bodyText = await response.clone().text()
        const bodyPreview = sanitizeSupabaseRestResponsePreview(bodyText)
        logVoiceInfrastructure("voice_supabase_rest_anomaly", {
          qaMarker: VOICE_SUPABASE_REST_DIAGNOSTICS_QA_MARKER,
          foundationMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
          service: input.service,
          requestUrl: sanitizedUrl,
          endpointKind: classifySupabaseRestEndpoint(requestUrl),
          httpStatus: response.status,
          httpStatusText: response.statusText,
          contentType,
          method,
          responseLooksLikeHtml: isHtmlSupabaseRestResponse(contentType, bodyPreview),
          bodyPreview,
        })
      }

      return response
    } catch (error) {
      logVoiceInfrastructure("voice_supabase_rest_fetch_failed", {
        qaMarker: VOICE_SUPABASE_REST_DIAGNOSTICS_QA_MARKER,
        foundationMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
        service: input.service,
        requestUrl: sanitizedUrl,
        endpointKind: classifySupabaseRestEndpoint(requestUrl),
        method,
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}

/** Service-role Supabase client with PostgREST fetch diagnostics for voice media websocket ingestion. */
export function createVoiceMediaStreamingServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: createInstrumentedSupabaseRestFetch({ service: "voice-media-websocket" }),
    },
  })
}
