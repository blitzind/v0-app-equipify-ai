/**
 * Local Twilio Media Streams websocket server.
 * Run: pnpm voice:media-websocket-dev
 *
 * Point VOICE_MEDIA_STREAM_PUBLIC_ORIGIN at this server's public URL (ngrok/wss).
 */
import {
  createVoiceMediaWebsocketHost,
  registerVoiceMediaWebsocketSignalHandlers,
} from "../services/voice-media-websocket/bootstrap"

async function main(): Promise<void> {
  const host = await createVoiceMediaWebsocketHost({ mode: "development" })
  registerVoiceMediaWebsocketSignalHandlers(host)
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "voice-media-websocket",
      event: "startup_failed",
      message: error instanceof Error ? error.message : String(error),
    }),
  )
  process.exit(1)
})
