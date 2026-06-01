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
  admin: SupabaseClient
  websocket: VoiceMediaWebSocketServerHandle
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

async function probeSupabase(admin: SupabaseClient): Promise<boolean> {
  try {
    const { error } = await admin.schema("voice").from("voice_media_sessions").select("id").limit(1)
    return !error
  } catch {
    return false
  }
}

async function buildHealthSnapshot(
  admin: SupabaseClient,
  websocket: VoiceMediaWebSocketServerHandle,
  mode: VoiceMediaWebsocketRuntimeMode,
  startedAt: number,
  includeSupabaseProbe: boolean,
): Promise<HealthSnapshot> {
  const checks = {
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    ),
    growthOrgConfigured: Boolean(process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()),
    deepgramConfigured: Boolean(process.env.DEEPGRAM_API_KEY?.trim()),
  }
  const supabaseReachable = includeSupabaseProbe ? await probeSupabase(admin) : null
  const configOk = checks.supabaseConfigured && checks.growthOrgConfigured
  const readyOk = configOk && (supabaseReachable ?? true)

  return {
    ok: readyOk,
    service: VOICE_MEDIA_WEBSOCKET_SERVICE_NAME,
    version: VOICE_MEDIA_WEBSOCKET_SERVICE_VERSION,
    qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
    mode,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    websocketPath: getTwilioMediaWebSocketPath(),
    activeConnections: websocket.getActiveConnectionCount(),
    checks,
    supabaseReachable,
    message: readyOk
      ? "Voice media websocket service is ready for Twilio Media Streams."
      : "Voice media websocket service is running but readiness checks failed.",
  }
}

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

export async function createVoiceMediaWebsocketHost(
  options: VoiceMediaWebsocketHostOptions = {},
): Promise<VoiceMediaWebsocketHost> {
  const mode = options.mode ?? (process.env.NODE_ENV === "production" ? "production" : "development")
  const missing = validateStartupEnv(mode)
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }

  const port = resolveListenPort(options.port)
  const host = options.host ?? "0.0.0.0"
  const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 30_000
  const startedAt = Date.now()
  const admin = createServiceRoleSupabaseClient()

  const server = http.createServer((req, res) => {
    void (async () => {
      if (shuttingDown) {
        writeJson(res, 503, { ok: false, message: "Service is shutting down." })
        return
      }

      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)

      if (url.pathname === "/health") {
        const snapshot = await buildHealthSnapshot(admin, websocket, mode, startedAt, false)
        writeJson(res, snapshot.ok ? 200 : 503, snapshot)
        return
      }

      if (url.pathname === "/ready") {
        const snapshot = await buildHealthSnapshot(admin, websocket, mode, startedAt, true)
        writeJson(res, snapshot.ok ? 200 : 503, snapshot)
        return
      }

      if (url.pathname === getTwilioMediaWebSocketPath() && req.method === "GET") {
        const snapshot = await buildHealthSnapshot(admin, websocket, mode, startedAt, false)
        writeJson(res, 200, {
          ...snapshot,
          ok: true,
          message: "Twilio Media Streams websocket endpoint is reachable.",
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

  const websocket = attachTwilioMediaWebSocketUpgradeHandler(server, admin)

  const close = async (signal = "manual"): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    logService("shutdown_started", { signal, activeConnections: websocket.getActiveConnectionCount() })

    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })

    await websocket.close(shutdownTimeoutMs)
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

  await new Promise<void>((resolve, reject) => {
    server.listen(port, host, () => resolve())
    server.on("error", reject)
  })

  logService("startup_complete", {
    mode,
    port,
    host,
    websocketPath: getTwilioMediaWebSocketPath(),
    publicOriginHint: process.env.VOICE_MEDIA_STREAM_PUBLIC_ORIGIN ?? null,
  })

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
