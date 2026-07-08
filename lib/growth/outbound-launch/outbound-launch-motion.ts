/** Sprint 4.3 — Launch Outbound Motion. Client-safe bridge across existing Growth systems. */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  appendWorkflowContextToUrl,
  buildGrowthWorkflowContext,
  decodeGrowthWorkflowContext,
  type GrowthWorkflowContextHandoff,
} from "@/lib/growth/prospect-search/prospect-workflow-context"
import type { GrowthOutreachQueueStatus } from "@/lib/growth/outreach/outreach-queue-types"
import { buildGrowthLeadHref } from "@/lib/growth/navigation/growth-workspace-operator-links"

export const GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER = "growth-outbound-launch-motion-v1" as const

export const OUTBOUND_LAUNCH_BATCH_MAX = 25 as const

export type OutboundLaunchPreflightSeverity = "block" | "warn" | "info"

export type OutboundLaunchPreflightCheck = {
  id: string
  label: string
  severity: OutboundLaunchPreflightSeverity
  passed: boolean
  detail: string | null
}

export type OutboundLaunchPreflightSummary = {
  qa_marker: typeof GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER
  can_launch: boolean
  can_draft: boolean
  can_queue: boolean
  can_sequence: boolean
  growth_lead_id: string | null
  inbox_only: boolean
  checks: OutboundLaunchPreflightCheck[]
}

export type OutboundLaunchUrls = {
  generate_draft: string | null
  queue_for_approval: string | null
  approval_queue: string | null
  guided_sequence: string | null
  copilot: string | null
  lead_drawer: string | null
  lead_inbox_workspace: string | null
}

export type OutboundApprovalChainStep = {
  id: string
  label: string
  description: string
  status: "pending" | "current" | "complete" | "blocked"
  requires_human: boolean
}

export type OutboundLaunchProviderSurface = {
  surfaceId: string
  title: string
  status: string
  label: string
  detail?: string
}

export type OutboundLaunchReadinessSummary = {
  qa_marker: typeof GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER
  provider_surfaces: OutboundLaunchProviderSurface[]
  outbound_ready: boolean
  readiness_message: string | null
}

export type SavedSearchBatchLaunchRow = {
  company_id: string
  company_name: string
  growth_lead_id: string | null
  preflight: OutboundLaunchPreflightSummary
  recommended_action: string | null
  launch_urls: OutboundLaunchUrls
}

export type SavedSearchBatchLaunchPreview = {
  qa_marker: typeof GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER
  saved_search_id: string | null
  total_candidates: number
  eligible_count: number
  blocked_count: number
  warning_count: number
  capped: boolean
  rows: SavedSearchBatchLaunchRow[]
  approval_required: true
  auto_send: false
}

export const OUTBOUND_LAUNCH_OUTCOME_LABELS: Record<
  GrowthOutreachQueueStatus | "reply_received" | "meeting_requested" | "draft_created",
  string
> = {
  draft: "Draft created — review before queueing",
  pending_approval: "Queued for approval",
  approved: "Approved — awaiting operator execute",
  scheduled: "Scheduled for send",
  executed: "Sent / executed",
  failed: "Execution failed",
  cancelled: "Cancelled",
  reply_received: "Reply received — review in unified inbox",
  meeting_requested: "Meeting requested — open meeting workflow",
  draft_created: "Draft created — human review required",
}

export const OUTBOUND_APPROVAL_CHAIN_STEPS: Array<Omit<OutboundApprovalChainStep, "status">> = [
  {
    id: "draft",
    label: "Draft",
    description: "Generate outreach draft in AI Copilot — no auto-send.",
    requires_human: true,
  },
  {
    id: "review",
    label: "Review",
    description: "Operator reviews personalization, suppression, and governance rules.",
    requires_human: true,
  },
  {
    id: "approve",
    label: "Approve",
    description: "Human approval required before queue execution.",
    requires_human: true,
  },
  {
    id: "queue",
    label: "Queue",
    description: "Item enters outreach approval queue — still not sent.",
    requires_human: true,
  },
  {
    id: "execute",
    label: "Execute",
    description: "Operator or scheduled job sends via connected provider after final approval.",
    requires_human: true,
  },
]

export function resolveOutboundLaunchGrowthLeadId(
  company: Pick<GrowthProspectSearchCompanyResult, "growth_lead_id">,
): { growth_lead_id: string | null; inbox_only: boolean; reason: string | null } {
  if (company.growth_lead_id?.trim()) {
    return { growth_lead_id: company.growth_lead_id.trim(), inbox_only: false, reason: null }
  }
  return {
    growth_lead_id: null,
    inbox_only: false,
    reason: "No lead workspace — push to Revenue Queue first.",
  }
}

function pushCheck(
  checks: OutboundLaunchPreflightCheck[],
  check: OutboundLaunchPreflightCheck,
): void {
  checks.push(check)
}

export function runOutboundLaunchPreflight(input: {
  company: Pick<
    GrowthProspectSearchCompanyResult,
    | "is_suppressed"
    | "suppression_reason"
    | "existing_customer"
    | "existing_prospect"
    | "decision_maker_coverage"
    | "contact_intelligence"
    | "committee_completion"
    | "growth_lead_id"
    | "in_revenue_queue"
    | "buying_stage"
    | "lead_engine_score"
    | "lead_score"
  >
  contact_email?: string | null
}): OutboundLaunchPreflightSummary {
  const { company } = input
  const checks: OutboundLaunchPreflightCheck[] = []
  const lead = resolveOutboundLaunchGrowthLeadId(company)

  pushCheck(checks, {
    id: "suppression",
    label: "Suppression",
    severity: "block",
    passed: company.is_suppressed !== true,
    detail: company.is_suppressed
      ? company.suppression_reason?.trim() || "Lead or company is suppressed."
      : null,
  })

  pushCheck(checks, {
    id: "crm_lead",
    label: "CRM lead workspace",
    severity: "block",
    passed: Boolean(lead.growth_lead_id),
    detail: lead.reason,
  })

  pushCheck(checks, {
    id: "existing_customer",
    label: "Existing customer",
    severity: "warn",
    passed: company.existing_customer !== true,
    detail: company.existing_customer ? "Existing customer — use expansion motion, not cold outbound." : null,
  })

  pushCheck(checks, {
    id: "existing_prospect",
    label: "Existing prospect",
    severity: "warn",
    passed: company.existing_prospect !== true,
    detail: company.existing_prospect ? "Existing CRM prospect — review prior touches before new outreach." : null,
  })

  const dmScore =
    company.decision_maker_coverage ??
    company.contact_intelligence?.contact_confidence_score ??
    0
  pushCheck(checks, {
    id: "decision_maker",
    label: "Decision maker coverage",
    severity: "warn",
    passed: dmScore >= 35,
    detail: dmScore < 35 ? `Decision maker coverage ${Math.round(dmScore)}% — research before outreach.` : null,
  })

  const hasVerifiedContact = Boolean(
    input.contact_email?.trim() ||
      company.contact_intelligence?.first_contact?.email ||
      company.contact_intelligence?.contacts?.some((c) => c.email?.trim()),
  )
  pushCheck(checks, {
    id: "verified_contact",
    label: "Verified contact channel",
    severity: "warn",
    passed: hasVerifiedContact,
    detail: hasVerifiedContact ? null : "No verified email on evidence-backed contacts — draft may be call-first.",
  })

  const score = company.lead_engine_score ?? company.lead_score ?? 0
  pushCheck(checks, {
    id: "qualification",
    label: "Qualification evidence",
    severity: "info",
    passed: score >= 40,
    detail: score < 40 ? `Lead score ${score} — consider Lead Engine before outbound.` : null,
  })

  const blocks = checks.filter((c) => !c.passed && c.severity === "block")
  const can_launch = blocks.length === 0

  return {
    qa_marker: GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER,
    can_launch,
    can_draft: can_launch,
    can_queue: can_launch,
    can_sequence: can_launch,
    growth_lead_id: lead.growth_lead_id,
    inbox_only: lead.inbox_only,
    checks,
  }
}

export function buildOutboundLaunchUrls(input: {
  company: Pick<
    GrowthProspectSearchCompanyResult,
    "growth_lead_id" | "company_name" | "id"
  >
  workflowContext?: GrowthWorkflowContextHandoff | null
}): OutboundLaunchUrls {
  const lead = resolveOutboundLaunchGrowthLeadId(input.company)
  const withContext = (url: string | null) =>
    url && input.workflowContext ? appendWorkflowContextToUrl(url, input.workflowContext) : url

  const growthLeadId = lead.growth_lead_id

  return {
    generate_draft: growthLeadId
      ? withContext(`/admin/growth/copilot?leadId=${encodeURIComponent(growthLeadId)}&intent=generate_draft`)
      : null,
    queue_for_approval: growthLeadId
      ? withContext(`/admin/growth/sequences/execution?leadId=${encodeURIComponent(growthLeadId)}`)
      : null,
    approval_queue: growthLeadId
      ? withContext(`/admin/growth/sequences/execution?leadId=${encodeURIComponent(growthLeadId)}`)
      : null,
    guided_sequence: growthLeadId
      ? withContext(`/admin/growth/sequences/execution?leadId=${encodeURIComponent(growthLeadId)}`)
      : null,
    copilot: growthLeadId
      ? withContext(`/admin/growth/copilot?leadId=${encodeURIComponent(growthLeadId)}`)
      : null,
    lead_drawer: growthLeadId ? buildGrowthLeadHref(growthLeadId) : null,
    lead_inbox_workspace: growthLeadId ? buildGrowthLeadHref(growthLeadId) : null,
  }
}

export function buildOutboundApprovalChain(input?: {
  currentStepId?: string
  blocked?: boolean
}): OutboundApprovalChainStep[] {
  const current = input?.currentStepId ?? "draft"
  const blocked = input?.blocked === true
  const order = OUTBOUND_APPROVAL_CHAIN_STEPS.map((s) => s.id)
  const currentIndex = Math.max(0, order.indexOf(current))

  return OUTBOUND_APPROVAL_CHAIN_STEPS.map((step, index) => {
    let status: OutboundApprovalChainStep["status"] = "pending"
    if (blocked && index > currentIndex) status = "blocked"
    else if (index < currentIndex) status = "complete"
    else if (index === currentIndex) status = blocked ? "blocked" : "current"
    return { ...step, status }
  })
}

export function buildSavedSearchBatchLaunchPreview(input: {
  savedSearchId?: string | null
  companies: GrowthProspectSearchCompanyResult[]
  max?: number
}): SavedSearchBatchLaunchPreview {
  const max = input.max ?? OUTBOUND_LAUNCH_BATCH_MAX
  const qualified = input.companies.filter(
    (row) =>
      !row.is_suppressed &&
      (row.lead_engine_score ?? row.lead_score ?? 0) >= 40 &&
      (row.decision_maker_coverage ?? row.contact_intelligence?.contact_confidence_score ?? 0) >= 35,
  )
  const capped = qualified.length > max
  const slice = qualified.slice(0, max)

  const rows: SavedSearchBatchLaunchRow[] = slice.map((company) => {
    const preflight = runOutboundLaunchPreflight({ company })
    const workflowContext = buildGrowthWorkflowContext({ company, savedSearchId: input.savedSearchId ?? null })
    return {
      company_id: company.id,
      company_name: company.company_name,
      growth_lead_id: preflight.growth_lead_id,
      preflight,
      recommended_action: company.recommended_next_action ?? null,
      launch_urls: buildOutboundLaunchUrls({ company, workflowContext }),
    }
  })

  return {
    qa_marker: GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER,
    saved_search_id: input.savedSearchId ?? null,
    total_candidates: input.companies.length,
    eligible_count: rows.filter((r) => r.preflight.can_launch).length,
    blocked_count: rows.filter((r) => !r.preflight.can_launch).length,
    warning_count: rows.filter((r) =>
      r.preflight.checks.some((c) => !c.passed && c.severity === "warn"),
    ).length,
    capped,
    rows,
    approval_required: true,
    auto_send: false,
  }
}

export function parseOutboundLaunchWorkflowContext(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): GrowthWorkflowContextHandoff | null {
  return decodeGrowthWorkflowContext(searchParams.get("workflowContext"))
}

export function outboundLaunchActionDisabledReason(input: {
  actionId: string
  preflight: OutboundLaunchPreflightSummary
}): string | null {
  const { actionId, preflight } = input
  if (preflight.checks.find((c) => c.id === "suppression" && !c.passed)) {
    return preflight.checks.find((c) => c.id === "suppression")?.detail ?? "Suppressed account."
  }

  const needsCrmLead = [
    "generate_outreach_draft",
    "queue_outreach_draft",
    "queue_for_approval",
    "open_outreach_approval",
    "launch_qualification_sequence",
    "start_guided_sequence",
    "open_copilot",
  ].includes(actionId)

  if (needsCrmLead && !preflight.growth_lead_id) {
    return (
      preflight.checks.find((c) => c.id === "crm_lead")?.detail ??
      "CRM lead workspace required before outbound."
    )
  }

  if (
    actionId === "launch_qualification_sequence" ||
    actionId === "start_guided_sequence"
  ) {
    if (!preflight.can_sequence) return "Insufficient sequence confidence or blocked by preflight."
  }

  return null
}

export function assertNoAutonomousOutboundSend(): { auto_send: false; autonomous_enrollment: false } {
  return { auto_send: false, autonomous_enrollment: false }
}
