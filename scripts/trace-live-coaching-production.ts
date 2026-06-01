/**
 * Production trace for Live Coaching V2 — latest realtime session.
 * Run: pnpm tsx scripts/trace-live-coaching-production.ts [sessionId]
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import {
  lastCustomerFacingSequence,
  lastCustomerFacingTranscriptEvent,
  lastProspectTranscriptEvent,
  shouldRefreshCoachForCustomerSpeech,
} from "../lib/growth/live-coaching/prospect-turn-detection"
import type { ConversationCoachTurn } from "../lib/growth/live-coaching/types"
import type { GrowthRealtimeTranscriptEvent } from "../lib/growth/realtime/realtime-call-types"
import { generateDeterministicCoachTurn } from "../lib/growth/live-coaching/turn-coach-generator"
import { classifyConversationStage } from "../lib/growth/live-coaching/conversation-stage-engine"
import { emptyRealtimeLiveSnapshot } from "../lib/growth/realtime/realtime-live-snapshot-defaults"
import { analyzeRealtimeCallTranscript } from "../lib/growth/realtime/realtime-session-analyzer"

function loadEnvFile(path: string): void {
  try {
    const raw = readFileSync(path, "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq)
      let value = trimmed.slice(eq + 1)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // optional
  }
}

function refreshDecisionReason(input: {
  events: GrowthRealtimeTranscriptEvent[]
  previousCoach: ConversationCoachTurn | null
}): string {
  if (input.events.length === 0) return "no_events"
  const lastCustomerSeq = lastCustomerFacingSequence(input.events, input.previousCoach ?? undefined)
  if (lastCustomerSeq === null) return "no_customer_facing_sequence"
  if (!input.previousCoach) return "no_previous_coach"
  if (input.previousCoach.triggeredBySequenceNumber === null) return "bootstrap_active"
  if (lastCustomerSeq > input.previousCoach.triggeredBySequenceNumber) return "new_customer_sequence"
  return "sequence_not_advanced"
}

async function main() {
  for (const file of [".env.local", ".env.local.active", ".vercel/.env.production.local"]) {
    loadEnvFile(file)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const sessionIdArg = process.argv[2]?.trim()

  let sessionQuery = admin
    .schema("growth")
    .from("realtime_call_sessions")
    .select(
      "id, status, guidance_enabled, live_snapshot, updated_at, started_at, ended_at, lead_id, created_at",
    )
    .order("updated_at", { ascending: false })
    .limit(1)

  if (sessionIdArg) {
    sessionQuery = admin
      .schema("growth")
      .from("realtime_call_sessions")
      .select(
        "id, status, guidance_enabled, live_snapshot, updated_at, started_at, ended_at, lead_id, created_at",
      )
      .eq("id", sessionIdArg)
      .limit(1)
  }

  const { data: sessions, error: sessionError } = await sessionQuery
  if (sessionError) throw new Error(sessionError.message)
  const session = sessions?.[0]
  if (!session) {
    console.error("No realtime_call_sessions row found")
    process.exit(1)
  }

  const sessionId = session.id as string
  console.log("=== realtime_call_sessions ===")
  console.log(
    JSON.stringify(
      {
        id: sessionId,
        status: session.status,
        guidance_enabled: session.guidance_enabled,
        updated_at: session.updated_at,
        started_at: session.started_at,
        ended_at: session.ended_at,
        lead_id: session.lead_id,
      },
      null,
      2,
    ),
  )

  const liveSnapshot = (session.live_snapshot ?? {}) as Record<string, unknown>
  const conversationCoach = liveSnapshot.conversationCoach as ConversationCoachTurn | null | undefined
  console.log("\n=== live_snapshot.conversationCoach ===")
  console.log(JSON.stringify(conversationCoach ?? null, null, 2))

  const { data: events, error: eventsError } = await admin
    .schema("growth")
    .from("realtime_call_transcript_events")
    .select("id, session_id, speaker, content, sequence_number, created_at, source_voice_segment_id")
    .eq("session_id", sessionId)
    .order("sequence_number", { ascending: true })

  if (eventsError) throw new Error(eventsError.message)

  console.log("\n=== realtime_call_transcript_events ===")
  console.log(JSON.stringify(events ?? [], null, 2))

  const mappedEvents: GrowthRealtimeTranscriptEvent[] = (events ?? []).map((row) => ({
    id: row.id as string,
    sessionId: row.session_id as string,
    speaker: row.speaker as GrowthRealtimeTranscriptEvent["speaker"],
    content: row.content as string,
    sequenceNumber: row.sequence_number as number,
    timestampMs: 0,
    sourceVoiceSegmentId: (row.source_voice_segment_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }))

  const previousCoach = conversationCoach ?? null
  const lastProspect = lastProspectTranscriptEvent(mappedEvents)
  const lastCustomer = lastCustomerFacingTranscriptEvent(mappedEvents, { previousCoach })
  const lastCustomerSeq = lastCustomerFacingSequence(mappedEvents, previousCoach)
  const shouldRefresh = shouldRefreshCoachForCustomerSpeech({
    events: mappedEvents,
    previousCoach,
  })
  const reason = refreshDecisionReason({ events: mappedEvents, previousCoach })

  console.log("\n=== syncConversationCoach decision (simulated) ===")
  console.log(
    JSON.stringify(
      {
        eventCount: mappedEvents.length,
        lastProspectTurn: lastProspect
          ? {
              sequenceNumber: lastProspect.sequenceNumber,
              speaker: lastProspect.speaker,
              content: lastProspect.content.slice(0, 120),
            }
          : null,
        lastCustomerFacingTurn: lastCustomer
          ? {
              sequenceNumber: lastCustomer.sequenceNumber,
              speaker: lastCustomer.speaker,
              content: lastCustomer.content.slice(0, 120),
            }
          : null,
        lastCustomerSequence: lastCustomerSeq,
        previousCoachTriggeredBySequenceNumber: previousCoach?.triggeredBySequenceNumber ?? null,
        previousCoachSource: previousCoach?.source ?? null,
        previousCoachPhrase: previousCoach?.primaryPhrase?.slice(0, 120) ?? null,
        shouldRefreshCoachTurn: shouldRefresh,
        refreshDecisionReason: reason,
        guidanceEnabled: session.guidance_enabled,
      },
      null,
      2,
    ),
  )

  if (shouldRefresh && mappedEvents.length > 0) {
    const leadRes = await admin
      .schema("growth")
      .from("leads")
      .select("decision_maker_status, executive_priority_tier, conversation_competitor_pressure")
      .eq("id", session.lead_id as string)
      .maybeSingle()

    const leadInput = {
      decisionMakerStatus: (leadRes.data?.decision_maker_status as string) ?? "unknown",
      executivePriorityTier: (leadRes.data?.executive_priority_tier as string) ?? "standard",
      conversationCompetitorPressure: 0,
    }

    const analyzedSnapshot = analyzeRealtimeCallTranscript({
      events: mappedEvents,
      lead: leadInput,
    })
    const stageResult = classifyConversationStage({
      events: mappedEvents,
      snapshot: analyzedSnapshot,
      previousStage: previousCoach?.stage ?? null,
    })
    const deterministic = generateDeterministicCoachTurn({
      events: mappedEvents,
      stage: stageResult.stage,
      snapshot: analyzedSnapshot,
      inbound: true,
      previousCoach,
    })

    console.log("\n=== generated deterministic coach (simulated) ===")
    console.log(
      JSON.stringify(
        {
          primaryPhrase: deterministic.primaryPhrase,
          triggeredBySequenceNumber: deterministic.triggeredBySequenceNumber,
          source: deterministic.source,
          stage: deterministic.stage,
        },
        null,
        2,
      ),
    )
  }

  const { data: nativeSessions } = await admin
    .schema("growth")
    .from("native_call_workspace_sessions")
    .select("id, voice_call_id, realtime_session_id, status, direction")
    .eq("realtime_session_id", sessionId)
    .order("started_at", { ascending: false })
    .limit(3)

  console.log("\n=== linked native_call_workspace_sessions ===")
  console.log(JSON.stringify(nativeSessions ?? [], null, 2))

  const voiceCallId = nativeSessions?.[0]?.voice_call_id as string | undefined
  if (voiceCallId) {
    const { data: voiceSegments } = await admin
      .schema("voice")
      .from("voice_call_transcript_segments")
      .select("id, sequence_number, speaker_type, transcript_text, created_at")
      .eq("voice_call_id", voiceCallId)
      .order("sequence_number", { ascending: true })
      .limit(20)

    console.log("\n=== voice_call_transcript_segments (latest call) ===")
    console.log(JSON.stringify(voiceSegments ?? [], null, 2))
  }

  console.log("\n=== failing step heuristic ===")
  const bootstrapPhrase = "Thanks for calling — what prompted you to reach out today?"
  const persistedPhrase = previousCoach?.primaryPhrase ?? null
  const prospectCount = mappedEvents.filter((event) => event.speaker === "prospect").length

  let failingStep = "unknown"
  if (prospectCount === 0 && (events?.length ?? 0) === 0) {
    failingStep = "A — no growth transcript events (bridge/recompute path)"
  } else if (prospectCount === 0) {
    failingStep = "A — prospect event not selected (no prospect-labeled rows)"
  } else if (!shouldRefresh) {
    failingStep = `B — shouldRefreshCoachTurn false (${reason})`
  } else if (persistedPhrase === bootstrapPhrase) {
    failingStep = "D — generated turn not persisted (DB still bootstrap despite refresh=true)"
  } else if (session.guidance_enabled === false) {
    failingStep = "B/C — guidance_enabled false; syncConversationCoach skipped"
  } else {
    failingStep = "E/F — coach persisted or UI merge (check operator assist payload)"
  }

  console.log(failingStep)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
