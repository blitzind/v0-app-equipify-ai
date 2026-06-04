/** Deterministic Prospect → Growth Engine pipeline automation (Sprint 4.2). Client-safe. */

import { buildProspectSearchLeadEngineHandoffUrl } from "@/lib/growth/prospect-search/prospect-search-lead-engine-handoff"
import {
  buildOutboundLaunchUrls,
  outboundLaunchActionDisabledReason,
  runOutboundLaunchPreflight,
} from "@/lib/growth/outbound-launch/outbound-launch-motion"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"
import {
  appendWorkflowContextToUrl,
  buildGrowthWorkflowContext,
  type GrowthProspectPipelineRecommendation,
  type GrowthProspectSequenceBridge,
  type GrowthProspectWorkflowContext,
  type GrowthWorkflowContextHandoff,
} from "@/lib/growth/prospect-search/prospect-workflow-context"

export type {
  GrowthProspectPipelineRecommendation,
  GrowthProspectSequenceBridge,
  GrowthProspectWorkflowContext,
} from "@/lib/growth/prospect-search/prospect-workflow-context"

export const GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER =
  "growth-prospect-pipeline-automation-v1" as const

export type GrowthProspectWorkflowContinuityEventKind =
  | "prospect_workflow_started"
  | "lead_engine_launched"
  | "outreach_workflow_started"
  | "meeting_workflow_started"
  | "sequence_workflow_started"

export type GrowthProspectPipelineAutomationOverlay = {
  qa_marker: typeof GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER
  recommendation: GrowthProspectPipelineRecommendation
  sequence_bridge: GrowthProspectSequenceBridge
}

export const GROWTH_PROSPECT_WORKFLOW_ACTION_GROUPS = [
  "qualification",
  "outreach",
  "meetings",
  "revenue_execution",
  "relationship_expansion",
] as const

export type GrowthProspectWorkflowActionGroup = (typeof GROWTH_PROSPECT_WORKFLOW_ACTION_GROUPS)[number]

export type GrowthProspectWorkflowLauncherAction = {
  id: string
  label: string
  group: GrowthProspectWorkflowActionGroup
  enabled: boolean
  disabled_reason: string | null
  launch_url: string | null
  server_action: string | null
  timeline_event_kind: GrowthProspectWorkflowContinuityEventKind | null
  is_primary: boolean
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function hasLeadRecord(company: Pick<GrowthProspectSearchCompanyResult, "growth_lead_id" | "lead_inbox_id">): boolean {
  return Boolean(company.growth_lead_id || company.lead_inbox_id)
}

function dmCoverageScore(company: Pick<GrowthProspectSearchCompanyResult, "decision_maker_coverage" | "contact_intelligence">): number {
  if (company.decision_maker_coverage != null) return company.decision_maker_coverage
  return company.contact_intelligence?.contact_confidence_score ?? 0
}

export function deriveProspectSequenceBridge(
  company: Pick<
    GrowthProspectSearchCompanyResult,
    | "is_suppressed"
    | "buying_stage"
    | "lead_engine_score"
    | "lead_score"
    | "contact_intelligence"
    | "field_service_software"
    | "crm_detected"
    | "signals"
    | "growth_signal_recommended_action"
    | "in_lead_inbox"
    | "already_pushed"
    | "lead_engine_last_run_at"
  >,
): GrowthProspectSequenceBridge {
  if (company.is_suppressed) {
    return {
      recommended_sequence_label: null,
      recommended_sequence_confidence: null,
      recommended_sequence_reason: "Suppressed — resolve suppression before sequence planning.",
      recommended_first_touch: null,
    }
  }

  const score = company.lead_engine_score ?? company.lead_score ?? 0
  const hasPhoneContact = Boolean(company.contact_intelligence?.first_contact?.phone)
  const buyingStage = company.buying_stage ?? ""
  const signalText = (company.signals[0] ?? "").toLowerCase()
  const hasReplySignal = signalText.includes("reply") || signalText.includes("respond")

  if (hasReplySignal || company.growth_signal_recommended_action?.toLowerCase().includes("follow")) {
    return {
      recommended_sequence_label: "Follow-up after reply",
      recommended_sequence_confidence: clampConfidence(55 + score * 0.2),
      recommended_sequence_reason: "Reply or follow-up signal detected in existing evidence.",
      recommended_first_touch: "Human-reviewed follow-up email",
    }
  }

  if (buyingStage === "decision" || buyingStage === "consideration") {
    return {
      recommended_sequence_label: hasPhoneContact ? "Email then call" : "Qualification email sequence",
      recommended_sequence_confidence: clampConfidence(45 + score * 0.25),
      recommended_sequence_reason: `Buying stage ${buyingStage.replace(/_/g, " ")} with qualification score ${score}.`,
      recommended_first_touch: hasPhoneContact ? "Email, then operator call" : "Evidence-backed email touch",
    }
  }

  if (!company.lead_engine_last_run_at && score < 50) {
    return {
      recommended_sequence_label: "Cold qualification sequence",
      recommended_sequence_confidence: clampConfidence(35 + score * 0.15),
      recommended_sequence_reason: "Limited qualification evidence — start with low-friction email touches.",
      recommended_first_touch: "Manual approval email draft",
    }
  }

  return {
    recommended_sequence_label: "Cold email qualification",
    recommended_sequence_confidence: clampConfidence(30 + score * 0.2),
    recommended_sequence_reason: "Default qualification path from lead score and buying stage evidence.",
    recommended_first_touch: "Operator-approved first email",
  }
}

export function deriveProspectPipelineRecommendation(
  company: Pick<
    GrowthProspectSearchCompanyResult,
    | "is_suppressed"
    | "suppression_reason"
    | "decision_maker_coverage"
    | "contact_intelligence"
    | "committee_completion"
    | "lead_engine_score"
    | "lead_score"
    | "lead_engine_last_run_at"
    | "buying_stage"
    | "in_lead_inbox"
    | "growth_lead_id"
    | "lead_inbox_id"
    | "recommended_next_step_reason"
    | "growth_signal_recommended_action"
    | "existing_customer"
  >,
  sequenceBridge: GrowthProspectSequenceBridge,
): GrowthProspectPipelineRecommendation {
  if (company.is_suppressed) {
    return {
      recommended_next_action: "Review suppression",
      recommended_next_action_reason:
        company.suppression_reason?.trim() || "Company is suppressed — no outreach until operator review.",
      recommended_workflow_path: "Review suppression → Resolve blockers → Re-qualify",
    }
  }

  if (company.existing_customer) {
    return {
      recommended_next_action: "Review expansion opportunity",
      recommended_next_action_reason: "Existing customer account detected in CRM evidence.",
      recommended_workflow_path: "Review account → Expansion research → Operator outreach plan",
    }
  }

  const dmScore = dmCoverageScore(company)
  const qualificationScore = company.lead_engine_score ?? company.lead_score ?? 0
  const committeeGap =
    company.committee_completion != null && company.committee_completion.completeness_score < 45

  if (dmScore < 35 || committeeGap) {
    return {
      recommended_next_action: "Research Decision Makers",
      recommended_next_action_reason:
        dmScore < 35
          ? `Decision maker coverage ${Math.round(dmScore)}% — expand committee evidence before outreach.`
          : `Committee completeness ${company.committee_completion?.completeness_score ?? 0}% — map stakeholders.`,
      recommended_workflow_path: "Run Lead Engine → Decision maker research → Qualification review",
    }
  }

  if (!company.lead_engine_last_run_at && qualificationScore < 55) {
    return {
      recommended_next_action: "Run Lead Engine",
      recommended_next_action_reason: "No recent Lead Engine run — gather qualification evidence first.",
      recommended_workflow_path: "Run Lead Engine → Review qualification → Sequence recommendation",
    }
  }

  const stage = company.buying_stage ?? ""
  if (stage === "decision" || stage === "consideration") {
    return {
      recommended_next_action: "Open Meeting Prep",
      recommended_next_action_reason: `Buying stage ${stage.replace(/_/g, " ")} with adequate DM coverage.`,
      recommended_workflow_path: "Meeting prep → Human-reviewed outreach → Follow-up scheduling",
    }
  }

  if (sequenceBridge.recommended_sequence_label && (sequenceBridge.recommended_sequence_confidence ?? 0) >= 40) {
    return {
      recommended_next_action: "Launch Qualification Sequence",
      recommended_next_action_reason: sequenceBridge.recommended_sequence_reason ?? "Sequence recommendation available.",
      recommended_workflow_path: "Review sequence → Draft outreach → Approval queue → Execute",
    }
  }

  if (!hasLeadRecord(company) && !company.in_lead_inbox) {
    return {
      recommended_next_action: "Push To Lead Inbox",
      recommended_next_action_reason: "No lead record yet — create operator workspace continuity.",
      recommended_workflow_path: "Push to inbox → Run Lead Engine → Outreach draft",
    }
  }

  if (company.growth_signal_recommended_action) {
    return {
      recommended_next_action: "Queue Outreach Draft",
      recommended_next_action_reason: company.growth_signal_recommended_action,
      recommended_workflow_path: "Copilot draft → Human review → Approval queue",
    }
  }

  return {
    recommended_next_action: "Review Buying Stage",
    recommended_next_action_reason:
      company.recommended_next_step_reason?.trim() || "Continue operator review with existing qualification evidence.",
    recommended_workflow_path: "Review buying stage → Choose next touch → Human execute",
  }
}

export function buildProspectPipelineAutomationOverlay(
  company: GrowthProspectSearchCompanyResult,
  context?: {
    query?: string
    filters?: GrowthProspectSearchFilters
    discoveryMode?: GrowthProspectSearchDiscoveryMode
    savedSearchId?: string | null
  },
): GrowthProspectSearchCompanyResult {
  const sequence_bridge = deriveProspectSequenceBridge(company)
  const recommendation = deriveProspectPipelineRecommendation(company, sequence_bridge)
  const workflowContext = buildGrowthWorkflowContext({
    company,
    query: context?.query,
    filters: context?.filters,
    discoveryMode: context?.discoveryMode,
    recommendation,
    sequenceBridge: sequence_bridge,
    savedSearchId: context?.savedSearchId,
  })

  return {
    ...company,
    recommended_next_action: recommendation.recommended_next_action,
    recommended_next_action_reason: recommendation.recommended_next_action_reason,
    recommended_workflow_path: recommendation.recommended_workflow_path,
    recommended_sequence_label: sequence_bridge.recommended_sequence_label,
    recommended_sequence_confidence: sequence_bridge.recommended_sequence_confidence,
    recommended_sequence_reason: sequence_bridge.recommended_sequence_reason,
    recommended_first_touch: sequence_bridge.recommended_first_touch,
    pipeline_automation: {
      qa_marker: GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER,
      recommendation,
      sequence_bridge,
    },
    workflow_context_token: appendWorkflowContextToUrl("", workflowContext).replace(/^\?workflowContext=/, ""),
  }
}

export function applyProspectPipelineAutomationOverlay(
  company: GrowthProspectSearchCompanyResult,
  context?: {
    query?: string
    filters?: GrowthProspectSearchFilters
    discoveryMode?: GrowthProspectSearchDiscoveryMode
    savedSearchId?: string | null
  },
): GrowthProspectSearchCompanyResult {
  return buildProspectPipelineAutomationOverlay(company, context)
}

function buildContextForCompany(
  company: GrowthProspectSearchCompanyResult,
  query?: string,
  filters?: GrowthProspectSearchFilters,
  discoveryMode?: GrowthProspectSearchDiscoveryMode,
): GrowthWorkflowContextHandoff {
  const overlay =
    company.pipeline_automation ??
    buildProspectPipelineAutomationOverlay(company, { query, filters, discoveryMode }).pipeline_automation!
  return buildGrowthWorkflowContext({
    company,
    query,
    filters,
    discoveryMode,
    recommendation: overlay.recommendation,
    sequenceBridge: overlay.sequence_bridge,
  })
}

export function buildProspectWorkflowLauncherActions(input: {
  company: GrowthProspectSearchCompanyResult
  query?: string
  filters?: GrowthProspectSearchFilters
  discoveryMode?: GrowthProspectSearchDiscoveryMode
  savedSearchId?: string | null
}): GrowthProspectWorkflowLauncherAction[] {
  const { company } = input
  const context = buildContextForCompany(company, input.query, input.filters, input.discoveryMode)
  if (input.savedSearchId) {
    context.saved_search_id = input.savedSearchId
  }
  const preflight = runOutboundLaunchPreflight({ company })
  const launchUrls = buildOutboundLaunchUrls({ company, workflowContext: context })
  const suppressed = company.is_suppressed === true
  const hasLead = hasLeadRecord(company)
  const primaryAction = company.recommended_next_action ?? "Run Lead Engine"

  function action(
    partial: Omit<GrowthProspectWorkflowLauncherAction, "is_primary"> & { id: string },
  ): GrowthProspectWorkflowLauncherAction {
    const disabledReason =
      partial.disabled_reason ??
      (!partial.enabled ? outboundLaunchActionDisabledReason({ actionId: partial.id, preflight }) : null)
    return {
      ...partial,
      disabled_reason: disabledReason,
      is_primary: partial.label === primaryAction,
    }
  }

  const leadEngineUrl = appendWorkflowContextToUrl(
    buildProspectSearchLeadEngineHandoffUrl(company, input.query),
    context,
  )

  const meetingUrl = preflight.growth_lead_id
    ? appendWorkflowContextToUrl(
        `/admin/growth/meetings?leadId=${preflight.growth_lead_id}`,
        context,
      )
    : appendWorkflowContextToUrl(`/admin/growth/meetings?company=${encodeURIComponent(company.company_name)}`, context)

  const conversationsUrl = preflight.growth_lead_id
    ? appendWorkflowContextToUrl(`/admin/growth/conversations?leadId=${preflight.growth_lead_id}`, context)
    : null

  const executionUrl = appendWorkflowContextToUrl("/admin/growth/execution", context)
  const callCoachingUrl = preflight.growth_lead_id
    ? appendWorkflowContextToUrl(`/admin/growth/calls/live?leadId=${preflight.growth_lead_id}`, context)
    : null

  const needsLeadReason = "Push to Lead Inbox or open an existing CRM lead workspace first."
  const sequenceConfidence = company.recommended_sequence_confidence ?? 0

  return [
    action({
      id: "run_lead_engine",
      label: "Run Lead Engine",
      group: "qualification",
      enabled: !suppressed,
      disabled_reason: suppressed ? "Suppressed account." : null,
      launch_url: suppressed ? null : leadEngineUrl,
      server_action: "run_lead_engine",
      timeline_event_kind: "lead_engine_launched",
    }),
    action({
      id: "research_decision_makers",
      label: "Research Decision Makers",
      group: "qualification",
      enabled: !suppressed,
      disabled_reason: suppressed ? "Suppressed account." : null,
      launch_url: suppressed ? null : leadEngineUrl,
      server_action: "run_lead_engine",
      timeline_event_kind: "lead_engine_launched",
    }),
    action({
      id: "expand_buying_committee",
      label: "Expand Buying Committee",
      group: "qualification",
      enabled: !suppressed && (hasLead || company.contact_intelligence != null),
      disabled_reason: suppressed ? "Suppressed account." : !hasLead ? needsLeadReason : null,
      launch_url: suppressed ? null : hasLead ? conversationsUrl : leadEngineUrl,
      server_action: hasLead ? null : "run_lead_engine",
      timeline_event_kind: null,
    }),
    action({
      id: "generate_outreach_draft",
      label: "Generate Outreach Draft",
      group: "outreach",
      enabled: !suppressed && preflight.can_draft,
      disabled_reason: null,
      launch_url: launchUrls.generate_draft,
      server_action: null,
      timeline_event_kind: "outreach_workflow_started",
    }),
    action({
      id: "launch_qualification_sequence",
      label: "Start Guided Sequence",
      group: "outreach",
      enabled: !suppressed && preflight.can_sequence && sequenceConfidence >= 35,
      disabled_reason:
        sequenceConfidence < 35 ? "Insufficient sequence confidence from evidence." : null,
      launch_url: launchUrls.guided_sequence,
      server_action: null,
      timeline_event_kind: "sequence_workflow_started",
    }),
    action({
      id: "queue_outreach_draft",
      label: "Queue For Approval",
      group: "outreach",
      enabled: !suppressed && preflight.can_queue,
      disabled_reason: null,
      launch_url: launchUrls.queue_for_approval,
      server_action: null,
      timeline_event_kind: "outreach_workflow_started",
    }),
    action({
      id: "open_outreach_approval",
      label: "Open Approval Queue",
      group: "outreach",
      enabled: !suppressed && preflight.can_queue,
      disabled_reason: null,
      launch_url: launchUrls.approval_queue,
      server_action: null,
      timeline_event_kind: "outreach_workflow_started",
    }),
    action({
      id: "open_meeting_prep",
      label: "Open Meeting Prep",
      group: "meetings",
      enabled: !suppressed,
      disabled_reason: suppressed ? "Suppressed account." : null,
      launch_url: suppressed ? null : meetingUrl,
      server_action: null,
      timeline_event_kind: "meeting_workflow_started",
    }),
    action({
      id: "open_call_coaching",
      label: "Open Call Coaching",
      group: "meetings",
      enabled: !suppressed && hasLead,
      disabled_reason: suppressed ? "Suppressed account." : !hasLead ? needsLeadReason : null,
      launch_url: suppressed || !hasLead ? null : callCoachingUrl,
      server_action: null,
      timeline_event_kind: null,
    }),
    action({
      id: "open_execution_workspace",
      label: "Open Execution Workspace",
      group: "revenue_execution",
      enabled: true,
      disabled_reason: null,
      launch_url: executionUrl,
      server_action: null,
      timeline_event_kind: "prospect_workflow_started",
    }),
    action({
      id: "open_conversation_intelligence",
      label: "Open Conversation Intelligence",
      group: "relationship_expansion",
      enabled: !suppressed && hasLead,
      disabled_reason: suppressed ? "Suppressed account." : !hasLead ? needsLeadReason : null,
      launch_url: suppressed || !hasLead ? null : conversationsUrl,
      server_action: null,
      timeline_event_kind: null,
    }),
    action({
      id: "open_copilot",
      label: "Open AI Copilot",
      group: "relationship_expansion",
      enabled: !suppressed && preflight.can_draft,
      disabled_reason: null,
      launch_url: launchUrls.copilot,
      server_action: null,
      timeline_event_kind: null,
    }),
    action({
      id: "push_to_lead_inbox",
      label: "Push To Lead Inbox",
      group: "qualification",
      enabled: !suppressed && !company.in_lead_inbox,
      disabled_reason: suppressed
        ? "Suppressed account."
        : company.in_lead_inbox
          ? "Already in Lead Inbox."
          : null,
      launch_url: null,
      server_action: "push_to_lead_inbox",
      timeline_event_kind: "prospect_workflow_started",
    }),
  ]
}

export function buildSavedSearchWorkflowLaunchLinks(input?: {
  savedSearchId?: string | null
  query?: string
}): Array<{ id: string; label: string; href: string }> {
  const params = new URLSearchParams()
  if (input?.savedSearchId) params.set("savedSearchId", input.savedSearchId)
  if (input?.query?.trim()) params.set("q", input.query.trim())
  const suffix = params.toString() ? `?${params.toString()}` : ""
  return [
    { id: "launch_workflow", label: "Launch workflow", href: `/admin/growth/search${suffix}` },
    { id: "review_opportunities", label: "Review opportunities", href: `/admin/growth/opportunities/workspace${suffix}` },
    { id: "run_qualification", label: "Run qualification", href: `/admin/growth/leads/lead-engine${suffix}` },
    { id: "open_outreach_queue", label: "Open sequence approvals", href: `/admin/growth/sequences/execution${suffix}` },
    { id: "batch_outbound_preview", label: "Batch outbound preview", href: `/admin/growth/search${suffix}${suffix ? "&" : "?"}batchOutbound=1` },
    { id: "executive_review", label: "Executive review", href: `/admin/growth/executive${suffix}` },
  ]
}

export type ProspectWorkflowTimelinePayload = {
  qa_marker: typeof GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER
  event_kind: GrowthProspectWorkflowContinuityEventKind
  company_name: string
  source_type: string
  source_id: string
  recommended_next_action: string | null
  workflow_path: string | null
}

export function buildProspectWorkflowTimelinePayload(input: {
  company: GrowthProspectSearchCompanyResult
  eventKind: GrowthProspectWorkflowContinuityEventKind
}): ProspectWorkflowTimelinePayload {
  return {
    qa_marker: GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER,
    event_kind: input.eventKind,
    company_name: input.company.company_name,
    source_type: input.company.source_type,
    source_id: input.company.id,
    recommended_next_action: input.company.recommended_next_action ?? null,
    workflow_path: input.company.recommended_workflow_path ?? null,
  }
}
