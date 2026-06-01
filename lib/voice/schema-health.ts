import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { looksLikePostgrestMissingSchemaError } from "@/lib/blitzpay/blitzpay-schema-health-detect"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { VOICE_FOUNDATION_QA_MARKER } from "@/lib/voice/types"

export const VOICE_SCHEMA_PROBE_VERSION = "v20" as const
export const VOICE_SCHEMA_MIGRATION_ID = "20270620120500_voice_multichannel_intelligence_phase_6a" as const

const REQUIRED_TABLES = [
  "voice_numbers",
  "voice_calls",
  "voice_call_events",
  "voice_recordings",
  "voice_transcripts",
  "voice_opt_outs",
  "voice_provider_configurations",
  "voice_webhook_receipts",
  "voice_conversations",
  "voice_routing_profiles",
  "voice_routing_profile_members",
  "voice_business_hours",
  "voice_voicemail_boxes",
  "voice_call_control_settings",
  "voice_browser_devices",
  "voice_operator_presence",
  "voice_call_legs",
  "voice_conferences",
  "voice_conference_participants",
  "voice_call_transfers",
  "voice_media_sessions",
  "voice_media_participants",
  "voice_transcript_sessions",
  "voice_transcript_segments",
  "voice_media_timeline_events",
  "voice_conversation_intelligence_events",
  "voice_objection_events",
  "voice_buying_signal_events",
  "voice_risk_events",
  "voice_operator_guidance_events",
  "voice_conversation_memory_drafts",
  "voice_relationship_memory_profiles",
  "voice_relationship_memory_events",
  "voice_revenue_intelligence_events",
  "voice_retention_intelligence_events",
  "voice_ai_copilot_suggestions",
  "voice_operator_performance_insights",
  "voice_ai_receptionist_faq_entries",
  "voice_ai_receptionist_qualification_flows",
  "voice_ai_receptionist_sessions",
  "voice_ai_receptionist_events",
  "voice_missed_call_recovery_events",
  "voice_callback_tasks",
  "voice_drop_campaigns",
  "voice_drop_recipients",
  "voice_drop_delivery_attempts",
  "voice_consent_records",
  "voice_suppression_entries",
  "voice_dnc_entries",
  "voice_call_hour_rules",
  "voice_compliance_audit_events",
  "voice_ai_outbound_sessions",
  "voice_ai_outbound_events",
  "voice_observability_events",
  "voice_observability_alert_states",
  "voice_observability_metric_snapshots",
  "voice_workflow_orchestrations",
  "voice_workflow_orchestration_events",
  "voice_unified_communication_threads",
  "voice_unified_communication_events",
] as const

const TABLE_PROBE_COLUMNS: Partial<Record<(typeof REQUIRED_TABLES)[number], string>> = {
  voice_operator_presence: "user_id",
  voice_call_control_settings: "organization_id",
}

export type VoiceSchemaHealthProbe = {
  qaMarker: typeof VOICE_FOUNDATION_QA_MARKER
  probeVersion: typeof VOICE_SCHEMA_PROBE_VERSION
  migrationId: typeof VOICE_SCHEMA_MIGRATION_ID
  ready: boolean
  probeUncertain: boolean
  missingTables: string[]
  message: string
}

export async function probeVoiceSchemaHealth(admin: SupabaseClient): Promise<VoiceSchemaHealthProbe> {
  const missingTables: string[] = []
  let probeUncertain = false

  await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      const column = TABLE_PROBE_COLUMNS[table] ?? "id"
      const { error } = await admin
        .schema("voice")
        .from(table)
        .select(column, { head: true, count: "exact" })
        .limit(1)
      if (error) {
        if (looksLikePostgrestMissingSchemaError(error.message, error.code)) {
          missingTables.push(table)
          return
        }
        probeUncertain = true
      }
    }),
  )

  const ready = missingTables.length === 0
  logVoiceInfrastructure("voice_schema_probe", {
    ready,
    probeUncertain,
    missingTables,
  })

  return {
    qaMarker: VOICE_FOUNDATION_QA_MARKER,
    probeVersion: VOICE_SCHEMA_PROBE_VERSION,
    migrationId: VOICE_SCHEMA_MIGRATION_ID,
    ready,
    probeUncertain,
    missingTables: [...missingTables],
    message: ready
      ? probeUncertain
        ? "Voice schema verification incomplete — reload Supabase PostgREST schema cache if migration was applied."
        : "Voice infrastructure schema is ready."
      : probeUncertain
        ? "Voice schema probe uncertain — reload Supabase PostgREST schema cache if migration was applied."
        : `Apply migration ${VOICE_SCHEMA_MIGRATION_ID}.sql — missing: ${missingTables.join(", ")}`,
  }
}

const VOICE_SCHEMA_PROBE_CACHE_TTL_MS = 5 * 60 * 1000
let voiceSchemaProbeCache: { probe: VoiceSchemaHealthProbe; expiresAt: number } | null = null

function readVoiceSchemaProbeCache(now = Date.now()): VoiceSchemaHealthProbe | null {
  if (
    voiceSchemaProbeCache &&
    voiceSchemaProbeCache.expiresAt > now &&
    voiceSchemaProbeCache.probe.ready
  ) {
    return voiceSchemaProbeCache.probe
  }
  return null
}

function writeVoiceSchemaProbeCache(probe: VoiceSchemaHealthProbe, now = Date.now()): void {
  if (probe.ready) {
    voiceSchemaProbeCache = {
      probe,
      expiresAt: now + VOICE_SCHEMA_PROBE_CACHE_TTL_MS,
    }
  } else {
    voiceSchemaProbeCache = null
  }
}

/** Cached schema probe for latency-sensitive routes (webhooks + browser sync). */
export async function probeVoiceSchemaHealthCached(
  admin: SupabaseClient,
): Promise<VoiceSchemaHealthProbe> {
  const cached = readVoiceSchemaProbeCache()
  if (cached) return cached

  const probe = await probeVoiceSchemaHealth(admin)
  writeVoiceSchemaProbeCache(probe)
  return probe
}

/** @deprecated Use probeVoiceSchemaHealthCached */
export async function probeVoiceSchemaHealthForWebhook(
  admin: SupabaseClient,
): Promise<VoiceSchemaHealthProbe> {
  return probeVoiceSchemaHealthCached(admin)
}

export async function probeVoiceSchemaHealthWithBudget(
  admin: SupabaseClient,
  budgetMs: number,
): Promise<VoiceSchemaHealthProbe> {
  const cached = readVoiceSchemaProbeCache()
  if (cached) return cached

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    const probe = await Promise.race([
      probeVoiceSchemaHealth(admin).then((result) => {
        writeVoiceSchemaProbeCache(result)
        return result
      }),
      new Promise<VoiceSchemaHealthProbe | null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), budgetMs)
      }),
    ])

    if (probe) return probe

    return {
      qaMarker: VOICE_FOUNDATION_QA_MARKER,
      probeVersion: VOICE_SCHEMA_PROBE_VERSION,
      migrationId: VOICE_SCHEMA_MIGRATION_ID,
      ready: true,
      probeUncertain: true,
      missingTables: [],
      message: "Voice schema probe budget exceeded — using fast path.",
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function isVoiceWebhookSchemaReady(probe: VoiceSchemaHealthProbe): boolean {
  return probe.missingTables.length === 0
}
