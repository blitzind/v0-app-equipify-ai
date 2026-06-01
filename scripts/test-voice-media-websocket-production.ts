/**
 * Voice media websocket production service regression checks.
 * Run: pnpm test:voice-media-websocket-production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const bootstrapSource = fs.readFileSync(
  path.join(process.cwd(), "services/voice-media-websocket/bootstrap.ts"),
  "utf8",
)
assert.match(bootstrapSource, /VOICE_MEDIA_WEBSOCKET_SERVICE_NAME = "voice-media-websocket"/)
assert.match(bootstrapSource, /\/health/)
assert.match(bootstrapSource, /\/ready/)
assert.match(bootstrapSource, /registerVoiceMediaWebsocketSignalHandlers/)
assert.match(bootstrapSource, /SIGTERM/)

const serverSource = fs.readFileSync(
  path.join(process.cwd(), "services/voice-media-websocket/server.ts"),
  "utf8",
)
assert.match(serverSource, /mode: "production"/)

const wsServerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/media-streaming/twilio-media-websocket-server.ts"),
  "utf8",
)
assert.match(wsServerSource, /getActiveConnectionCount/)
assert.match(wsServerSource, /close: async/)
assert.match(wsServerSource, /activeConnections/)
assert.match(wsServerSource, /MEDIA_STREAM_PATH = "\/api\/voice\/media\/twilio"/)

const dockerfile = fs.readFileSync(
  path.join(process.cwd(), "services/voice-media-websocket/Dockerfile"),
  "utf8",
)
assert.match(dockerfile, /HEALTHCHECK/)
assert.match(dockerfile, /services\/voice-media-websocket\/server.ts/)
assert.match(dockerfile, /--prod=false/)
const productionEnvIndex = dockerfile.indexOf("ENV NODE_ENV=production")
const installIndex = dockerfile.indexOf("pnpm install")
assert.ok(productionEnvIndex > installIndex, "NODE_ENV=production must be set after pnpm install")

const readme = fs.readFileSync(
  path.join(process.cwd(), "services/voice-media-websocket/README.md"),
  "utf8",
)
assert.match(readme, /Railway/)
assert.match(readme, /VOICE_MEDIA_STREAM_PUBLIC_ORIGIN/)

const devServer = fs.readFileSync(
  path.join(process.cwd(), "scripts/voice-media-websocket-dev-server.ts"),
  "utf8",
)
assert.match(devServer, /services\/voice-media-websocket\/bootstrap/)

console.log("voice-media-websocket-production checks passed")
