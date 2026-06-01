/**
 * Voice media websocket production service regression checks.
 * Run: pnpm test:voice-media-websocket-production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function assertNoTopLevelAwait(source: string, label: string): void {
  const lines = source.split("\n")
  let depth = 0
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) continue

    const openCount = (line.match(/\{/g) ?? []).length
    const closeCount = (line.match(/\}/g) ?? []).length
    const isTopLevelAwait = depth === 0 && /^\s*await\s+/.test(line)
    assert.ok(!isTopLevelAwait, `${label} must not use top-level await (line ${index + 1}): ${trimmed}`)

    depth += openCount - closeCount
    if (depth < 0) depth = 0
  }
}

const bootstrapSource = fs.readFileSync(
  path.join(process.cwd(), "services/voice-media-websocket/bootstrap.ts"),
  "utf8",
)
assert.match(bootstrapSource, /VOICE_MEDIA_WEBSOCKET_SERVICE_NAME = "voice-media-websocket"/)
assert.match(bootstrapSource, /\/health/)
assert.match(bootstrapSource, /\/ready/)
assert.match(bootstrapSource, /registerVoiceMediaWebsocketSignalHandlers/)
assert.match(bootstrapSource, /SIGTERM/)
assert.match(bootstrapSource, /logService\("listening"/)
assert.match(bootstrapSource, /resolveListenPort/)
assert.match(bootstrapSource, /8080/)
assertNoTopLevelAwait(bootstrapSource, "bootstrap.ts")

const serverSource = fs.readFileSync(
  path.join(process.cwd(), "services/voice-media-websocket/server.ts"),
  "utf8",
)
assert.match(serverSource, /async function main\(\)/)
assert.match(serverSource, /main\(\)\.catch/)
assert.match(serverSource, /mode: "production"/)
assert.doesNotMatch(serverSource, /^const host = await/m)
assertNoTopLevelAwait(serverSource, "server.ts")

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
assert.match(devServer, /async function main\(\)/)
assertNoTopLevelAwait(devServer, "voice-media-websocket-dev-server.ts")

console.log("voice-media-websocket-production checks passed")
