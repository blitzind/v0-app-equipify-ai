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
import { isDisconnectedInboundMediaSession } from "../lib/voice/media-streaming/inbound-media-stream-restart-logic"

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
assert.match(coachingService, /AutoStartCallWorkspaceLiveCoachingOnAnswerResult/)
assert.match(coachingService, /reason: "native_session_not_found"/)
assert.match(coachingService, /reason: "native_session_not_inbound"/)
assert.match(coachingService, /reason: "native_session_not_active"/)
assert.match(coachingService, /reason: "realtime_session_create_failed"/)
assert.match(coachingService, /reason: "native_session_link_failed"/)
assert.match(coachingService, /voice_growth_coaching_native_link_failed/)
assert.match(coachingService, /throw new Error\("realtime_session_create_failed"\)/)
assert.match(coachingService, /organizationId = getGrowthEngineAiOrgId\(\)/)
assert.match(coachingService, /organizationId,/)
assert.doesNotMatch(coachingService, /linkResult\.message/, "client-safe link result must not expose raw DB messages")

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
assert.match(
  coachingService,
  /const createRealtimeStartedAt = Date\.now\(\)[\s\S]*createGrowthRealtimeCallSession[\s\S]*voice_growth_coaching_session_created[\s\S]*durationMs: Date\.now\(\) - createRealtimeStartedAt/,
  "coaching telemetry must expose realtime session creation duration",
)
assert.match(
  coachingService,
  /if \(realtimeSessionId && context\.linkResult\?\.linked\)[\s\S]*voice_growth_coaching_auto_linked/,
  "auto-linked success must require a persisted native realtime link",
)

const coachingLinkPipelineTypes = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-coaching-link-pipeline-types.ts"),
  "utf8",
)
assert.match(coachingLinkPipelineTypes, /server_create_growth_realtime_call_session/)
assert.match(coachingLinkPipelineTypes, /server_link_native_call_realtime_session/)
assert.match(coachingLinkPipelineTypes, /server_sync_workspace_session_from_voice_call/)
assert.match(coachingLinkPipelineTypes, /server_ensure_inbound_coaching_link/)
assert.match(coachingLinkPipelineTypes, /client_answer_call/)

const coachingLinkPipelineTelemetry = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-coaching-link-pipeline-telemetry.ts"),
  "utf8",
)
assert.match(coachingLinkPipelineTelemetry, /voice_growth_coaching_link_pipeline_stage/)
assert.match(coachingService, /server_ensure_inbound_coaching_link/)
assert.match(coachingService, /failureReason: "already_linked"/)
assert.match(coachingService, /failureReason: "voice_call_not_answered"/)

const answeredMediaStream = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/media-streaming/ensure-answered-inbound-media-stream.ts"),
  "utf8",
)
assert.match(answeredMediaStream, /describeVoiceMediaStreamWssTarget/)
assert.match(answeredMediaStream, /wssHost/)
assert.match(answeredMediaStream, /wssUrl/)
assert.match(answeredMediaStream, /TWILIO_STREAM_CREATE_TIMEOUT_MS/)
assert.match(answeredMediaStream, /fetchTwilioStreamCreate/)
assert.match(answeredMediaStream, /resolveTwilioStreamCallSid/)
assert.match(answeredMediaStream, /voice_call_legs/)
assert.match(answeredMediaStream, /provider_call_sid/)
assert.match(
  answeredMediaStream,
  /providerCallIdSource: "voice_call"/,
  "post-answer media stream must target parent inbound CallSid like ring TwiML",
)
assert.match(
  answeredMediaStream,
  /twilioStreamCallSid/,
  "post-answer stream create/stop must use parent inbound CallSid",
)
assert.match(answeredMediaStream, /voice_answered_inbound_media_stream_call_sid_resolved/)
assert.match(answeredMediaStream, /reason: "twilio_account_sid_mismatch"/)
assert.match(answeredMediaStream, /reason: "call_already_ended"/)
assert.match(answeredMediaStream, /voice_answered_inbound_media_stream_create_requested/)
assert.match(answeredMediaStream, /timeoutMs: TWILIO_STREAM_CREATE_TIMEOUT_MS/)
assert.match(answeredMediaStream, /durationMs/)
assert.match(answeredMediaStream, /reason: "twilio_stream_create_timeout"/)
assert.match(answeredMediaStream, /\/Streams\.json/)
assert.match(answeredMediaStream, /voice_answered_inbound_media_stream_reused/)
assert.match(answeredMediaStream, /voice_answered_inbound_media_stream_restart_skipped/)
assert.match(answeredMediaStream, /reason: "twiml_stream_reused"/)
assert.match(answeredMediaStream, /isDisconnectedInboundMediaSession/)

const twilioTwiml = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/call-control/twilio-twiml.ts"),
  "utf8",
)
assert.match(twilioTwiml, /statusCallbackUrl/)
assert.match(twilioTwiml, /statusCallbackEvent="initiated ringing answered completed"/)

const webhookIngestion = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/webhooks/ingestion.ts"),
  "utf8",
)
assert.match(webhookIngestion, /ParentCallSid/)
assert.match(webhookIngestion, /upsertTwilioChildCallLegFromWebhook/)
assert.match(webhookIngestion, /voice_call_legs/)
assert.match(webhookIngestion, /canonicalProviderCallId/)
assert.match(webhookIngestion, /providerCallSid: enriched\.providerCallId/)

const nativeDialerRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/native-dialer-repository.ts"),
  "utf8",
)
const coachingIdx = nativeDialerRepo.indexOf("autoStartCallWorkspaceLiveCoachingOnAnswer")
const mediaIdx = nativeDialerRepo.indexOf("ensureAnsweredInboundCallMediaStream")
assert.ok(coachingIdx > 0 && mediaIdx > coachingIdx, "coaching auto-start must run before media restart")
assert.match(
  nativeDialerRepo,
  /const coachingStartedAt = Date\.now\(\)[\s\S]*autoStartCallWorkspaceLiveCoachingOnAnswer[\s\S]*durationMs: Date\.now\(\) - coachingStartedAt/,
  "answer telemetry must expose auto-start duration before media stream restart",
)
assert.match(nativeDialerRepo, /type LinkNativeCallRealtimeSessionResult/)
assert.match(nativeDialerRepo, /select\("id, realtime_session_id"\)/)
assert.match(nativeDialerRepo, /reason: "native_session_not_found"/)
assert.match(nativeDialerRepo, /reason: "native_session_update_failed"/)
assert.match(nativeDialerRepo, /reason: "realtime_session_not_persisted"/)
assert.match(nativeDialerRepo, /missing_owner_user_id/)
assert.match(nativeDialerRepo, /voice_growth_coaching_link_missing_after_answer/)
assert.match(nativeDialerRepo, /organizationId: orgId/)
assert.match(nativeDialerRepo, /ownerUserId/)
assert.match(nativeDialerRepo, /direction/)
assert.match(nativeDialerRepo, /status/)
assert.match(nativeDialerRepo, /linkResult/)
assert.match(
  nativeDialerRepo,
  /pipeline\.liveCoachingLinked = Boolean\(persistedRealtimeSessionId\)/,
  "answer route must not report healthy coaching unless realtime_session_id was persisted",
)
assert.match(
  nativeDialerRepo,
  /const refreshedRealtimeSessionId = \(refreshed\.realtime_session_id as string \| null\) \?\? null[\s\S]*pipeline\.realtimeSessionId = refreshedRealtimeSessionId[\s\S]*pipeline\.liveCoachingLinked = Boolean\(refreshedRealtimeSessionId\)/,
  "final linked state must depend strictly on refreshed realtime_session_id",
)
assert.match(
  nativeDialerRepo,
  /errorMessage === "realtime_session_create_failed"[\s\S]*\? "realtime_session_create_failed"[\s\S]*: "auto_start_exception"/,
  "auto-start exceptions must be visible in answer pipeline diagnostics",
)
assert.match(
  nativeDialerRepo,
  /pipeline\.liveCoachingError = pipeline\.liveCoachingFailureReason/,
  "pipeline diagnostics must expose sanitized reason codes instead of raw exception text",
)
assert.match(
  nativeDialerRepo,
  /if \(\(existing\.direction as string\) === "inbound" && !refreshedRealtimeSessionId\)/,
  "answer path must re-read the native session and diagnose missing realtime_session_id",
)
assert.match(
  nativeDialerRepo,
  /const canReconcileAlreadyAnsweredInbound =[\s\S]*existingDirection === "inbound"[\s\S]*\(existingStatus === "active" \|\| existingStatus === "on_hold"\)[\s\S]*!existingRealtimeSessionId/,
  "answer reconciliation must be idempotent for already-active inbound sessions without realtime_session_id",
)
assert.match(
  nativeDialerRepo,
  /if \(existingStatus !== "ringing" && !canReconcileAlreadyAnsweredInbound\)[\s\S]*throw new Error\("Call is not ringing\."\)/,
  "non-ringing sessions should only be accepted for the explicit inbound coaching reconciliation fallback",
)
assert.match(
  nativeDialerRepo,
  /const \{ data: answeredVoiceCall, error: answerVoiceCallError \} = await admin[\s\S]*\.schema\("voice"\)[\s\S]*\.from\("voice_calls"\)[\s\S]*\.update\(\{ status: "in_progress", answered_at: now, updated_at: now \}\)[\s\S]*\.eq\("id", voiceCallId\)[\s\S]*\.eq\("organization_id", orgId\)[\s\S]*\.select\("id,status,answered_at"\)[\s\S]*\.maybeSingle\(\)/,
  "answer reconciliation must verify the canonical voice call update before syncing native session state",
)
assert.match(
  nativeDialerRepo,
  /if \(answerVoiceCallError\) throw new Error\("voice_call_answer_update_failed"\)/,
  "failed voice.voice_calls update must stop answer reconciliation",
)
assert.match(
  nativeDialerRepo,
  /if \(!answeredVoiceCall\) throw new Error\("voice_call_answer_update_missing"\)/,
  "zero-row voice.voice_calls answer update must stop answer reconciliation",
)
assert.match(
  nativeDialerRepo,
  /answeredVoiceCall\.status[\s\S]*!== "in_progress"[\s\S]*throw new Error\("voice_call_answer_status_not_in_progress"\)/,
  "answer reconciliation must reject a voice call that did not persist in_progress status",
)
assert.match(
  nativeDialerRepo,
  /answeredVoiceCall\.answered_at[\s\S]*throw new Error\("voice_call_answered_at_missing"\)/,
  "answer reconciliation must reject a voice call with missing answered_at",
)
assert.match(
  nativeDialerRepo,
  /syncWorkspaceSessionFromVoiceCall\(admin, \{[\s\S]*workspaceSessionId: sessionId[\s\S]*preventActiveToRingingDowngrade: true/,
  "answer reconciliation must not allow sync to downgrade the accepted active native session back to ringing",
)
assert.match(
  nativeDialerRepo,
  /const \{ data: refreshed[\s\S]*\.eq\("id", sessionId\)[\s\S]*return \{ session: mapNativeCallSessionRow\(refreshed as SessionRow\), pipeline \}/,
  "answer_api_response must be based on the final refreshed accepted session row",
)

const coachingTypes = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/call-workspace-coaching-types.ts"),
  "utf8",
)
assert.match(coachingTypes, /createdRealtimeSessionId/)
assert.match(coachingTypes, /liveCoachingFailureReason/)
assert.match(coachingTypes, /linkResult: LinkNativeCallRealtimeSessionResult \| null/)
assert.match(coachingTypes, /export type LinkNativeCallRealtimeSessionResult/)
assert.doesNotMatch(coachingTypes, /message\?: string/, "client link result must not include raw DB/PostgREST messages")

const manualLiveCoachingRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/sessions/[sessionId]/live-coaching/route.ts"),
  "utf8",
)
assert.match(manualLiveCoachingRoute, /coaching\.linkResult && !coaching\.linkResult\.linked/)
assert.match(manualLiveCoachingRoute, /error: "link_failed"/)
assert.match(manualLiveCoachingRoute, /reason: coaching\.linkResult\.reason/)
assert.match(manualLiveCoachingRoute, /status: 409/)
assert.doesNotMatch(manualLiveCoachingRoute, /requireGrowthEnginePlatformAccess/)
assert.match(manualLiveCoachingRoute, /requireVoiceOperatorRouteContext/)
assert.match(
  manualLiveCoachingRoute,
  /export async function GET[\s\S]*requireVoiceOperatorRouteContext\(\{[\s\S]*sessionId,[\s\S]*requireSessionOwner: true/,
  "manual live-coaching GET must be scoped to the signed-in session owner",
)
assert.match(
  manualLiveCoachingRoute,
  /export async function POST[\s\S]*requireVoiceOperatorRouteContext\(\{[\s\S]*sessionId,[\s\S]*requireSessionOwner: true/,
  "manual live-coaching POST must be scoped to the signed-in session owner",
)

const answerRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/answer/route.ts"),
  "utf8",
)
assert.doesNotMatch(answerRoute, /requireGrowthEnginePlatformAccess/)
assert.match(
  answerRoute,
  /skipSessionIdFormatValidation: true/,
  "answer route must skip duplicate operator format validation after zod body parse",
)
assert.match(
  answerRoute,
  /nativeSessionIdSchema/,
  "answer route must share native session id schema with operator guard",
)
assert.match(answerRoute, /x-coaching-pipeline-run-id/)
assert.match(answerRoute, /server_calls_answer_route/)
assert.match(answerRoute, /server_answer_response/)
assert.match(answerRoute, /logCoachingLinkPipelineStage/)

const mediaRestartRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/sessions/[sessionId]/media-stream/restart/route.ts"),
  "utf8",
)
assert.doesNotMatch(mediaRestartRoute, /requireGrowthEnginePlatformAccess/)
assert.match(
  mediaRestartRoute,
  /requireVoiceOperatorRouteContext\(\{[\s\S]*sessionId: trimmedSessionId,[\s\S]*requireSessionOwner: true/,
  "media stream restart must be scoped to the signed-in session owner",
)
assert.match(
  mediaRestartRoute,
  /sessionIdDiagnostics:[\s\S]*media-stream\/restart/,
  "media-stream restart must pass route diagnostics into operator guard",
)

const voiceOperatorRoute = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/api/voice-operator-route.ts"),
  "utf8",
)
assert.match(voiceOperatorRoute, /createServerSupabaseClient/)
assert.match(voiceOperatorRoute, /createServiceRoleSupabaseClient/)
assert.match(voiceOperatorRoute, /resolveVoiceInfrastructureOrganizationId/)
assert.match(voiceOperatorRoute, /\.from\("organization_members"\)[\s\S]*\.eq\("status", "active"\)/)
assert.match(voiceOperatorRoute, /operatorUserId: auth\.userId/)
assert.match(voiceOperatorRoute, /membershipFound: true/)
assert.match(voiceOperatorRoute, /membershipFound: false/)
assert.match(
  voiceOperatorRoute,
  /\.from\("native_call_workspace_sessions"\)[\s\S]*\.eq\("organization_id", organizationId\)/,
  "operator route guard must scope native session lookup to the configured organization",
)
assert.match(
  voiceOperatorRoute,
  /options\.requireSessionOwner && session\.owner_user_id !== auth\.userId/,
  "operator route guard must enforce native session ownership for active-call mutations",
)
assert.doesNotMatch(voiceOperatorRoute, /SUPABASE_SERVICE_ROLE_KEY is not configured/)
assert.match(voiceOperatorRoute, /isPlatformAdminEmail/)
assert.match(voiceOperatorRoute, /operator_platform_admin_granted/)
assert.match(voiceOperatorRoute, /getBearerAccessToken/)
assert.match(voiceOperatorRoute, /authStage/)
assert.match(
  voiceOperatorRoute,
  /normalizeNativeSessionId/,
  "operator route guard must validate native session ids with shared zod helper",
)
assert.match(
  voiceOperatorRoute,
  /skipSessionIdFormatValidation/,
  "operator route must allow answer route to skip duplicate format validation",
)
assert.doesNotMatch(
  voiceOperatorRoute,
  /if \(!UUID_RE\.test\(sessionId\)\)/,
  "operator route must not reject zod-valid ids via legacy UUID_RE",
)
assert.match(
  manualLiveCoachingRoute,
  /logSessionIdValidationFailure[\s\S]*Invalid session id\./,
  "live-coaching route must log structured diagnostics before invalid session id returns",
)

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
assert.match(workspaceUi, /logClientCoachingLinkStage/)
assert.match(workspaceUi, /client_answer_api/)
assert.match(workspaceUi, /client_answer_call/)
assert.match(workspaceUi, /reconcile_skipped_no_captured_session/)
assert.match(workspaceUi, /answer_api_skipped_no_server_session_id/)
assert.match(workspaceUi, /X-Coaching-Pipeline-Run-Id/)
assert.doesNotMatch(
  workspaceUi,
  /accept[\s\S]{0,400}setOptimisticCoachTurn\(\{/,
  "SDK accept must not seed bootstrap before answer pipeline links coaching",
)
assert.match(
  workspaceUi,
  /async function retryMediaStream\(\)[\s\S]*if \(!isNativeSessionIdServerReady\(sessionId\)\) return[\s\S]*\/media-stream\/restart/,
  "media stream restart must skip pending-inbound placeholders before POST",
)
assert.match(
  workspaceUi,
  /async function retryMediaStream\(\)[\s\S]*isNativeSessionIdServerReady\(sessionId\)[\s\S]*fetch\([\s\S]*\/media-stream\/restart/,
  "media stream restart must still POST once native session UUID is ready",
)

const workspaceBridge = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/workspace-bridge.ts"),
  "utf8",
)
assert.match(workspaceBridge, /preventActiveToRingingDowngrade\?: boolean/)
assert.match(workspaceBridge, /logCoachingLinkPipelineStage/)
assert.match(workspaceBridge, /coaching_link_preconditions_not_met/)
assert.match(workspaceBridge, /native_session_sync_not_eligible/)
assert.match(
  workspaceBridge,
  /input\.preventActiveToRingingDowngrade[\s\S]*nativeStatus === "ringing"[\s\S]*\(currentStatus === "active" \|\| currentStatus === "on_hold"\)[\s\S]*return/,
  "successful answer sync must not overwrite an active accepted native session back to ringing",
)

const longRingMediaSession = {
  id: "m1",
  organizationId: "o1",
  voiceCallId: "v1",
  voiceConferenceId: null,
  voiceRecordingId: null,
  provider: "twilio" as const,
  providerStreamSid: "MZ1",
  mediaDirection: "duplex" as const,
  streamStatus: "active" as const,
  startedAt: "2026-06-01T17:06:49.767Z",
  endedAt: null,
  reconnectCount: 0,
  metadataJson: {},
  createdAt: "2026-06-01T17:06:50Z",
  updatedAt: "2026-06-01T17:06:50Z",
}

assert.equal(
  isDisconnectedInboundMediaSession(longRingMediaSession),
  false,
  "long ring duration alone must not trigger post-answer restart",
)

assert.equal(
  isDisconnectedInboundMediaSession({
    ...longRingMediaSession,
    metadataJson: { websocketDisconnected: true },
  }),
  true,
  "explicit websocket disconnect evidence must allow restart",
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
