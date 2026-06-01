/**
 * Realtime coaching session lifecycle — one session per answered call.
 * Run: pnpm test:live-coaching-session-lifecycle
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const QA_MARKER = "live-coaching-session-lifecycle-v1"

const lifecycleModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-coaching-lifecycle.ts"),
  "utf8",
)
const coachingService = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-coaching-service.ts"),
  "utf8",
)
const nativeRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/native-dialer-repository.ts"),
  "utf8",
)
const realtimeRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/realtime-call-repository.ts"),
  "utf8",
)

assert.match(lifecycleModule, /completeCallWorkspaceLiveCoachingForNativeSession/)
assert.match(lifecycleModule, /completeOrphanedActiveRealtimeCoachingSessionsForLead/)
assert.match(lifecycleModule, /voice_growth_coaching_session_completed/)
assert.match(lifecycleModule, /voice_growth_coaching_orphan_completed/)

assert.doesNotMatch(
  coachingService,
  /listGrowthRealtimeCallSessionsForLead[\s\S]*existing\.find/,
  "must not reuse lead-level active realtime sessions for new native calls",
)
assert.match(coachingService, /completeOrphanedActiveRealtimeCoachingSessionsForLead/)
assert.match(coachingService, /voice_growth_coaching_session_created/)
assert.match(coachingService, /createGrowthRealtimeCallSession/)

assert.match(nativeRepo, /completeCallWorkspaceLiveCoachingForNativeSession/)
assert.match(nativeRepo, /declineNativeCallSession[\s\S]*completeCallWorkspaceLiveCoachingForNativeSession/)
assert.match(nativeRepo, /endNativeCallSession[\s\S]*completeCallWorkspaceLiveCoachingForNativeSession/)
assert.match(nativeRepo, /saveNativeCallWrapup[\s\S]*completeCallWorkspaceLiveCoachingForNativeSession/)

assert.match(
  realtimeRepo,
  /findActiveRealtimeSessionIdForVoiceCall[\s\S]*session\.status === "completed"/,
  "bridge lookup must reject completed realtime sessions",
)

const bridgeModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/voice-transcript-bridge.ts"),
  "utf8",
)
assert.match(bridgeModule, /ensureInboundCallWorkspaceLiveCoachingLinked/)
assert.match(bridgeModule, /findActiveRealtimeSessionIdForVoiceCall/)

console.log(`${QA_MARKER} checks passed`)
