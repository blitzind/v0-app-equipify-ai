import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GE_V1_3_ELEVENLABS_LIVE_QA_MARKER,
  type GeV13GenerationLifecycleEventType,
} from "@/lib/growth/media/ge-v1-3-types"

export type GeV13GenerationLifecycleEventInput = {
  organizationId: string
  eventType: GeV13GenerationLifecycleEventType
  videoPageId?: string | null
  videoAssetId?: string | null
  mediaAssetId?: string | null
  leadId?: string | null
  mediaGenerationRunId?: string | null
  generationType?: "voice_generation" | "avatar_generation" | null
  provider?: string | null
  dryRun?: boolean
  metadata?: Record<string, unknown>
}

export async function recordGeV13GenerationLifecycleEvent(
  admin: SupabaseClient,
  input: GeV13GenerationLifecycleEventInput,
): Promise<void> {
  const occurredAt = new Date().toISOString()
  const metadata = {
    qa_marker: GE_V1_3_ELEVENLABS_LIVE_QA_MARKER,
    event_type: input.eventType,
    generation_type: input.generationType ?? null,
    provider: input.provider ?? null,
    dry_run: Boolean(input.dryRun),
    media_generation_run_id: input.mediaGenerationRunId ?? null,
    media_asset_id: input.mediaAssetId ?? null,
    lead_id: input.leadId ?? null,
    ...(input.metadata ?? {}),
  }

  if (input.mediaAssetId) {
    await admin
      .schema("growth")
      .from("media_asset_events")
      .insert({
        organization_id: input.organizationId,
        asset_id: input.mediaAssetId,
        relationship_id: input.videoPageId ?? null,
        event_type: "video_progress",
        lead_id: input.leadId ?? null,
        share_page_id: null,
        template_id: null,
        sequence_id: null,
        session_id: `ge-v1-3:${input.mediaGenerationRunId ?? input.eventType}:${occurredAt}`,
        anonymous_id_hash: null,
        event_timestamp: occurredAt,
        progress_seconds: null,
        progress_percent: null,
        duration_seconds: null,
        cta_key: null,
        metadata_json: metadata,
      })
      .then(({ error }) => {
        if (error) return undefined
        return undefined
      })
      .catch(() => undefined)
  }

  if (input.videoPageId && input.videoAssetId) {
    await admin
      .schema("growth")
      .from("video_page_events")
      .insert({
        organization_id: input.organizationId,
        video_page_id: input.videoPageId,
        video_asset_id: input.videoAssetId,
        event_type: "page_view",
        visitor_identifier: null,
        session_id: `ge-v1-3-operator:${input.eventType}:${occurredAt}`,
        metadata_json: metadata,
      })
      .then(({ error }) => {
        if (error) return undefined
        return undefined
      })
      .catch(() => undefined)
  }
}
