import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { resolveAttributionContextFromDeliveryAttempt } from "@/lib/growth/revenue-intelligence/revenue-attribution"

export type ResolvedAttributionContext = {
  leadId: string
  opportunityId: string | null
  sequenceId: string | null
  sequenceStepId: string | null
  sequenceEnrollmentId: string | null
  senderAccountId: string | null
  repUserId: string | null
  campaignId: string | null
  deliveryAttemptId: string | null
}

export async function resolveAttributionContextForLead(
  admin: SupabaseClient,
  leadId: string,
  overrides?: Partial<ResolvedAttributionContext>,
): Promise<ResolvedAttributionContext | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null

  let opportunityId: string | null = overrides?.opportunityId ?? null
  if (!opportunityId) {
    const { data: opp } = await admin
      .schema("growth")
      .from("opportunities")
      .select("id")
      .eq("lead_id", leadId)
      .maybeSingle()
    opportunityId = opp?.id ? String(opp.id) : null
  }

  let sequenceEnrollmentId = overrides?.sequenceEnrollmentId ?? lead.activeSequenceEnrollmentId ?? null
  let sequenceId = overrides?.sequenceId ?? null
  let sequenceStepId = overrides?.sequenceStepId ?? null

  if (sequenceEnrollmentId && !sequenceId) {
    const { data: enrollment } = await admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("sequence_pattern_id, current_step_order")
      .eq("id", sequenceEnrollmentId)
      .maybeSingle()
    if (enrollment) {
      sequenceId = enrollment.sequence_pattern_id ? String(enrollment.sequence_pattern_id) : null
      if (!sequenceStepId && enrollment.current_step_order != null && sequenceId) {
        const { data: step } = await admin
          .schema("growth")
          .from("sequence_pattern_steps")
          .select("id")
          .eq("sequence_pattern_id", sequenceId)
          .eq("step_order", enrollment.current_step_order)
          .maybeSingle()
        sequenceStepId = step?.id ? String(step.id) : null
      }
    }
  }

  const campaignId = overrides?.campaignId ?? lead.sourceCampaign ?? null

  return {
    leadId,
    opportunityId,
    sequenceId,
    sequenceStepId,
    sequenceEnrollmentId,
    senderAccountId: overrides?.senderAccountId ?? null,
    repUserId: overrides?.repUserId ?? lead.assignedTo ?? null,
    campaignId: campaignId && campaignId.length > 0 ? campaignId : null,
    deliveryAttemptId: overrides?.deliveryAttemptId ?? null,
  }
}

export async function resolveAttributionContextFromAttempt(
  admin: SupabaseClient,
  deliveryAttemptId: string,
): Promise<ResolvedAttributionContext | null> {
  const delivery = await resolveAttributionContextFromDeliveryAttempt(admin, deliveryAttemptId)
  if (!delivery.leadId) return null

  const { data: attempt } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("metadata, channel")
    .eq("id", deliveryAttemptId)
    .maybeSingle()

  const metadata = (attempt?.metadata as Record<string, unknown> | null) ?? {}
  const base = await resolveAttributionContextForLead(admin, delivery.leadId, {
    sequenceEnrollmentId: delivery.sequenceEnrollmentId,
    sequenceId: delivery.sequenceId,
    sequenceStepId: metadata.sequence_step_id ? String(metadata.sequence_step_id) : null,
    senderAccountId: delivery.senderAccountId,
    deliveryAttemptId,
  })
  if (!base) return null

  if (!base.sequenceStepId) {
    const { data: job } = await admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("sequence_step_id")
      .eq("delivery_attempt_id", deliveryAttemptId)
      .maybeSingle()
    if (job?.sequence_step_id) base.sequenceStepId = String(job.sequence_step_id)
  }

  return base
}
