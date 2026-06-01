/**
 * Live Coaching pipeline production blockers — analyzer import, coaching hardening, media restart.
 * Run: pnpm test:live-coaching-pipeline-fix
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildVoiceMediaStreamTwilioWssUrl,
  describeVoiceMediaStreamWssTarget,
  resolveVoiceMediaStreamPublicBaseUrl,
} from "../lib/voice/call-control/urls"
import { isStaleRingPhaseMediaSession } from "../lib/voice/media-streaming/inbound-media-stream-restart-logic"

const QA_MARKER = "live-coaching-pipeline-fix-v1"

const runRealtimeModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/realtime/run-realtime-call-session.ts"),
  "utf8",
)
assert.match(
  runRealtimeModule,
  /import \{ analyzeRealtimeCallTranscript, diffRealtimeSnapshot \} from "@\/lib\/growth\/realtime\/realtime-session-analyzer"/,
  "run-realtime-call-session must import analyzer helpers",
)
assert.match(runRealtimeModule, /analyzeRealtimeCallTranscript\(/)
assert.match(runRealtimeModule, /diffRealtimeSnapshot\(/)

const coachingService = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-coaching-service.ts"),
  "utf8",
)
assert.match(coachingService, /priority: "answer_hot_path"/)
assert.match(coachingService, /closeOrphanedActiveRealtimeCoachingSessionsForLeadFast/)

const lifecycleModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-coaching-lifecycle.ts"),
  "utf8",
)
assert.match(lifecycleModule, /closeOrphanedActiveRealtimeCoachingSessionsForLeadFast/)
assert.match(lifecycleModule, /scheduleFullOrphanedRealtimeCoachingCleanup/)
assert.match(lifecycleModule, /voice_growth_coaching_orphan_complete_failed/)

assert.match(
  coachingService,
  /completeOrphanedActiveRealtimeCoachingSessionsForLead[\s\S]*catch \(error\)/,
  "orphan cleanup failure must not abort coaching start",
)
assert.match(
  coachingService,
  /linkNativeCallRealtimeSession[\s\S]*startGrowthRealtimeCallSession/,
  "native link must happen before optional session start hydration",
)
assert.match(coachingService, /voice_growth_coaching_native_linked/)

const answeredMediaStream = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/media-streaming/ensure-answered-inbound-media-stream.ts"),
  "utf8",
)
assert.match(answeredMediaStream, /describeVoiceMediaStreamWssTarget/)
assert.match(answeredMediaStream, /wssHost/)
assert.match(answeredMediaStream, /voice_answered_inbound_media_stream_create_requested/)
assert.match(answeredMediaStream, /\/Streams\.json/)
assert.match(answeredMediaStream, /voice_answered_inbound_media_stream_stale_stopped/)

const nativeDialerRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/native-dialer-repository.ts"),
  "utf8",
)
const coachingIdx = nativeDialerRepo.indexOf("autoStartCallWorkspaceLiveCoachingOnAnswer")
const mediaIdx = nativeDialerRepo.indexOf("ensureAnsweredInboundCallMediaStream")
assert.ok(coachingIdx > 0 && mediaIdx > coachingIdx, "coaching auto-start must run before media restart")

const unifiedAssist = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-unified-assist-panel.tsx"),
  "utf8",
)
assert.match(unifiedAssist, /hasLinkedRealtimeSession/)
assert.match(unifiedAssist, /linkedRealtimeSessionId/)
assert.doesNotMatch(
  unifiedAssist,
  /coachingActive = coachingState != null \|\| Boolean\(operatorAssist\?\.realtimeSessionId\) \|\| Boolean\(optimisticCoachTurn\)/,
  "coaching must not treat bootstrap optimistic turn as active",
)

const workspaceUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspaceUi, /data\.pipeline\?\.liveCoachingLinked/)
assert.match(workspaceUi, /answerPipelineDiagnostic/)
assert.doesNotMatch(
  workspaceUi,
  /accept[\s\S]{0,400}setOptimisticCoachTurn\(\{/,
  "SDK accept must not seed bootstrap before answer pipeline links coaching",
)

assert.equal(
  isStaleRingPhaseMediaSession({
    mediaSession: {
      id: "m1",
      organizationId: "o1",
      voiceCallId: "v1",
      voiceConferenceId: null,
      voiceRecordingId: null,
      provider: "twilio",
      providerStreamSid: "MZ1",
      mediaDirection: "duplex",
      streamStatus: "active",
      startedAt: "2026-06-01T17:06:49.767Z",
      endedAt: null,
      reconnectCount: 0,
      metadataJson: {},
      createdAt: "2026-06-01T17:06:50Z",
      updatedAt: "2026-06-01T17:06:50Z",
    },
    answeredAtMs: Date.parse("2026-06-01T17:25:16.202Z"),
  }),
  true,
  "stale ring media must trigger post-answer restart",
)

const previousMediaOrigin = process.env.VOICE_MEDIA_STREAM_PUBLIC_ORIGIN
const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
process.env.VOICE_MEDIA_STREAM_PUBLIC_ORIGIN = "https://media.equipify.ai"
delete process.env.NEXT_PUBLIC_SITE_URL

const configured = resolveVoiceMediaStreamPublicBaseUrl(null)
assert.equal(configured.originSource, "env_voice_media_stream_public_origin")
assert.equal(configured.baseUrl, "https://media.equipify.ai")
assert.equal(
  buildVoiceMediaStreamTwilioWssUrl(null),
  "wss://media.equipify.ai/api/voice/media/twilio",
)
const target = describeVoiceMediaStreamWssTarget(null)
assert.equal(target.wssHost, "media.equipify.ai")
assert.equal(target.originSource, "env_voice_media_stream_public_origin")

if (previousMediaOrigin === undefined) delete process.env.VOICE_MEDIA_STREAM_PUBLIC_ORIGIN
else process.env.VOICE_MEDIA_STREAM_PUBLIC_ORIGIN = previousMediaOrigin
if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl

console.log(`${QA_MARKER} checks passed`)
