import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { persistGrowthSignalDraft } from "@/lib/growth/signals/signal-repository"
import type { GrowthNormalizedSignalDraft, GrowthSignalType } from "@/lib/growth/signals/signal-types"
import { dispatchHighIntentSequenceWakeSafely } from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-dispatchers"
import { GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER } from "@/lib/growth/share-pages/share-page-types"

export const GROWTH_SHARE_PAGE_SIGNAL_PROVIDER_KEY = "share_page_analytics" as const

const HIGH_INTENT_SIGNAL_TYPES = new Set<GrowthSignalType>([
  "share_page_viewed",
  "share_page_engaged",
  "share_page_cta_clicked",
  "share_page_booking_started",
  "share_page_booking_completed",
])

type EmitSharePageSignalInput = {
  organizationId: string
  leadId: string
  sharePageId: string
  sharePageViewId?: string | null
  signalType: GrowthSignalType
  companyName: string
  domain?: string | null
  occurredAt: string
  providerEventId: string
  excerpt: string
  metadata?: Record<string, unknown>
}

export function isHighIntentSharePageSignalType(signalType: string): signalType is GrowthSignalType {
  return HIGH_INTENT_SIGNAL_TYPES.has(signalType as GrowthSignalType)
}

export async function emitSharePageHighIntentSignal(
  admin: SupabaseClient,
  input: EmitSharePageSignalInput,
): Promise<{ ok: boolean; signalId?: string; duplicate?: boolean; reason?: string }> {
  if (!isHighIntentSharePageSignalType(input.signalType)) {
    return { ok: false, reason: "not_high_intent_signal" }
  }

  const draft: GrowthNormalizedSignalDraft = {
    organization_id: input.organizationId,
    signal_type: input.signalType,
    provider_key: GROWTH_SHARE_PAGE_SIGNAL_PROVIDER_KEY,
    provider_event_id: input.providerEventId,
    occurred_at: input.occurredAt,
    company_name: input.companyName,
    domain: input.domain ?? null,
    evidence: [
      {
        source_type: "other",
        source_label: "Share page analytics",
        excerpt: input.excerpt,
        observed_at: input.occurredAt,
      },
    ],
    metadata: {
      qa_marker: GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
      share_page_id: input.sharePageId,
      share_page_view_id: input.sharePageViewId ?? null,
      lead_id: input.leadId,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_execution: false,
      enrollment_execution: false,
      ...(input.metadata ?? {}),
    },
  }

  const result = await persistGrowthSignalDraft(admin, draft)

  if (result.ok && result.signal_id && !result.duplicate) {
    dispatchHighIntentSequenceWakeSafely(admin, {
      leadId: input.leadId,
      signalId: result.signal_id,
      score: typeof input.metadata?.signal_score === "number" ? input.metadata.signal_score : null,
      signalType: input.signalType,
      metadata: {
        share_page_id: input.sharePageId,
        share_page_view_id: input.sharePageViewId ?? null,
        ...(input.metadata ?? {}),
      },
      occurredAt: input.occurredAt,
      evidenceRef: result.signal_id,
    })
  }

  return {
    ok: result.ok,
    signalId: result.signal_id,
    duplicate: result.duplicate,
    reason: result.reason,
  }
}
