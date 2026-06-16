import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildBookingPreview,
  buildBookingRecommendation,
  buildNextStepRecommendations,
  buildRecommendedAgenda,
  buildRecommendedAttendees,
  evaluateMeetingReadiness,
  validateBookingHandoffQualificationGoal,
} from "@/lib/growth/media/media-booking-handoff-utils"
import {
  GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER,
  GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS,
  type GrowthMediaBookingHandoffCreateInput,
  type GrowthMediaBookingHandoffRecord,
  type GrowthMediaBookingHandoffStatus,
} from "@/lib/growth/media/media-booking-handoff-types"
import { persistGrowthSignalDraft } from "@/lib/growth/signals/signal-repository"

export {
  buildBookingPreview,
  buildBookingRecommendation,
  buildRecommendedAgenda,
  buildRecommendedAttendees,
  buildNextStepRecommendations,
  evaluateMeetingReadiness,
  validateBookingHandoffQualificationGoal,
} from "@/lib/growth/media/media-booking-handoff-utils"

const handoffStore = new Map<string, GrowthMediaBookingHandoffRecord>()

function nowIso(): string {
  return new Date().toISOString()
}

async function dispatchBookingHandoffWake(
  admin: SupabaseClient,
  input: {
    leadId: string
    sharePageId: string | null
    readinessTier: GrowthMediaBookingHandoffRecord["readinessTier"]
    readinessScore: number
    recommendation: GrowthMediaBookingHandoffRecord["bookingRecommendation"]
    occurredAt: string
    evidenceRef: string
  },
): Promise<void> {
  const { dispatchBookingHandoffSequenceWakeSafely } = await import(
    "@/lib/growth/sequences/runtime/sequence-trigger-runtime-dispatchers"
  )
  dispatchBookingHandoffSequenceWakeSafely(admin, input)
}

export function resetMediaBookingHandoffStoreForCert(): void {
  handoffStore.clear()
}

export function mapProviderStatus(_providerStatus: string): GrowthMediaBookingHandoffStatus {
  return "draft"
}

export function createBookingHandoff(
  input: GrowthMediaBookingHandoffCreateInput,
  options?: { admin?: SupabaseClient },
): GrowthMediaBookingHandoffRecord {
  if (!input.organizationId.trim()) throw new Error("organization_id_required")
  if (input.qualificationGoal && !validateBookingHandoffQualificationGoal(input.qualificationGoal)) {
    throw new Error("invalid_qualification_goal")
  }

  const preview = buildBookingPreview({
    qualificationGoal: input.qualificationGoal ?? "meeting_readiness",
    prospectName: input.prospectName,
    companyName: input.companyName,
    aiQaEnabled: input.aiQaEnabled,
    conversationEnabled: input.conversationEnabled,
    bookingHandoffEnabled: input.bookingHandoffEnabled ?? true,
    agendaTemplate: input.agendaTemplate,
  })

  const timestamp = nowIso()
  const record: GrowthMediaBookingHandoffRecord = {
    handoffId: randomUUID(),
    organizationId: input.organizationId,
    leadId: input.leadId?.trim() || null,
    sharePageId: input.sharePageId?.trim() || null,
    status: "draft",
    readinessTier: preview.readiness.readinessTier,
    readinessScore: preview.readiness.readinessScore,
    qualificationGoal: input.qualificationGoal ?? "meeting_readiness",
    recommendedMeetingType: preview.recommendation.recommendedMeetingType,
    recommendedDurationMinutes: preview.recommendation.recommendedDurationMinutes,
    recommendedAttendees: preview.recommendation.recommendedAttendees,
    recommendedOwner: preview.recommendation.recommendedOwner,
    recommendedAgenda: preview.recommendation.recommendedAgenda,
    recommendedNextSteps: preview.recommendation.recommendedNextSteps,
    bookingRecommendation: preview.recommendation.bookingRecommendation,
    signals: preview.recommendation.signals,
    rationale: preview.recommendation.rationale,
    requiresHumanReview: preview.recommendation.requiresHumanReview,
    meetingReadiness: preview.readiness,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  if (preview.readiness.readinessScore >= 62) {
    record.status = "ready"
  }

  handoffStore.set(record.handoffId, record)

  if (record.status === "ready" && record.leadId && options?.admin) {
    void persistBookingHandoffReadyEvidence(options.admin, record).catch(() => undefined)
    void dispatchBookingHandoffWake(options.admin, {
      leadId: record.leadId,
      sharePageId: record.sharePageId,
      readinessTier: record.readinessTier,
      readinessScore: record.readinessScore,
      recommendation: record.bookingRecommendation,
      occurredAt: record.updatedAt,
      evidenceRef: record.handoffId,
    })
  }

  return record
}

async function persistBookingHandoffReadyEvidence(
  admin: SupabaseClient,
  record: GrowthMediaBookingHandoffRecord,
): Promise<void> {
  if (!record.leadId) return

  await persistGrowthSignalDraft(admin, {
    organization_id: record.organizationId,
    signal_type: "manual_signal",
    provider_key: "media_booking_handoff",
    provider_event_id: record.handoffId,
    occurred_at: record.updatedAt,
    company_name: "Prospect",
    evidence: [
      {
        source_type: "other",
        source_label: "Media booking handoff",
        excerpt: record.bookingRecommendation,
        observed_at: record.updatedAt,
      },
    ],
    metadata: {
      qa_marker: GROWTH_MEDIA_BOOKING_HANDOFF_QA_MARKER,
      lead_id: record.leadId,
      share_page_id: record.sharePageId,
      booking_handoff_ready: true,
      readiness_tier: record.readinessTier,
      readiness_score: record.readinessScore,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_execution: false,
      enrollment_execution: false,
    },
  })
}

export function getBookingHandoff(handoffId: string, organizationId: string): GrowthMediaBookingHandoffRecord {
  const record = getHandoffRecordOrThrow(handoffId)
  if (record.organizationId !== organizationId) throw new Error("organization_scope_mismatch")
  return record
}

export function cancelBookingHandoff(handoffId: string, organizationId: string): GrowthMediaBookingHandoffRecord {
  const record = getBookingHandoff(handoffId, organizationId)
  if (record.status === "cancelled" || record.status === "archived") {
    throw new Error("invalid_status_transition")
  }

  const updated: GrowthMediaBookingHandoffRecord = {
    ...record,
    status: "cancelled",
    updatedAt: nowIso(),
  }
  handoffStore.set(updated.handoffId, updated)
  return updated
}

export function archiveBookingHandoff(handoffId: string, organizationId: string): GrowthMediaBookingHandoffRecord {
  const record = getBookingHandoff(handoffId, organizationId)
  if (record.status === "archived") throw new Error("invalid_status_transition")

  const updated: GrowthMediaBookingHandoffRecord = {
    ...record,
    status: "archived",
    updatedAt: nowIso(),
  }
  handoffStore.set(updated.handoffId, updated)
  return updated
}

function getHandoffRecordOrThrow(handoffId: string): GrowthMediaBookingHandoffRecord {
  const record = handoffStore.get(handoffId)
  if (!record) throw new Error("booking_handoff_not_found")
  return record
}

export function listBookingHandoffsForOrganization(organizationId: string): GrowthMediaBookingHandoffRecord[] {
  return [...handoffStore.values()].filter((record) => record.organizationId === organizationId)
}

export function toGrowthMediaBookingHandoffResponse(record: GrowthMediaBookingHandoffRecord) {
  const preview = buildBookingPreview({
    qualificationGoal: record.qualificationGoal,
    prospectName: null,
    companyName: null,
    bookingHandoffEnabled: true,
  })

  return {
    ok: true as const,
    handoff: record,
    preview,
    ...GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS,
  }
}
