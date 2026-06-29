/**
 * GE-LAUNCH-1A — Unified Revenue Workflow Orchestrator.
 * One canonical path: intake → identity/verification → IRE stack → queue → human approval.
 * No sends, enrollments, or autonomous execution.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { EmailLearningObservation } from "@/lib/growth/contact-verification/email-learning"
import {
  resolveNativeRevenueDecisionAuthoritativeBundle,
  type NativeRevenueDecisionEngineDependencies,
} from "@/lib/growth/contact-verification/native-revenue-decision-adapter"
import { isNativeRevenueDecisionEngineEnabled } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import {
  buildLeadCommunicationStrategyTouchHistory,
} from "@/lib/growth/contact-verification/lead-communication-strategy-resolver"
import { buildDailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-engine"
import { isDailyRevenueWorkQueueEnabled } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import { buildDailyRevenueWorkQueueIndex } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-integration"
import type { WorkQueueItem } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import { buildProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import type { GrowthLead } from "@/lib/growth/types"
import { loadIreHistoricalLearning } from "@/lib/growth/revenue-workflow/load-ire-historical-learning"
import {
  resolveUnifiedLeadFromIntake,
} from "@/lib/growth/revenue-workflow/unified-revenue-workflow-lead-resolver"
import { isUnifiedRevenueWorkflowEnabled } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-feature"
import {
  GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER,
  type NormalizedLeadIntake,
  type UnifiedRevenueWorkflowHumanApprovalPayload,
  type UnifiedRevenueWorkflowResult,
} from "@/lib/growth/revenue-workflow/unified-lead-intake-types"

export type UnifiedRevenueWorkflowRunInput = {
  intake: NormalizedLeadIntake
  organizationId: string
  admin: SupabaseClient
  actor?: { userId: string | null; email?: string | null }
  generatedAt?: string
  skipLeadPersistence?: boolean
  historicalLearning?: EmailLearningObservation[]
  dependencies?: NativeRevenueDecisionEngineDependencies
}

function intakeAllowsCompanyOnly(source: NormalizedLeadIntake["source"]): boolean {
  return source === "linkedin_capture" || source === "browser_intake" || source === "website"
}

function buildIntelligenceFromIntake(
  intake: NormalizedLeadIntake,
  lead: GrowthLead,
): GrowthProspectSearchContactIntelligence | null {
  const contactId = intake.personId ?? intake.contactId ?? lead.primaryDecisionMakerId ?? lead.id
  const contactName = intake.contactName ?? lead.contactName
  const email = intake.email ?? lead.contactEmail
  const phone = intake.phone ?? lead.contactPhone

  if (!contactName && !email && !phone) {
    if (intakeAllowsCompanyOnly(intake.source)) {
      return buildProspectSearchContactIntelligence({
        company_id: lead.id,
        contacts: [],
        committee_completeness: 0,
        schema_ready: true,
        source_labels: [intake.source],
      })
    }
    return buildProspectSearchContactIntelligence({
      company_id: lead.id,
      contacts: [],
      committee_completeness: 0,
      schema_ready: true,
      source_labels: [intake.source],
    })
  }

  return buildProspectSearchContactIntelligence({
    company_id: lead.id,
    contacts: [
      {
        id: contactId,
        full_name: contactName ?? "Primary contact",
        title: intake.title,
        confidence: intake.identityUncertain ? 55 : 82,
        source_evidence: [
          {
            claim: "Unified intake",
            evidence: intake.source,
            source: intake.source,
          },
        ],
        role_type: "decision_maker",
        email,
        phone,
        linkedin_url: intake.linkedinUrl,
        verification_status: email ? "pending" : "unknown",
      },
    ],
    committee_completeness: contactName ? 33 : 0,
    schema_ready: true,
    source_labels: [intake.source],
  })
}

function buildHumanApprovalPayload(input: {
  requiresHumanReview: boolean
  communicationStrategyRequiresApproval: boolean
  nextBestAction: string | null
  channel: string | null
  blockers: string[]
}): UnifiedRevenueWorkflowHumanApprovalPayload {
  const reasons: string[] = []
  if (input.requiresHumanReview) reasons.push("Intake identity requires operator review.")
  if (input.communicationStrategyRequiresApproval) {
    reasons.push("Communication strategy requires human approval before execution.")
  }
  if (input.blockers.length > 0) {
    reasons.push(...input.blockers.slice(0, 4))
  }

  return {
    required: input.requiresHumanReview || input.communicationStrategyRequiresApproval || input.blockers.length > 0,
    reasons,
    recommended_action: input.nextBestAction,
    recommended_channel: input.channel,
    guardrail_blocked: true,
    guardrail_reasons: ["Autonomous execution disabled — human approval required before send/enrollment."],
  }
}

function resolveDailyWorkQueueItem(input: {
  lead: GrowthLead
  bundle: NonNullable<Awaited<ReturnType<typeof resolveNativeRevenueDecisionAuthoritativeBundle>>>
  generatedAt: string
}): WorkQueueItem | undefined {
  if (!isDailyRevenueWorkQueueEnabled()) return undefined

  const { stack, communication_strategy, revenue_execution_plan } = input.bundle
  if (!communication_strategy || !revenue_execution_plan) return undefined

  const queue = buildDailyRevenueWorkQueue({
    generatedAt: input.generatedAt,
    candidates: [
      {
        leadId: input.lead.id,
        companyId: stack.qualification.companyId,
        qualification: stack.qualification,
        sequenceRecommendation: stack.sequence,
        nextBestAction: stack.nextBestAction,
        revenueExecutionPlan: revenue_execution_plan,
        communicationStrategy: communication_strategy,
        touchHistory: buildLeadCommunicationStrategyTouchHistory(input.lead),
      },
    ],
  })

  return buildDailyRevenueWorkQueueIndex(queue).get(input.lead.id)?.item
}

export async function runUnifiedRevenueWorkflow(
  input: UnifiedRevenueWorkflowRunInput,
): Promise<UnifiedRevenueWorkflowResult> {
  const warnings = [...input.intake.warnings]
  const blockers = [...input.intake.blockers]
  const generatedAt = input.generatedAt ?? new Date().toISOString()

  if (!isUnifiedRevenueWorkflowEnabled()) {
    return {
      qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER,
      source: input.intake.source,
      approvalRequired: true,
      blockers: [...blockers, "unified_revenue_workflow_disabled"],
      warnings,
    }
  }

  if (!isNativeRevenueDecisionEngineEnabled()) {
    return {
      qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER,
      source: input.intake.source,
      approvalRequired: true,
      blockers: [...blockers, "native_revenue_decision_engine_disabled"],
      warnings,
    }
  }

  let lead: GrowthLead | null = null
  if (input.skipLeadPersistence && input.intake.leadId) {
    lead = await fetchGrowthLeadById(input.admin, input.intake.leadId)
  } else if (!input.skipLeadPersistence) {
    try {
      const resolved = await resolveUnifiedLeadFromIntake(input.admin, input.intake, input.actor)
      lead = resolved.lead
      if (resolved.dedupeRule) {
        warnings.push(`dedupe_match:${resolved.dedupeRule}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "lead_resolution_failed"
      blockers.push(message)
      return {
        qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER,
        source: input.intake.source,
        approvalRequired: true,
        blockers,
        warnings,
      }
    }
  }

  if (!lead) {
    blockers.push("lead_required")
    return {
      qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER,
      source: input.intake.source,
      approvalRequired: true,
      blockers,
      warnings,
    }
  }

  const intelligence = buildIntelligenceFromIntake(input.intake, lead)
  if (!intelligence?.has_contacts && !intakeAllowsCompanyOnly(input.intake.source)) {
    blockers.push("insufficient_contact_context")
  }

  const historicalLearning =
    input.historicalLearning ??
    (await loadIreHistoricalLearning({
      admin: input.admin,
      organizationId: input.organizationId,
      leadId: lead.id,
      domain: input.intake.domain,
      email: input.intake.email ?? lead.contactEmail,
    }))

  if (historicalLearning.length > 0) {
    warnings.push(`historical_learning_loaded:${historicalLearning.length}`)
  }

  const bundle = intelligence?.has_contacts
    ? await resolveNativeRevenueDecisionAuthoritativeBundle({
        buildInput: {
          companyId: lead.id,
          organizationId: input.organizationId,
          companyName: input.intake.companyName || lead.companyName,
          website: input.intake.website ?? lead.website,
          industry: input.intake.industry,
          intelligence,
          generatedAt,
          touchHistory: buildLeadCommunicationStrategyTouchHistory(lead),
          historicalLearning,
        },
        dependencies: { skipDns: true, ...input.dependencies },
      })
    : null

  const stack = bundle?.stack
  const communicationStrategy = bundle?.communication_strategy ?? undefined
  const revenueExecutionPlan = bundle?.revenue_execution_plan ?? undefined
  const dailyWorkQueueStatus = bundle
    ? resolveDailyWorkQueueItem({ lead, bundle, generatedAt })
    : undefined

  if (stack) {
    blockers.push(...stack.nextBestAction.blockers.slice(0, 4))
    warnings.push(...stack.nextBestAction.warnings.slice(0, 4))
  }

  const humanApproval = buildHumanApprovalPayload({
    requiresHumanReview: input.intake.requiresHumanReview,
    communicationStrategyRequiresApproval: communicationStrategy?.requiresHumanApproval ?? true,
    nextBestAction: stack?.nextBestAction.action ?? null,
    channel: stack?.nextBestAction.recommendedChannel ?? communicationStrategy?.primaryChannel ?? null,
    blockers,
  })

  logGrowthEngine("unified_revenue_workflow_completed", {
    leadId: lead.id,
    source: input.intake.source,
    hasStack: Boolean(stack),
    historicalLearningCount: historicalLearning.length,
    approvalRequired: humanApproval.required,
  })

  return {
    qa_marker: GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER,
    source: input.intake.source,
    companyId: lead.id,
    leadId: lead.id,
    personId: stack?.acquisition.primaryContact.personId ?? input.intake.personId ?? undefined,
    contactId: input.intake.contactId ?? lead.primaryDecisionMakerId ?? undefined,
    acquisitionCandidate: stack?.acquisition,
    qualification: stack?.qualification,
    sequenceRecommendation: stack?.sequence,
    nextBestAction: stack?.nextBestAction,
    revenueExecutionPlan,
    communicationStrategy,
    dailyWorkQueueStatus,
    humanApproval,
    approvalRequired: humanApproval.required,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
  }
}
