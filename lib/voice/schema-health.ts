import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { looksLikePostgrestMissingSchemaError } from "@/lib/blitzpay/blitzpay-schema-health-detect"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { VOICE_FOUNDATION_QA_MARKER } from "@/lib/voice/types"

export const VOICE_SCHEMA_PROBE_VERSION = "v8" as const
export const VOICE_SCHEMA_MIGRATION_ID = "20270608120000_voice_unified_operator_assist_phase_2b" as const

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

  for (const table of REQUIRED_TABLES) {
    const column = TABLE_PROBE_COLUMNS[table] ?? "id"
    const { error } = await admin.schema("voice").from(table).select(column, { head: true, count: "exact" }).limit(1)
    if (error) {
      if (looksLikePostgrestMissingSchemaError(error.message, error.code)) {
        missingTables.push(table)
        continue
      }
      probeUncertain = true
    }
  }

  const ready = missingTables.length === 0 && !probeUncertain
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
      ? "Voice infrastructure schema is ready."
      : probeUncertain
        ? "Voice schema probe uncertain — reload Supabase PostgREST schema cache if migration was applied."
        : `Apply migration ${VOICE_SCHEMA_MIGRATION_ID}.sql — missing: ${missingTables.join(", ")}`,
  }
}

export function isVoiceWebhookSchemaReady(probe: VoiceSchemaHealthProbe): boolean {
  return probe.ready
}
