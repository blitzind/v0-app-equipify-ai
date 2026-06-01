import "server-only"

import type { Server as HttpServer } from "node:http"
import type { IncomingMessage } from "node:http"
import type { Duplex } from "node:stream"
import type { SupabaseClient } from "@supabase/supabase-js"
import { WebSocket, WebSocketServer } from "ws"
import { attachTwilioMediaWebSocketConnection } from "@/lib/voice/media-streaming/twilio-websocket-handler"
import { VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER } from "@/lib/voice/media-streaming/voice-stream-lifecycle"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

const MEDIA_STREAM_PATH = "/api/voice/media/twilio"

export type VoiceMediaWebSocketServerHandle = {
  wss: WebSocketServer
  getActiveConnectionCount: () => number
  close: (timeoutMs?: number) => Promise<void>
}

export function attachTwilioMediaWebSocketUpgradeHandler(
  server: HttpServer,
  admin: SupabaseClient,
): VoiceMediaWebSocketServerHandle {
  const wss = new WebSocketServer({ noServer: true })
  const activeConnections = new Set<WebSocket>()

  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
      if (url.pathname !== MEDIA_STREAM_PATH) {
        return
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        activeConnections.add(ws)
        logVoiceInfrastructure("voice_stream_connected", {
          qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
          path: url.pathname,
          activeConnections: activeConnections.size,
        })

        const adapter = {
          send(data: string) {
            ws.send(data)
          },
          close(code?: number, reason?: string) {
            ws.close(code, reason)
          },
          on(event: "message" | "close", listener: ((data: string) => void) | (() => void)) {
            if (event === "message") {
              ws.on("message", (data) => (listener as (data: string) => void)(String(data)))
              return
            }
            ws.on("close", listener as () => void)
          },
        }

        attachTwilioMediaWebSocketConnection(admin, adapter)
        ws.on("close", () => {
          activeConnections.delete(ws)
          logVoiceInfrastructure("voice_media_websocket_closed", {
            qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
            activeConnections: activeConnections.size,
          })
        })
        wss.emit("connection", ws, request)
      })
    } catch (error) {
      socket.destroy()
      logVoiceInfrastructure("voice_media_websocket_error", {
        qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
        message: error instanceof Error ? error.message : "upgrade_failed",
      })
    }
  })

  return {
    wss,
    getActiveConnectionCount: () => activeConnections.size,
    close: async (timeoutMs = 30_000) => {
      const closing = [...activeConnections]
      for (const ws of closing) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1001, "server_shutdown")
        }
      }

      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, timeoutMs)
        wss.close(() => {
          clearTimeout(timer)
          resolve()
        })
      })
      activeConnections.clear()
    },
  }
}

export function getTwilioMediaWebSocketPath(): string {
  return MEDIA_STREAM_PATH
}
