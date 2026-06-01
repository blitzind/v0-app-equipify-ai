/**
 * Browser inbound answer timing — regression checks.
 * Run: pnpm test:voice-browser-incoming-answer-timing
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildInboundRingingSessionPlaceholder,
  resolveInboundWorkspacePhase,
  shouldShowInboundAnswerControls,
} from "../lib/voice/browser-calling/browser-incoming-call"

assert.equal(
  resolveInboundWorkspacePhase({ activeSessionStatus: null, sdkIncoming: true }),
  "incoming",
  "SDK incoming should set workspace phase before DB session exists",
)

assert.equal(
  resolveInboundWorkspacePhase({ activeSessionStatus: "ringing", sdkIncoming: false }),
  "incoming",
  "DB ringing session should still show incoming phase",
)

assert.equal(
  shouldShowInboundAnswerControls({ sdkIncoming: true, activeSessionStatus: null }),
  true,
  "Answer controls should be available from SDK state alone",
)

const placeholder = buildInboundRingingSessionPlaceholder({
  incomingCall: {
    callSid: "CA123",
    fromNumber: "+14155550199",
    toNumber: "+18333784743",
    receivedAt: "2026-06-01T00:00:00.000Z",
  },
})
assert.equal(placeholder.status, "ringing")
assert.equal(placeholder.direction, "inbound")
assert.equal(placeholder.phoneNumber, "+14155550199")
assert.match(placeholder.id, /^pending-inbound-/)

const hookSource = fs.readFileSync(
  path.join(process.cwd(), "hooks/voice/use-voice-browser-calling.ts"),
  "utf8",
)
assert.match(hookSource, /device\.on\("incoming"/)
assert.match(hookSource, /call\.accept\(/)
assert.match(hookSource, /incomingCall/)
assert.match(hookSource, /acceptIncomingCall/)

const workspaceSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspaceSource, /acceptIncomingCall/)
assert.match(workspaceSource, /rejectIncomingCall/)
assert.match(workspaceSource, /resolveInboundWorkspacePhase/)
assert.match(workspaceSource, /buildInboundRingingSessionPlaceholder/)

console.log("voice-browser-incoming-answer-timing checks passed")
