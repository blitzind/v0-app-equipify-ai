/**
 * GE-AIOS-SAFETY-1 — Server resolver for autonomous execution guardrails.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { resolveLeadCommunicationStrategyBundle, buildLeadCommunicationStrategyTouchHistory } from "@/lib/growth/contact-verification/lead-communication-strategy-resolver"
import { auditAutonomousExecutionGuardrailDecision } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-audit"
import { evaluateAutonomousExecutionGuardrails } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-engine"
import {
  isAutonomousExecutionGuardrailsEnabled,
  isAutonomousExecutionKillSwitchActive,
} from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-feature"
import type {
  AutonomousExecutionGuardrailDecision,
  AutonomousExecutionGuardrailInput,
} from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-types"
import { adaptAutonomousExecutionGuardrailToDisplay } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-view"
import {
  buildDailyRevenueWorkQueue,
  summarizeDailyRevenueWorkQueue,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-engine"
import type { DailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import type { GrowthLead } from "@/lib/growth/types"

async function isLeadSuppressed(admin: SupabaseClient, leadId: string, email: string | null): Promise<boolean> {
  try {
    const { data } = await admin
      .schema("growth")
      .from("suppression_entries")
      .select("id")
      .or(`lead_id.eq.${leadId}${email ? `,email.eq.${email}` : ""}`)
      .limit(1)
    return (data ?? []).length > 0
  } catch {
    return false
  }
}

function buildGuardrailInputFromLead(input: {
  lead: GrowthLead
  bundle: Awaited<ReturnType<typeof resolveLeadCommunicationStrategyBundle>>
  guardrailsEnabled: boolean
  killSwitchActive: boolean
  queueSummary?: Pick<
    ReturnType<typeof summarizeDailyRevenueWorkQueue>,
    "actionableCount" | "waitingCount" | "blockedCount"
  > | null
  queueChannelAllocation?: DailyRevenueWorkQueue["channelAllocation"]
  suggestedDailyCapacity?: number
  correlationId?: string
}): AutonomousExecutionGuardrailInput | null {
  const stack = input.bundle.bundle?.stack
  const communicationStrategy = input.bundle.bundle?.communication_strategy
  const revenueExecutionPlan = input.bundle.bundle?.revenue_execution_plan
  if (!stack || !communicationStrategy || !revenueExecutionPlan) return null

  const action = communicationStrategy.recommendedAction
  const channel = communicationStrategy.primaryChannel
  const email = input.lead.contactEmail
  const isCompetitor =
    stack.qualification.blockers.some((blocker) => blocker.toLowerCase().includes("competitor")) ||
    input.lead.metadata?.competitorDetected === true

  return {
    guardrailsEnabled: input.guardrailsEnabled,
    killSwitchActive: input.killSwitchActive,
    leadId: input.lead.id,
    companyId: stack.qualification.companyId,
    action,
    channel,
    communicationStrategy,
    revenueExecutionPlan,
    nextBestAction: stack.nextBestAction,
    qualification: stack.qualification,
    sequenceRecommendation: stack.sequence,
    acquisitionCandidate: stack.qualification.acquisitionCandidate ?? null,
    leadStatus: input.lead.status,
    contactEmail: email,
    contactPhone: input.lead.contactPhone,
    isCustomer: input.lead.status === "converted",
    isCompetitor,
    consentFlagPresent:
      typeof input.lead.metadata?.smsConsent === "boolean" ? input.lead.metadata.smsConsent : undefined,
    legalBasisPresent:
      typeof input.lead.metadata?.legalBasisRecorded === "boolean"
        ? input.lead.metadata.legalBasisRecorded
        : undefined,
    mailbox: {
      warmed: input.lead.metadata?.mailboxWarmed === true ? true : undefined,
      dailyCap: input.suggestedDailyCapacity,
      bounceRateThreshold: 5,
    },
    campaign: {
      active: input.lead.activeSequenceEnrollmentId ? true : undefined,
      alreadyEnrolled: Boolean(input.lead.activeSequenceEnrollmentId),
      humanApprovedSequence: false,
    },
    channelCaps: {
      limits: input.queueChannelAllocation,
    },
    providerReadiness: {
      emailReady: Boolean(email),
      smsEnabled: process.env.GROWTH_SMS_ENABLED === "true",
      voiceDropEnabled: true,
      voiceDropRecordingApproved: true,
      templatePresent: true,
      unsubscribeFooterAvailable: true,
      videoAssetApproved: false,
    },
    approvalState: {
      humanApprovalPending: communicationStrategy.requiresHumanApproval,
    },
    correlationId: input.correlationId ?? `${input.lead.id}:${action}`,
  }
}

export async function evaluateAutonomousExecutionGuardrailsForLead(
  admin: SupabaseClient,
  input: {
    leadId: string
    correlationId?: string
    recordAudit?: boolean
    overrides?: Partial<AutonomousExecutionGuardrailInput>
  },
): Promise<{
  enabled: boolean
  decision: AutonomousExecutionGuardrailDecision | null
  display: ReturnType<typeof adaptAutonomousExecutionGuardrailToDisplay> | null
}> {
  const guardrailsEnabled = isAutonomousExecutionGuardrailsEnabled()
  const killSwitchActive = isAutonomousExecutionKillSwitchActive()

  if (!guardrailsEnabled) {
    return { enabled: false, decision: null, display: null }
  }

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    return { enabled: true, decision: null, display: null }
  }

  const organizationId = getGrowthEngineAiOrgId()
  const bundle = await resolveLeadCommunicationStrategyBundle(lead, { organizationId })
  const queue = buildDailyRevenueWorkQueue({
    candidates: bundle.bundle?.stack
      ? [
          {
            leadId: lead.id,
            companyId: bundle.bundle.stack.qualification.companyId,
            qualification: bundle.bundle.stack.qualification,
            sequenceRecommendation: bundle.bundle.stack.sequence,
            nextBestAction: bundle.bundle.stack.nextBestAction,
            revenueExecutionPlan: bundle.bundle.revenue_execution_plan!,
            communicationStrategy: bundle.bundle.communication_strategy!,
            touchHistory: buildLeadCommunicationStrategyTouchHistory(lead),
            suppressed: await isLeadSuppressed(admin, lead.id, lead.contactEmail),
          },
        ]
      : [],
  })
  const queueSummary = summarizeDailyRevenueWorkQueue(queue)

  const guardrailInput = buildGuardrailInputFromLead({
    lead,
    bundle,
    guardrailsEnabled,
    killSwitchActive,
    queueSummary,
    queueChannelAllocation: queue.channelAllocation,
    suggestedDailyCapacity: queue.suggestedDailyCapacity,
    correlationId: input.correlationId,
  })

  if (!guardrailInput) {
    return { enabled: true, decision: null, display: null }
  }

  const mergedInput: AutonomousExecutionGuardrailInput = {
    ...guardrailInput,
    ...input.overrides,
    suppressed:
      input.overrides?.suppressed ??
      guardrailInput.suppressed ??
      (await isLeadSuppressed(admin, lead.id, lead.contactEmail)),
    hardBounced: input.overrides?.hardBounced ?? lead.contactTemperature === "suppressed",
    unsubscribed: input.overrides?.unsubscribed ?? lead.contactTemperature === "suppressed",
  }

  const decision = evaluateAutonomousExecutionGuardrails(mergedInput)
  const display = adaptAutonomousExecutionGuardrailToDisplay(decision)

  if (input.recordAudit !== false) {
    await auditAutonomousExecutionGuardrailDecision(admin, {
      decision,
      leadId: lead.id,
      companyId: mergedInput.companyId ?? null,
      action: mergedInput.action,
      channel: mergedInput.channel,
      correlationId: mergedInput.correlationId,
    })
  }

  return { enabled: true, decision, display }
}

export async function evaluateAutonomousExecutionGuardrailsFromInput(
  admin: SupabaseClient,
  input: AutonomousExecutionGuardrailInput & { recordAudit?: boolean },
): Promise<AutonomousExecutionGuardrailDecision> {
  const decision = evaluateAutonomousExecutionGuardrails({
    ...input,
    guardrailsEnabled: input.guardrailsEnabled ?? isAutonomousExecutionGuardrailsEnabled(),
    killSwitchActive: input.killSwitchActive ?? isAutonomousExecutionKillSwitchActive(),
  })

  if (input.recordAudit !== false && decision.enabled) {
    await auditAutonomousExecutionGuardrailDecision(admin, {
      decision,
      leadId: input.leadId,
      companyId: input.companyId ?? null,
      action: input.action,
      channel: input.channel,
      correlationId: input.correlationId,
    })
  }

  return decision
}
