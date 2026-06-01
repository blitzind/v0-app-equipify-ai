/**
 * Production host bootstrap for Twilio Media Streams websocket ingestion.
 * Shared by services/voice-media-websocket/server.ts and the local dev script.
 */
import http from "node:http"
import type { Server as HttpServer } from "node:http"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  attachTwilioMediaWebSocketUpgradeHandler,
  getTwilioMediaWebSocketPath,
  type VoiceMediaWebSocketServerHandle,
} from "@/lib/voice/media-streaming/twilio-media-websocket-server"
import { VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER } from "@/lib/voice/media-streaming/voice-stream-lifecycle"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export const VOICE_MEDIA_WEBSOCKET_SERVICE_NAME = "voice-media-websocket" as const
export const VOICE_MEDIA_WEBSOCKET_SERVICE_VERSION = "1.0.0" as const

export type VoiceMediaWebsocketRuntimeMode = "production" | "development"

export type VoiceMediaWebsocketHostOptions = {
  mode?: VoiceMediaWebsocketRuntimeMode
  port?: number
  host?: string
  shutdownTimeoutMs?: number
}

export type VoiceMediaWebsocketHost = {
  server: HttpServer
  admin: SupabaseClient | null
  websocket: VoiceMediaWebSocketServerHandle | null
  port: number
  startedAt: string
  close: (signal?: string) => Promise<void>
}

type HealthSnapshot = {
  ok: boolean
  service: typeof VOICE_MEDIA_WEBSOCKET_SERVICE_NAME
  version: typeof VOICE_MEDIA_WEBSOCKET_SERVICE_VERSION
  qaMarker: typeof VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER
  mode: VoiceMediaWebsocketRuntimeMode
  uptimeSeconds: number
  websocketPath: string
  activeConnections: number
  startupStatus: "live" | "ready" | "degraded"
  startupError: string | null
  checks: {
    supabaseConfigured: boolean
    growthOrgConfigured: boolean
    deepgramConfigured: boolean
  }
  supabaseReachable: boolean | null
  message: string
}

let shuttingDown = false

function resolveListenPort(explicit?: number): number {
  const fromEnv = process.env.PORT?.trim() || process.env.VOICE_MEDIA_WEBSOCKET_PORT?.trim()
  const parsed = explicit ?? (fromEnv ? Number.parseInt(fromEnv, 10) : 8080)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8080
}

function logService(event: string, details: Record<string, unknown> = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    service: VOICE_MEDIA_WEBSOCKET_SERVICE_NAME,
    version: VOICE_MEDIA_WEBSOCKET_SERVICE_VERSION,
    event,
    pid: process.pid,
    ...details,
  }
  console.log(JSON.stringify(payload))
  logVoiceInfrastructure("voice_media_websocket_production", payload)
}

function validateStartupEnv(mode: VoiceMediaWebsocketRuntimeMode): string[] {
  const missing: string[] = []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL")
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY")
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) missing.push("GROWTH_ENGINE_AI_ORG_ID")
  if (mode === "production" && !process.env.DEEPGRAM_API_KEY?.trim()) {
    logService("startup_warning", {
      warning: "DEEPGRAM_API_KEY missing — media sessions will start but live transcription bridge stays inactive.",
    })
  }
  return missing
}

function buildEnvChecks() {
  return {
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    ),
    growthOrgConfigured: Boolean(process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()),
    deepgramConfigured: Boolean(process.env.DEEPGRAM_API_KEY?.trim()),
  }
}

async function probeSupabase(admin: SupabaseClient): Promise<boolean> {
  try {
    const { error } = await admin.schema("voice").from("voice_media_sessions").select("id").limit(1)
    return !error
  } catch {
    return false
  }
}

function buildLivenessSnapshot(input: {
  mode: VoiceMediaWebsocketRuntimeMode
  startedAt: number
  websocket: VoiceMediaWebSocketServerHandle | null
  startupError: string | null
  websocketReady: boolean
}): HealthSnapshot {
  const checks = buildEnvChecks()
  return {
    ok: true,
    service: VOICE_MEDIA_WEBSOCKET_SERVICE_NAME,
    version: VOICE_MEDIA_WEBSOCKET_SERVICE_VERSION,
    qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
    mode: input.mode,
    uptimeSeconds: Math.floor((Date.now() - input.startedAt) / 1000),
    websocketPath: getTwilioMediaWebSocketPath(),
    activeConnections: input.websocket?.getActiveConnectionCount() ?? 0,
    startupStatus: input.startupError ? "degraded" : input.websocketReady ? "ready" : "live",
    startupError: input.startupError,
    checks,
    supabaseReachable: null,
    message: input.startupError
      ? "Voice media websocket service is live but media ingestion is not initialized."
      : "Voice media websocket service is live.",
  }
}

async function buildReadinessSnapshot(input: {
  admin: SupabaseClient | null
  mode: VoiceMediaWebsocketRuntimeMode
  startedAt: number
  websocket: VoiceMediaWebSocketServerHandle | null
  startupError: string | null
  websocketReady: boolean
}): Promise<HealthSnapshot> {
  const liveness = buildLivenessSnapshot(input)
  if (input.startupError || !input.admin || !input.websocketReady) {
    return {
      ...liveness,
      ok: false,
      startupStatus: "degraded",
      message: input.startupError ?? "Voice media websocket service is live but not ready for media ingestion.",
    }
  }

  const supabaseReachable = await probeSupabase(input.admin)
  const ok = liveness.checks.supabaseConfigured && liveness.checks.growthOrgConfigured && supabaseReachable

  return {
    ...liveness,
    ok,
    startupStatus: ok ? "ready" : "degraded",
    supabaseReachable,
    message: ok
      ? "Voice media websocket service is ready for Twilio Media Streams."
      : "Voice media websocket service is running but readiness checks failed.",
  }
}

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

function listen(server: HttpServer, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => resolve())
    server.on("error", reject)
  })
}

export async function createVoiceMediaWebsocketHost(
  options: VoiceMediaWebsocketHostOptions = {},
): Promise<VoiceMediaWebsocketHost> {
  const mode = options.mode ?? (process.env.NODE_ENV === "production" ? "production" : "development")
  const port = resolveListenPort(options.port)
  const host = options.host ?? "0.0.0.0"
  const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 30_000
  const startedAt = Date.now()

  let admin: SupabaseClient | null = null
  let websocket: VoiceMediaWebSocketServerHandle | null = null
  let startupError: string | null = null
  let websocketReady = false

  const server = http.createServer((req, res) => {
    void (async () => {
      if (shuttingDown) {
        writeJson(res, 503, { ok: false, message: "Service is shutting down." })
        return
      }

      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
      const snapshotInput = {
        admin,
        mode,
        startedAt,
        websocket,
        startupError,
        websocketReady,
      }

      if (url.pathname === "/health") {
        const snapshot = buildLivenessSnapshot(snapshotInput)
        writeJson(res, 200, snapshot)
        return
      }

      if (url.pathname === "/ready") {
        const snapshot = await buildReadinessSnapshot(snapshotInput)
        writeJson(res, snapshot.ok ? 200 : 503, snapshot)
        return
      }

      if (url.pathname === getTwilioMediaWebSocketPath() && req.method === "GET") {
        const snapshot = buildLivenessSnapshot(snapshotInput)
        writeJson(res, 200, {
          ...snapshot,
          ok: websocketReady,
          message: websocketReady
            ? "Twilio Media Streams websocket endpoint is reachable."
            : "Twilio Media Streams websocket endpoint is live but ingestion is not initialized.",
          supportedEvents: ["connected", "start", "media", "mark", "stop"],
        })
        return
      }

      writeJson(res, 404, { ok: false, message: "Not found." })
    })().catch((error) => {
      writeJson(res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : "Internal server error.",
      })
    })
  })

  const close = async (signal = "manual"): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    logService("shutdown_started", {
      signal,
      activeConnections: websocket?.getActiveConnectionCount() ?? 0,
    })

    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })

    if (websocket) {
      await websocket.close(shutdownTimeoutMs)
    }
    logService("shutdown_complete", { signal })
  }

  const hostRef: VoiceMediaWebsocketHost = {
    server,
    admin,
    websocket,
    port,
    startedAt: new Date(startedAt).toISOString(),
    close,
  }

  await listen(server, port, host)
  logService("listening", {
    mode,
    port,
    host,
    websocketPath: getTwilioMediaWebSocketPath(),
  })

  try {
    const missing = validateStartupEnv(mode)
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
    }

    admin = createServiceRoleSupabaseClient()
    websocket = attachTwilioMediaWebSocketUpgradeHandler(server, admin)
    websocketReady = true
    hostRef.admin = admin
    hostRef.websocket = websocket

    logService("startup_complete", {
      mode,
      port,
      host,
      websocketPath: getTwilioMediaWebSocketPath(),
      publicOriginHint: process.env.VOICE_MEDIA_STREAM_PUBLIC_ORIGIN ?? null,
    })
  } catch (error) {
    startupError = error instanceof Error ? error.message : String(error)
    logService("startup_degraded", {
      mode,
      port,
      message: startupError,
    })
  }

  return hostRef
}

export function registerVoiceMediaWebsocketSignalHandlers(host: VoiceMediaWebsocketHost): void {
  const shutdown = (signal: string) => {
    void host
      .close(signal)
      .then(() => {
        process.exit(0)
      })
      .catch((error) => {
        logService("shutdown_failed", {
          signal,
          message: error instanceof Error ? error.message : String(error),
        })
        process.exit(1)
      })
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}
