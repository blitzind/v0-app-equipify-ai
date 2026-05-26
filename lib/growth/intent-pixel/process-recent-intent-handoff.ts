import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { bridgeRecentIntentSessions } from "@/lib/growth/lead-engine/intent/intent-to-lead-bridge"
import { ingestIntentCandidateToLeadInbox } from "@/lib/growth/lead-inbox/lead-inbox-loader"
import {
  GROWTH_INTENT_PIXEL_LIVE_QA_MARKER,
  type GrowthIntentPixelProcessRecentResult,
} from "@/lib/growth/intent-pixel/intent-pixel-admin-types"
import { isGrowthIntentPixelSchemaReady } from "@/lib/growth/intent-pixel/intent-pixel-schema-health"

export async function processRecentIntentToLeadInbox(
  admin: SupabaseClient,
  siteKey: string,
  options: { limit?: number } = {},
): Promise<GrowthIntentPixelProcessRecentResult> {
  const limit = options.limit ?? 25
  const empty: GrowthIntentPixelProcessRecentResult = {
    qa_marker: GROWTH_INTENT_PIXEL_LIVE_QA_MARKER,
    site_key: siteKey,
    sessions_scanned: 0,
    bridged_count: 0,
    eligible_count: 0,
    ingested_count: 0,
    duplicate_count: 0,
    skipped_count: 0,
    inbox_ids: [],
    errors: [],
  }

  if (!(await isGrowthIntentPixelSchemaReady(admin))) {
    return {
      ...empty,
      errors: ["Intent Pixel schema not ready."],
    }
  }

  const batch = await bridgeRecentIntentSessions(admin, siteKey, limit)
  const errors = [...batch.errors]
  let ingested_count = 0
  let duplicate_count = 0
  let skipped_count = 0
  const inbox_ids: string[] = []

  for (const candidate of batch.candidates) {
    if (!candidate.lead_engine_eligible) {
      skipped_count += 1
      continue
    }

    const ingest = await ingestIntentCandidateToLeadInbox(admin, candidate, {
      site_key: siteKey,
      session_count: candidate.candidate_evidence.length > 0 ? 1 : 1,
      visit_count: Math.max(1, candidate.candidate_evidence.length),
    })

    if (ingest.duplicate) {
      duplicate_count += 1
      continue
    }

    if (!ingest.ok || !ingest.row) {
      skipped_count += 1
      if (ingest.reason) errors.push(ingest.reason)
      continue
    }

    ingested_count += 1
    inbox_ids.push(ingest.row.id)
  }

  return {
    qa_marker: GROWTH_INTENT_PIXEL_LIVE_QA_MARKER,
    site_key: siteKey,
    sessions_scanned: limit,
    bridged_count: batch.candidates.length,
    eligible_count: batch.eligible_count,
    ingested_count,
    duplicate_count,
    skipped_count,
    inbox_ids,
    errors,
  }
}
