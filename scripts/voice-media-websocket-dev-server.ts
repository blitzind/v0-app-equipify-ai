/**
 * Local Twilio Media Streams websocket server.
 * Run: pnpm voice:media-websocket-dev
 *
 * Point VOICE_MEDIA_STREAM_PUBLIC_ORIGIN at this server's public URL (ngrok/wss).
 */
import http from "node:http"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { attachTwilioMediaWebSocketUpgradeHandler } from "@/lib/voice/media-streaming/twilio-media-websocket-server"
import { VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER } from "@/lib/voice/media-streaming/voice-stream-lifecycle"

const port = Number(process.env.VOICE_MEDIA_WEBSOCKET_PORT ?? 3001)

const admin = createServiceRoleSupabaseClient()
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" })
  res.end(
    JSON.stringify({
      ok: true,
      qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
      message: "Equipify voice media websocket dev server",
      path: "/api/voice/media/twilio",
    }),
  )
})

attachTwilioMediaWebSocketUpgradeHandler(server, admin)

server.listen(port, () => {
  console.info(
    JSON.stringify({
      source: "voice-media-websocket-dev",
      qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
      port,
      wssPath: "/api/voice/media/twilio",
    }),
  )
})
