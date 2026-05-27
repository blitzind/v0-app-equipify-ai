import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthComplaintType } from "@/lib/growth/compliance/compliance-types"
import {
  recordComplaintDetectedTimelineEvent,
  recordSenderReputationDeclinedTimelineEvent,
} from "@/lib/growth/compliance/compliance-events"
import { applyDeliverySuppression } from "@/lib/growth/compliance/suppression-engine"
import { buildSenderReputationSnapshot } from "@/lib/growth/compliance/sender-reputation"
import { getDeliveryAttempt } from "@/lib/growth/providers/transport/transport-repository"
import { recordExperimentMetricFromDeliveryAttempt } from "@/lib/growth/experiments/experiment-metrics"

function complaintsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("email_complaints")
}

function bouncesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("email_bounces")
}

export async function recordEmailComplaint(
  admin: SupabaseClient,
  input: {
    deliveryAttemptId: string
    complaintType: GrowthComplaintType
    providerReason?: string | null
    recipientEmail?: string | null
    occurredAt?: string
  },
): Promise<{ recorded: boolean }> {
  const attempt = await getDeliveryAttempt(admin, input.deliveryAttemptId)
  if (!attempt) return { recorded: false }

  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const sanitizedReason = input.providerReason?.slice(0, 500) ?? null

  const { error } = await complaintsTable(admin).insert({
    delivery_attempt_id: attempt.id,
    lead_id: attempt.lead_id,
    sender_account_id: attempt.sender_account_id,
    provider_id: attempt.provider_id,
    complaint_type: input.complaintType,
    provider_reason: sanitizedReason,
    occurred_at: occurredAt,
  })

  if (error) throw new Error(error.message)

  const recipientEmail =
    input.recipientEmail ?? (typeof attempt.metadata.to === "string" ? attempt.metadata.to : null)

  if (recipientEmail) {
    await applyDeliverySuppression(admin, {
      email: recipientEmail,
      leadId: attempt.lead_id,
      reason: `Complaint (${input.complaintType})`,
    })
  }

  await recordComplaintDetectedTimelineEvent(admin, {
    leadId: attempt.lead_id,
    complaintType: input.complaintType,
    deliveryAttemptId: attempt.id,
    occurredAt,
  })

  await maybeRecordReputationDecline(admin, {
    senderAccountId: attempt.sender_account_id,
    leadId: attempt.lead_id,
  })

  await recordExperimentMetricFromDeliveryAttempt(admin, {
    deliveryAttemptId: attempt.id,
    metric: "complaints",
  }).catch(() => undefined)

  return { recorded: true }
}

async function maybeRecordReputationDecline(
  admin: SupabaseClient,
  input: { senderAccountId: string; leadId?: string | null },
): Promise<void> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [hardRes, softRes, complaintRes, spamRes] = await Promise.all([
    bouncesTable(admin)
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", input.senderAccountId)
      .in("bounce_type", ["hard", "blocked"])
      .gte("occurred_at", since30d),
    bouncesTable(admin)
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", input.senderAccountId)
      .in("bounce_type", ["soft", "transient"])
      .gte("occurred_at", since30d),
    complaintsTable(admin)
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", input.senderAccountId)
      .gte("occurred_at", since30d),
    bouncesTable(admin)
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", input.senderAccountId)
      .eq("bounce_type", "spam")
      .gte("occurred_at", since30d),
  ])

  const snapshot = buildSenderReputationSnapshot({
    hardBounces: hardRes.count ?? 0,
    softBounces: softRes.count ?? 0,
    complaints: complaintRes.count ?? 0,
    spamEvents: spamRes.count ?? 0,
    cleanDays: 0,
  })

  if (snapshot.tier === "warning" || snapshot.tier === "critical") {
    await recordSenderReputationDeclinedTimelineEvent(admin, {
      leadId: input.leadId,
      senderAccountId: input.senderAccountId,
      score: snapshot.score,
      tier: snapshot.tier,
    })
  }
}
