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

const host = await createVoiceMediaWebsocketHost({ mode: "production" })
registerVoiceMediaWebsocketSignalHandlers(host)
