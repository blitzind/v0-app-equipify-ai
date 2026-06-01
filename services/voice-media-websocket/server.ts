/**
 * Production entrypoint for Equipify Twilio Media Streams websocket service.
 *
 * Deploy via Railway using services/voice-media-websocket/Dockerfile.
 * Local: pnpm voice:media-websocket-production
 */
import {
  createVoiceMediaWebsocketHost,
  registerVoiceMediaWebsocketSignalHandlers,
} from "./bootstrap"

async function main(): Promise<void> {
  const host = await createVoiceMediaWebsocketHost({ mode: "production" })
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
