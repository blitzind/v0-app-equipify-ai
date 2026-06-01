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

const host = await createVoiceMediaWebsocketHost({ mode: "development" })
registerVoiceMediaWebsocketSignalHandlers(host)
