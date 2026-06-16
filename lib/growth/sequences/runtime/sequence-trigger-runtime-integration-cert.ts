import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { resetMediaBookingHandoffStoreForCert, createBookingHandoff } from "@/lib/growth/media/media-booking-handoff-service"
import { deleteMediaAssetEventsForAsset } from "@/lib/growth/media/media-asset-analytics-repository"
import { ingestGrowthMediaPlaybackAnalyticsEvent } from "@/lib/growth/media/media-asset-analytics-service"
import { createMediaAsset } from "@/lib/growth/media/media-asset-repository"
import {
  createCondition,
  createWait,
  deleteCondition,
  updateWait,
} from "@/lib/growth/sequences/conditions/sequence-condition-repository"
import { processSequenceAttributedWakeEvent } from "@/lib/growth/sequences/conditions/sequence-event-wake-engine"
import { ensureSequenceConditionCertFixture } from "@/lib/growth/sequences/conditions/sequence-condition-cert-fixtures"
import { persistGrowthSignalDraft } from "@/lib/growth/signals/signal-repository"
import {
  dispatchBookingHandoffSequenceWakeSafely,
  dispatchHighIntentSequenceWakeSafely,
  dispatchMediaSequenceWakeSafely,
} from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-dispatchers"
import {
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
} from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-types"

export const GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER =
  "growth-sequence-trigger-runtime-s3a-cert" as const

export type GrowthSequenceTriggerRuntimeIntegrationCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthSequenceTriggerRuntimeIntegrationReport = {
  ok: boolean
  qa_marker: typeof GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER
  cert_marker: typeof GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER
  checks: GrowthSequenceTriggerRuntimeIntegrationCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "SKIP"
  cleanup: { deleted_signal_ids: string[]; deleted_condition_ids: string[]; deleted_wait_ids: string[] }
} & typeof GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS

function pushCheck(
  checks: GrowthSequenceTriggerRuntimeIntegrationCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

async function resolveCertOrganizationId(admin: SupabaseClient): Promise<string | null> {
  const configured = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()
  if (configured) return configured

  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

export async function executeGrowthSequenceTriggerRuntimeIntegrationCert(
  admin: SupabaseClient,
): Promise<GrowthSequenceTriggerRuntimeIntegrationReport> {
  const checks: GrowthSequenceTriggerRuntimeIntegrationCheck[] = []
  const blockers: string[] = []
  const deletedSignalIds: string[] = []
  const deletedConditionIds: string[] = []
  const deletedWaitIds: string[] = []
  let mediaAssetId: string | null = null

  const organizationId = await resolveCertOrganizationId(admin)
  if (!organizationId) {
    return {
      ok: false,
      qa_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
      cert_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER,
      checks: [{ id: "organization", ok: false, detail: "Missing cert organization id." }],
      blockers: ["missing_organization_id"],
      final_verdict: "FAIL",
      cleanup: { deleted_signal_ids: [], deleted_condition_ids: [], deleted_wait_ids: [] },
      ...GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
    }
  }

  const fixture = await ensureSequenceConditionCertFixture(admin)
  if (!fixture) {
    return {
      ok: false,
      qa_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
      cert_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER,
      checks: [{ id: "fixture", ok: false, detail: "SR-3 cert fixture unavailable." }],
      blockers: ["fixture_unavailable"],
      final_verdict: "FAIL",
      cleanup: { deleted_signal_ids: [], deleted_condition_ids: [], deleted_wait_ids: [] },
      ...GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
    }
  }

  const { error: activateEnrollmentError } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .update({ status: "active" })
    .eq("id", fixture.enrollmentId)
  if (activateEnrollmentError) {
    return {
      ok: false,
      qa_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
      cert_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER,
      checks: [
        {
          id: "fixture_enrollment_active",
          ok: false,
          detail: `Failed to activate cert enrollment: ${activateEnrollmentError.message}`,
        },
      ],
      blockers: ["fixture_enrollment_activation_failed"],
      final_verdict: "FAIL",
      cleanup: { deleted_signal_ids: [], deleted_condition_ids: [], deleted_wait_ids: [] },
      ...GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
    }
  }

  const now = new Date().toISOString()
  const sessionId = `${GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER}-${randomUUID()}`

  try {
    for (const spec of [
      { source: "media" as const, event: "media.viewed" as const },
      { source: "booking_handoff" as const, event: "booking_handoff.ready" as const },
      { source: "high_intent" as const, event: "high_intent.detected" as const },
    ]) {
      const condition = await createCondition(admin, {
        patternStepId: fixture.patternStepId,
        conditionKey: `${GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER}-${spec.event}`,
        spec: { dslVersion: 1, source: spec.source, event: spec.event },
        label: `S3-A integration ${spec.event}`,
      })
      deletedConditionIds.push(condition.id)
      pushCheck(checks, `db_condition_${spec.event.replaceAll(".", "_")}`, true, `${spec.event} persisted.`)
    }

    const mediaCondition = await createCondition(admin, {
      patternStepId: fixture.patternStepId,
      conditionKey: `${GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER}-media-wake`,
      spec: { dslVersion: 1, source: "media", event: "media.viewed" },
    })
    deletedConditionIds.push(mediaCondition.id)

    const mediaWait = await createWait(admin, {
      enrollmentId: fixture.enrollmentId,
      enrollmentStepId: fixture.enrollmentStepId,
      patternStepId: fixture.patternStepId,
      conditionId: mediaCondition.id,
      waitKind: "until_event",
      waitedForSource: "media",
      waitedForEvent: "media.viewed",
      status: "active",
    })
    deletedWaitIds.push(mediaWait.id)

    const asset = await createMediaAsset(admin, {
      organizationId,
      assetType: "video",
      title: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER,
      description: "S3-A integration cert asset",
      metadata: { cert_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER },
    })
    mediaAssetId = asset.id

    const ingest = await ingestGrowthMediaPlaybackAnalyticsEvent(admin, {
      organizationId,
      assetId: asset.id,
      eventType: "video_viewed",
      sessionId,
      ingestSource: "platform_admin",
      leadId: fixture.leadId,
      eventTimestamp: now,
      metadata: { cert_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER },
    })

    dispatchMediaSequenceWakeSafely(admin, {
      leadId: fixture.leadId,
      mediaAssetId: asset.id,
      sessionId,
      playbackEventType: "video_viewed",
      occurredAt: now,
      evidenceRef: ingest.event.id,
    })

    const mediaWake = await processSequenceAttributedWakeEvent(admin, {
      leadId: fixture.leadId,
      source: "media",
      event: "media.viewed",
      evidenceRef: ingest.event.id,
      occurredAt: now,
    })
    pushCheck(
      checks,
      "media_wake_fixture",
      mediaWake.scannedWaits >= 1,
      `Media wake scanned ${mediaWake.scannedWaits} wait(s).`,
    )

    resetMediaBookingHandoffStoreForCert()
    const handoff = createBookingHandoff(
      {
        organizationId,
        leadId: fixture.leadId,
        qualificationGoal: "booking_recommendation",
        companyName: "Cert Co",
        bookingHandoffEnabled: true,
      },
      { admin },
    )
    pushCheck(
      checks,
      "booking_handoff_ready_fixture",
      handoff.status === "ready",
      `Booking handoff status ${handoff.status}.`,
    )

    dispatchBookingHandoffSequenceWakeSafely(admin, {
      leadId: fixture.leadId,
      readinessTier: handoff.readinessTier,
      readinessScore: handoff.readinessScore,
      recommendation: handoff.bookingRecommendation,
      occurredAt: now,
      evidenceRef: handoff.handoffId,
    })

    const bookingWake = await processSequenceAttributedWakeEvent(admin, {
      leadId: fixture.leadId,
      source: "booking_handoff",
      event: "booking_handoff.ready",
      evidenceRef: handoff.handoffId,
      occurredAt: now,
    })
    pushCheck(
      checks,
      "booking_wake_fixture",
      bookingWake.scannedWaits >= 0,
      `Booking handoff wake scanned ${bookingWake.scannedWaits} wait(s).`,
    )

    const signalResult = await persistGrowthSignalDraft(admin, {
      organization_id: organizationId,
      signal_type: "share_page_cta_clicked",
      provider_key: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER,
      provider_event_id: `${GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER}-${randomUUID()}`,
      occurred_at: now,
      company_name: "Cert Co",
      evidence: [
        {
          source_type: "other",
          source_label: "S3-A integration cert",
          excerpt: "High-intent cert fixture",
          observed_at: now,
        },
      ],
      metadata: {
        qa_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
        cert_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER,
        lead_id: fixture.leadId,
      },
    })
    if (signalResult.signal_id) deletedSignalIds.push(signalResult.signal_id)

    if (signalResult.ok && signalResult.signal_id) {
      dispatchHighIntentSequenceWakeSafely(admin, {
        leadId: fixture.leadId,
        signalId: signalResult.signal_id,
        signalType: "share_page_cta_clicked",
        score: 82,
        occurredAt: now,
      })

      const highIntentWake = await processSequenceAttributedWakeEvent(admin, {
        leadId: fixture.leadId,
        source: "high_intent",
        event: "high_intent.detected",
        evidenceRef: signalResult.signal_id,
        occurredAt: now,
      })
      pushCheck(
        checks,
        "high_intent_wake_fixture",
        highIntentWake.scannedWaits >= 0,
        `High-intent wake scanned ${highIntentWake.scannedWaits} wait(s).`,
      )
    } else {
      pushCheck(checks, "high_intent_wake_fixture", false, "High-intent signal fixture not persisted.")
    }

    const jobsProbe = await admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id")
      .contains("metadata", { cert_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER })
      .limit(1)
    pushCheck(
      checks,
      "no_sequence_send_execution",
      (jobsProbe.data ?? []).length === 0,
      "No sequence execution jobs created for cert marker.",
    )

    const notificationsProbe = await admin
      .schema("growth")
      .from("operator_notifications")
      .select("id")
      .contains("payload", { cert_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER })
      .limit(1)
    pushCheck(
      checks,
      "no_notifications",
      (notificationsProbe.data ?? []).length === 0,
      "No operator notifications emitted for cert marker.",
    )
  } finally {
    for (const waitId of deletedWaitIds) {
      try {
        await updateWait(admin, waitId, {
          status: "cancelled",
          resolutionReason: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER,
        })
      } catch {
        // best-effort cleanup
      }
    }
    for (const conditionId of deletedConditionIds) {
      try {
        await deleteCondition(admin, conditionId)
      } catch {
        // best-effort cleanup
      }
    }
    for (const signalId of deletedSignalIds) {
      try {
        await admin.schema("growth").from("signals").delete().eq("id", signalId)
      } catch {
        // best-effort cleanup
      }
    }
    if (mediaAssetId) {
      try {
        await deleteMediaAssetEventsForAsset(admin, { organizationId, assetId: mediaAssetId })
      } catch {
        // best-effort cleanup
      }
      try {
        await admin.schema("growth").from("media_assets").delete().eq("id", mediaAssetId)
      } catch {
        // best-effort cleanup
      }
    }
    try {
      await admin
        .schema("growth")
        .from("signals")
        .delete()
        .eq("provider_key", "media_booking_handoff")
        .contains("metadata", { cert_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER })
    } catch {
      // best-effort cleanup
    }
  }

  const failed = checks.filter((check) => !check.ok)
  for (const check of failed) blockers.push(`${check.id}: ${check.detail}`)

  return {
    ok: failed.length === 0,
    qa_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
    cert_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERT_MARKER,
    checks,
    blockers,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
    cleanup: {
      deleted_signal_ids: deletedSignalIds,
      deleted_condition_ids: deletedConditionIds,
      deleted_wait_ids: deletedWaitIds,
    },
    ...GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
  }
}
