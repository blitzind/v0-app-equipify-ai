import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import type { GrowthAudienceMember } from "@/lib/growth/audiences/growth-audience-types"
import type { GrowthAudienceEnrollmentPreviewCategory } from "@/lib/growth/audiences/growth-audience-config"
import { fetchGrowthSequenceEnrollmentForLeadAndPattern } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { runSequenceEnrollmentPreflight } from "@/lib/growth/sequence-enrollment/sequence-enrollment-preflight"
import { fetchDailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-resolver"
import { buildEnrollmentPreviewQueueReason } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-integration"
import { evaluateAutonomousExecutionGuardrailsForLead } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-resolver"
import { summarizeAutonomousExecutionGuardrailDecision } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-engine"

export type AudienceMemberEnrollmentClassification = {
  category: GrowthAudienceEnrollmentPreviewCategory
  reason: string
  leadId: string | null
  displayLabel: string
  queueReason?: string | null
  guardrailReason?: string | null
}

function memberDisplayLabel(member: GrowthAudienceMember): string {
  if (member.memberKind === "person") {
    return member.personName ?? member.growthPersonId ?? member.memberKey ?? member.id
  }
  return member.companyName ?? member.companyId ?? member.memberKey ?? member.id
}

export async function classifyAudienceMemberEnrollmentReadiness(
  admin: SupabaseClient,
  input: {
    member: GrowthAudienceMember
    sequencePatternId: string
  },
): Promise<AudienceMemberEnrollmentClassification> {
  const displayLabel = memberDisplayLabel(input.member)

  if (!input.member.leadId) {
    return {
      category: "missing_contact",
      reason: "No growth lead linked — create lead before enrollment.",
      leadId: null,
      displayLabel,
    }
  }

  const lead = await fetchGrowthLeadById(admin, input.member.leadId)
  if (!lead) {
    return {
      category: "missing_contact",
      reason: "Growth lead not found.",
      leadId: input.member.leadId,
      displayLabel,
    }
  }

  if (
    lead.contactTemperature === "suppressed" ||
    lead.status === "disqualified" ||
    lead.status === "archived"
  ) {
    return {
      category: "suppressed",
      reason: "Lead is suppressed or disqualified.",
      leadId: lead.id,
      displayLabel: lead.companyName ?? displayLabel,
    }
  }

  const hasEmail = Boolean(lead.contactEmail?.trim())
  const hasPhone = Boolean(lead.contactPhone?.trim())
  if (!hasEmail && !hasPhone) {
    return {
      category: "missing_contact",
      reason: "Missing verified email and phone on cached lead record.",
      leadId: lead.id,
      displayLabel: lead.companyName ?? displayLabel,
    }
  }

  const samePattern = await fetchGrowthSequenceEnrollmentForLeadAndPattern(
    admin,
    lead.id,
    input.sequencePatternId,
  )
  if (samePattern && ["draft", "active", "paused"].includes(samePattern.status)) {
    return {
      category: "already_enrolled",
      reason: `Already enrolled in this sequence (${samePattern.status}).`,
      leadId: lead.id,
      displayLabel: lead.companyName ?? displayLabel,
    }
  }

  const { data: otherActive } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, sequence_pattern_id, status")
    .eq("lead_id", lead.id)
    .in("status", ["draft", "active", "paused"])
    .neq("sequence_pattern_id", input.sequencePatternId)
    .limit(1)
    .maybeSingle()

  if (otherActive) {
    return {
      category: "already_enrolled",
      reason: "Active enrollment exists on a different sequence pattern.",
      leadId: lead.id,
      displayLabel: lead.companyName ?? displayLabel,
    }
  }

  const preflight = await runSequenceEnrollmentPreflight(admin, lead, {
    patternId: input.sequencePatternId,
  })

  if (!preflight.allowed) {
    if (preflight.code === "suppressed" || preflight.code === "lead_blocked") {
      return {
        category: "suppressed",
        reason: preflight.reason ?? "Lead blocked by suppression rules.",
        leadId: lead.id,
        displayLabel: lead.companyName ?? displayLabel,
      }
    }
    if (preflight.code === "active_enrollment") {
      return {
        category: "already_enrolled",
        reason: preflight.reason ?? "Active enrollment conflict.",
        leadId: lead.id,
        displayLabel: lead.companyName ?? displayLabel,
      }
    }
    return {
      category: "blocked_by_limits",
      reason: preflight.reason ?? preflight.code ?? "Blocked by sequence readiness rules.",
      leadId: lead.id,
      displayLabel: lead.companyName ?? displayLabel,
    }
  }

  const dailyQueue = (await fetchDailyRevenueWorkQueue(admin, { limit: 100 })).queue
  const queueReason = buildEnrollmentPreviewQueueReason({
    queue: dailyQueue,
    leadId: lead.id,
    scheduledToday: dailyQueue
      ? Boolean(
          [...dailyQueue.critical, ...dailyQueue.high, ...dailyQueue.medium, ...dailyQueue.low].find(
            (item) => item.leadId === lead.id,
          ),
        )
      : false,
  })

  const guardrail = await evaluateAutonomousExecutionGuardrailsForLead(admin, {
    leadId: lead.id,
    correlationId: `enrollment_preview:${lead.id}`,
    recordAudit: true,
  })
  const guardrailReason = guardrail.decision
    ? summarizeAutonomousExecutionGuardrailDecision(guardrail.decision)
    : null

  return {
    category: "eligible",
    reason: queueReason
      ? `Eligible for operator-confirmed enrollment. ${queueReason}${guardrailReason ? ` · Guardrails: ${guardrailReason}` : ""}`
      : guardrailReason
        ? `Eligible for operator-confirmed enrollment. Guardrails: ${guardrailReason}`
        : "Eligible for operator-confirmed enrollment.",
    queueReason,
    guardrailReason,
    leadId: lead.id,
    displayLabel: lead.companyName ?? displayLabel,
  }
}
