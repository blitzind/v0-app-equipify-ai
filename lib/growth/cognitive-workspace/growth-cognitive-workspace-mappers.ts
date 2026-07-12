/**
 * GE-AIOS-25A-1 — Deterministic Ava Cognitive Workspace projections.
 * Presentation-only. No LLM. No invented facts.
 */

import { GROWTH_NEXT_BEST_ACTION_LABELS } from "@/lib/growth/nba-types"
import { normalizeGrowthResearchConfidence } from "@/lib/growth/research/research-confidence"
import {
  hasUsableLeadResearch,
  isProspectResearchStale,
} from "@/lib/growth/research/growth-lead-research-readiness"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import type { NativeRevenueDecisionDisplaySummary } from "@/lib/growth/contact-verification/native-revenue-decision-adapter"
import type { CommunicationStrategyDisplaySummary } from "@/lib/growth/contact-verification/communication-strategy-types"
import type { GrowthLead } from "@/lib/growth/types"
import type {
  GrowthAvaAccountStatusLabel,
  GrowthAvaBelief,
  GrowthAvaCurrentAssessment,
  GrowthAvaEvidenceFact,
  GrowthAvaOperationalItem,
  GrowthAvaResearchJournalEntry,
} from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

export type BuildAvaCognitiveProjectionInput = {
  lead: GrowthLead
  prospectRun?: GrowthResearchRunPublicView | null
  nativeDecision?: NativeRevenueDecisionDisplaySummary | null
  nativeCommunicationStrategy?: CommunicationStrategyDisplaySummary | null
  pendingApprovalCount?: number
  hasExecutionPlan?: boolean | null
}

const PAIN_BELIEF_COPY: Record<string, string> = {
  missing_online_booking: "I have not found online booking on the public website.",
  missing_scheduling_flow: "I have not found an online scheduling flow.",
  missing_customer_portal: "I have not found a customer portal.",
  outdated_site: "I believe the public website appears outdated relative to modern service businesses.",
  weak_mobile: "I detected weak mobile presentation on the public website.",
  weak_reviews: "I found weak or limited public review presence.",
  no_financing: "I have not found financing messaging on the public website.",
  missing_chat: "I have not found a chat widget on the public website.",
  limited_service_visibility: "I found limited public visibility into their service offerings.",
  no_trust_indicators: "I found limited trust indicators on the public website.",
  weak_cta_density: "I found weak call-to-action density on the public website.",
  weak_customer_retention_indicators: "I found limited customer retention indicators on the public website.",
}

function formatRelative(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  const delta = Date.now() - ms
  const minutes = Math.round(delta / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function pickLatestIso(...values: Array<string | null | undefined>): string | null {
  let best: string | null = null
  let bestMs = -1
  for (const value of values) {
    if (!value?.trim()) continue
    const ms = Date.parse(value)
    if (Number.isNaN(ms) || ms <= bestMs) continue
    bestMs = ms
    best = value
  }
  return best
}

export function mapLeadToAvaAccountStatus(
  lead: GrowthLead,
  options?: { pendingApprovalCount?: number },
): GrowthAvaAccountStatusLabel {
  if ((options?.pendingApprovalCount ?? 0) > 0) return "Awaiting Approval"
  switch (lead.status) {
    case "converted":
      return "Customer"
    case "disqualified":
      return "Closed Lost"
    case "archived":
      return "Archived"
    case "replied":
      return "In Conversation"
    case "in_outreach":
    case "call_ready":
    case "qualified":
      return "Active Pursuit"
    case "researching":
    case "enriched":
      return "Researching"
    case "new":
      return "New"
    default:
      break
  }
  if (lead.opportunityReadinessTier === "hot" || lead.opportunityReadinessTier === "warm") {
    return "Opportunity Active"
  }
  if (lead.nextBestAction === "wait_follow_up" || lead.nextBestAction === "wait_for_email_reply") {
    return "Monitoring"
  }
  return "Monitoring"
}

function resolveRecommendation(
  lead: GrowthLead,
  nativeDecision?: NativeRevenueDecisionDisplaySummary | null,
  prospectRun?: GrowthResearchRunPublicView | null,
): string | null {
  if (nativeDecision?.action_label?.trim()) return nativeDecision.action_label.trim()
  if (lead.nextBestAction) {
    return GROWTH_NEXT_BEST_ACTION_LABELS[lead.nextBestAction] ?? lead.nextBestAction.replace(/_/g, " ")
  }
  if (prospectRun?.recommendedNextAction?.trim()) return prospectRun.recommendedNextAction.trim()
  return null
}

function resolveConclusion(
  lead: GrowthLead,
  nativeDecision?: NativeRevenueDecisionDisplaySummary | null,
  prospectRun?: GrowthResearchRunPublicView | null,
): string | null {
  if (nativeDecision?.qualification?.trim()) {
    return `Qualification conclusion: ${nativeDecision.qualification.replace(/_/g, " ")}`
  }
  if (lead.nextBestActionReason?.trim()) return lead.nextBestActionReason.trim()
  if (prospectRun?.researchSummary?.trim()) {
    const summary = prospectRun.researchSummary.trim()
    return summary.length > 180 ? `${summary.slice(0, 177)}…` : summary
  }
  return null
}

function resolveObjective(
  lead: GrowthLead,
  nativeDecision?: NativeRevenueDecisionDisplaySummary | null,
): string | null {
  const action = nativeDecision?.action ?? lead.nextBestAction
  if (!action) return null
  if (action.includes("decision_maker") || action === "find_decision_maker" || action === "secure_decision_maker") {
    return "Locate a verified decision maker"
  }
  if (action.includes("research")) return "Complete or refresh account research"
  if (action.includes("call")) return "Prepare and complete outreach by phone"
  if (action.includes("email") || action.includes("sequence") || action.includes("follow_up")) {
    return "Advance personalized outreach"
  }
  if (action.includes("wait")) return "Monitor engagement and await response"
  if (action.includes("disqualif")) return "Confirm disqualification with operator"
  if (action.includes("manual") || action.includes("review") || action.includes("escalat")) {
    return "Await operator review"
  }
  return `Advance: ${(GROWTH_NEXT_BEST_ACTION_LABELS as Record<string, string>)[action] ?? action.replace(/_/g, " ")}`
}

function resolveBlocker(
  lead: GrowthLead,
  nativeDecision?: NativeRevenueDecisionDisplaySummary | null,
): string | null {
  const fromNative = nativeDecision?.blockers?.find((item) => item.trim().length > 0)
  if (fromNative) return fromNative.trim()
  if (
    !lead.decisionMakerStatus ||
    lead.decisionMakerStatus === "none" ||
    lead.decisionMakerStatus === "suspected"
  ) {
    if (
      lead.nextBestAction === "find_decision_maker" ||
      lead.nextBestAction === "secure_decision_maker" ||
      nativeDecision?.action === "identify_decision_maker"
    ) {
      return "No verified decision maker identified"
    }
  }
  if (!hasUsableLeadResearch(lead) && (lead.status === "new" || lead.status === "researching")) {
    return "Initial research not yet complete"
  }
  if (lead.opportunityBlockers?.[0]?.label) return lead.opportunityBlockers[0].label
  return null
}

function buildBriefingParagraphs(input: BuildAvaCognitiveProjectionInput): string[] {
  const { lead, prospectRun, nativeDecision, pendingApprovalCount = 0 } = input
  const paragraphs: string[] = []
  const researched = hasUsableLeadResearch(lead) || prospectRun?.status === "completed"
  const company = lead.companyName

  if (prospectRun?.status === "failed") {
    paragraphs.push(
      `I attempted research on ${company}, but the research run failed${
        prospectRun.failedReason ? `: ${prospectRun.failedReason}` : "."
      }`,
    )
  } else if (researched) {
    paragraphs.push(`I've completed initial research on ${company}.`)
  } else if (prospectRun?.status === "queued" || prospectRun?.status === "running" || lead.status === "researching") {
    paragraphs.push(`I am still researching ${company}. My assessment is incomplete until that finishes.`)
  } else {
    paragraphs.push(`I have not completed usable research on ${company} yet.`)
  }

  if (prospectRun?.industryGuess && prospectRun.industryGuess !== "Unknown") {
    paragraphs.push(
      `Based on public website signals, I currently classify this account as ${prospectRun.industryGuess}.`,
    )
  } else if (researched) {
    paragraphs.push("I do not yet have a confident industry classification from the public website.")
  }

  const dm = lead.decisionMakerStatus
  if (dm === "confirmed" || dm === "verified_contactable") {
    paragraphs.push("I have identified a decision-maker contact on this account.")
  } else if (researched || lead.status !== "new") {
    paragraphs.push(
      "I have not identified a verified decision maker, so I am holding personalized outreach until that contact is found.",
    )
  }

  const recommendation = resolveRecommendation(lead, nativeDecision, prospectRun)
  if (recommendation) {
    paragraphs.push(`My current recommendation is: ${recommendation}.`)
  }

  if (pendingApprovalCount > 0) {
    paragraphs.push(
      pendingApprovalCount === 1
        ? "I have 1 item waiting on your approval."
        : `I have ${pendingApprovalCount} items waiting on your approval.`,
    )
  } else if (researched) {
    paragraphs.push("I do not need anything from you right now unless you want to redirect my plan.")
  }

  return paragraphs
}

export function buildAvaCurrentAssessment(
  input: BuildAvaCognitiveProjectionInput,
): GrowthAvaCurrentAssessment {
  const { lead, prospectRun, nativeDecision, pendingApprovalCount = 0 } = input
  const researchConfidence =
    prospectRun?.status === "completed"
      ? normalizeGrowthResearchConfidence(prospectRun.researchConfidence)
      : null
  const decisionConfidence =
    typeof nativeDecision?.confidence === "number" && Number.isFinite(nativeDecision.confidence)
      ? Math.round(nativeDecision.confidence <= 1 ? nativeDecision.confidence * 100 : nativeDecision.confidence)
      : null

  const confidence =
    decisionConfidence != null
      ? {
          label: `${decisionConfidence}%`,
          valuePercent: decisionConfidence,
          measures: "Decision confidence from Ava's current recommendation stack",
        }
      : researchConfidence != null
        ? {
            label: `${researchConfidence}%`,
            valuePercent: researchConfidence,
            measures: "Research confidence from completed website research",
          }
        : null

  const lastUpdatedAt = pickLatestIso(
    prospectRun?.completedAt,
    prospectRun?.createdAt,
    lead.lastProspectResearchedAt,
    lead.lastResearchedAt,
    lead.nextBestActionComputedAt,
    lead.opportunityReadinessComputedAt,
    lead.engagementComputedAt,
    lead.momentumComputedAt,
  )

  const operatorInvolvementRequired =
    pendingApprovalCount > 0 ||
    lead.nextBestAction === "manual_review" ||
    lead.nextBestAction === "escalate_owner_review" ||
    lead.nextBestAction === "immediate_owner_attention" ||
    Boolean(nativeDecision?.blockers?.length)

  return {
    accountStatus: mapLeadToAvaAccountStatus(lead, { pendingApprovalCount }),
    briefingParagraphs: buildBriefingParagraphs(input),
    conclusion: resolveConclusion(lead, nativeDecision, prospectRun),
    recommendation: resolveRecommendation(lead, nativeDecision, prospectRun),
    objective: resolveObjective(lead, nativeDecision),
    confidence,
    matchRating: lead.score != null ? `Fit score ${lead.score}` : null,
    opportunityLevel: lead.opportunityReadinessTier
      ? `${lead.opportunityReadinessTier}${
          lead.opportunityReadinessScore != null ? ` (${lead.opportunityReadinessScore})` : ""
        }`
      : null,
    blocker: resolveBlocker(lead, nativeDecision),
    operatorInvolvementRequired,
    operatorInvolvementSummary: operatorInvolvementRequired
      ? pendingApprovalCount > 0
        ? `${pendingApprovalCount} approval${pendingApprovalCount === 1 ? "" : "s"} pending`
        : "Operator review requested"
      : "Ava does not need anything from you right now",
    lastUpdatedLabel: formatRelative(lastUpdatedAt),
    lastUpdatedAt,
  }
}

export function buildAvaBeliefs(input: BuildAvaCognitiveProjectionInput): GrowthAvaBelief[] {
  const { lead, prospectRun, nativeDecision } = input
  const beliefs: GrowthAvaBelief[] = []
  const seen = new Set<string>()

  function push(id: string, text: string, sourceKey: string) {
    const normalized = text.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    beliefs.push({ id, text: text.trim(), sourceKey })
  }

  if (prospectRun?.industryGuess && prospectRun.industryGuess !== "Unknown") {
    const industry = prospectRun.industryGuess
    if (/medical|imaging|equipment|field service|hvac|electrical|plumbing/i.test(industry)) {
      push(
        "industry",
        `I believe this company operates in ${industry}.`,
        "prospect_run.industryGuess",
      )
    } else {
      push("industry", `I currently classify this company as ${industry}.`, "prospect_run.industryGuess")
    }
  }

  for (const signal of prospectRun?.signals?.painSignals ?? []) {
    const copy = PAIN_BELIEF_COPY[signal]
    if (copy) push(`pain:${signal}`, copy, `prospect_run.signals.painSignals.${signal}`)
  }

  const signals = prospectRun?.signals
  if (signals?.hasCustomerPortal === false) {
    push("portal", "I have not found a customer portal.", "prospect_run.signals.hasCustomerPortal")
  }
  if (signals?.hasOnlineBooking === false) {
    push("booking", "I have not found online booking.", "prospect_run.signals.hasOnlineBooking")
  }

  if (
    lead.decisionMakerStatus == null ||
    lead.decisionMakerStatus === "none" ||
    lead.decisionMakerStatus === "suspected"
  ) {
    if (hasUsableLeadResearch(lead) || prospectRun?.status === "completed") {
      push(
        "dm",
        "I have not identified a verified decision maker.",
        "lead.decisionMakerStatus",
      )
    }
  } else if (
    lead.decisionMakerStatus === "confirmed" ||
    lead.decisionMakerStatus === "verified_contactable"
  ) {
    push("dm", "I have identified a decision-maker contact for this account.", "lead.decisionMakerStatus")
  }

  if (!lead.engagementLastActivityAt && !lead.engagementScore) {
    if (hasUsableLeadResearch(lead) || prospectRun?.status === "completed") {
      push(
        "engagement",
        "I do not yet have enough engagement evidence to treat this as an active opportunity conversation.",
        "lead.engagement",
      )
    }
  }

  for (const reason of nativeDecision?.reasons ?? []) {
    if (!reason.trim()) continue
    push(`reason:${reason.slice(0, 40)}`, `I concluded: ${reason.trim()}`, "nativeDecision.reasons")
  }

  if (lead.opportunityAccelerators?.length) {
    for (const item of lead.opportunityAccelerators.slice(0, 3)) {
      if (!item.label?.trim()) continue
      push(`accel:${item.label}`, `I see an accelerator: ${item.label.trim()}.`, "lead.opportunityAccelerators")
    }
  }

  return beliefs
}

export function buildAvaEvidenceFacts(input: BuildAvaCognitiveProjectionInput): GrowthAvaEvidenceFact[] {
  const { lead, prospectRun } = input
  const facts: GrowthAvaEvidenceFact[] = []

  function add(
    id: string,
    label: string,
    value: string | null | undefined,
    options?: { source?: string | null; confidencePercent?: number | null },
  ) {
    const trimmed = value?.trim()
    if (!trimmed) return
    if (/^(unknown|none|n\/a|not available|—|-)$/i.test(trimmed)) return
    facts.push({
      id,
      label,
      value: trimmed,
      source: options?.source ?? null,
      confidencePercent: options?.confidencePercent ?? null,
    })
  }

  add("company", "Company", lead.companyName)
  add("website", "Website", lead.website, { source: lead.website })
  add("location", "Location", [lead.city, lead.state].filter(Boolean).join(", ") || null)
  add("industry", "Industry (research)", prospectRun?.industryGuess ?? null, {
    confidencePercent:
      prospectRun?.status === "completed"
        ? normalizeGrowthResearchConfidence(prospectRun.researchConfidence)
        : null,
  })
  add("employees", "Employee size (research)", prospectRun?.employeeSizeGuess ?? lead.estimatedEmployeeCount)
  add("revenue", "Revenue size (research)", prospectRun?.revenueSizeGuess ?? lead.estimatedAnnualRevenue)
  add("crm", "Detected CRM", lead.crmDetected)
  add("fsm", "Field service stack", lead.fieldServiceStackDetected)
  if (prospectRun?.detectedTechnologies?.length) {
    add("tech", "Detected technologies", prospectRun.detectedTechnologies.join(", "))
  }
  if (prospectRun?.websiteMaturityScore != null) {
    add("maturity", "Website maturity score", `${prospectRun.websiteMaturityScore}/100`)
  }
  if (prospectRun?.websiteUrl) {
    add("fetch_url", "Researched URL", prospectRun.websiteUrl, { source: prospectRun.websiteUrl })
  }
  if (prospectRun?.status) {
    add("research_status", "Website research status", prospectRun.status)
  }
  if (prospectRun?.researchSummary?.trim()) {
    add("summary", "Website summary", prospectRun.researchSummary.trim())
  }

  return facts
}

export function buildAvaResearchJournal(
  input: BuildAvaCognitiveProjectionInput,
): GrowthAvaResearchJournalEntry[] {
  const { lead, prospectRun, nativeDecision } = input
  const entries: GrowthAvaResearchJournalEntry[] = []

  if (prospectRun) {
    entries.push({
      id: `run-${prospectRun.id}-status`,
      at: prospectRun.completedAt ?? prospectRun.createdAt,
      title:
        prospectRun.status === "completed"
          ? "Research completed"
          : prospectRun.status === "failed"
            ? "Research failed"
            : `Research ${prospectRun.status}`,
      detail:
        prospectRun.status === "failed"
          ? prospectRun.failedReason
          : prospectRun.industryGuess && prospectRun.industryGuess !== "Unknown"
            ? `Industry conclusion: ${prospectRun.industryGuess}`
            : null,
    })

    if (prospectRun.status === "completed" && prospectRun.industryGuess && prospectRun.industryGuess !== "Unknown") {
      entries.push({
        id: `run-${prospectRun.id}-industry`,
        at: prospectRun.completedAt ?? prospectRun.createdAt,
        title: "Industry conclusion recorded",
        detail: String(prospectRun.industryGuess),
      })
    }

    const confidence = normalizeGrowthResearchConfidence(prospectRun.researchConfidence)
    if (prospectRun.status === "completed" && confidence != null) {
      entries.push({
        id: `run-${prospectRun.id}-confidence`,
        at: prospectRun.completedAt ?? prospectRun.createdAt,
        title: "Research confidence updated",
        detail: `${confidence}% (website research confidence)`,
      })
    }

    if (prospectRun.recommendedNextAction) {
      entries.push({
        id: `run-${prospectRun.id}-recommendation`,
        at: prospectRun.completedAt ?? prospectRun.createdAt,
        title: "Recommendation changed after research",
        detail: String(prospectRun.recommendedNextAction),
      })
    }

    if ((prospectRun.signals?.painSignals?.length ?? 0) > 0) {
      entries.push({
        id: `run-${prospectRun.id}-pain`,
        at: prospectRun.completedAt ?? prospectRun.createdAt,
        title: "New service or website gaps recorded",
        detail: prospectRun.signals.painSignals.map((s) => s.replace(/_/g, " ")).join(", "),
      })
    }
  }

  if (lead.decisionMakerStatus) {
    entries.push({
      id: "dm-status",
      at: lead.nextBestActionComputedAt,
      title: "Decision-maker status updated",
      detail: lead.decisionMakerStatus.replace(/_/g, " "),
    })
  }

  if (nativeDecision?.qualification) {
    entries.push({
      id: "qualification",
      at: lead.nextBestActionComputedAt,
      title: "Qualification conclusion updated",
      detail: nativeDecision.qualification.replace(/_/g, " "),
    })
  }

  if (lead.nextBestAction) {
    entries.push({
      id: "nba",
      at: lead.nextBestActionComputedAt,
      title: "Current recommendation set",
      detail: GROWTH_NEXT_BEST_ACTION_LABELS[lead.nextBestAction] ?? lead.nextBestAction,
    })
  }

  return entries.sort((a, b) => {
    const am = a.at ? Date.parse(a.at) : 0
    const bm = b.at ? Date.parse(b.at) : 0
    return bm - am
  })
}

export function buildAvaOperationalItems(lead: GrowthLead): GrowthAvaOperationalItem[] {
  const items: GrowthAvaOperationalItem[] = []

  if (lead.momentumTier || lead.momentumScore != null) {
    items.push({
      id: "momentum",
      label: "Momentum",
      value:
        lead.momentumTier != null
          ? `${lead.momentumTier}${lead.momentumScore != null ? ` (${lead.momentumScore})` : ""}`
          : String(lead.momentumScore),
      note: lead.momentumWhySummary,
    })
  }

  if (lead.engagementLastActivityAt || (lead.engagementScore != null && lead.engagementScore > 0)) {
    items.push({
      id: "engagement",
      label: "Engagement",
      value:
        lead.engagementTier != null
          ? `${lead.engagementTier}${lead.engagementScore != null ? ` (${lead.engagementScore})` : ""}`
          : String(lead.engagementScore),
      note: lead.engagementSummary,
    })
  } else {
    items.push({
      id: "engagement",
      label: "Engagement",
      value: "No engagement yet",
      note: "I have not had a conversation with this account yet.",
    })
  }

  if (lead.workflowHealth) {
    items.push({
      id: "workflow",
      label: "Workflow health",
      value: lead.workflowHealth.replace(/_/g, " "),
      note: lead.workflowHealthReason,
    })
  }

  if (lead.agingDays != null || lead.agingBucket) {
    items.push({
      id: "aging",
      label: "Account age",
      value:
        lead.agingDays != null
          ? `${lead.agingDays} days${lead.agingBucket ? ` (${lead.agingBucket})` : ""}`
          : String(lead.agingBucket),
    })
  }

  if (lead.firstHumanTouchAt || lead.timeToFirstTouchHours != null) {
    items.push({
      id: "first_touch",
      label: "First touch",
      value: lead.firstHumanTouchAt
        ? formatRelative(lead.firstHumanTouchAt) ?? lead.firstHumanTouchAt
        : lead.timeToFirstTouchHours != null
          ? `${lead.timeToFirstTouchHours}h to first touch`
          : "Not recorded",
    })
  } else {
    items.push({
      id: "first_touch",
      label: "First touch",
      value: "No human touch recorded yet",
    })
  }

  const researched = hasUsableLeadResearch(lead)
  const stale = isProspectResearchStale(lead.lastProspectResearchedAt)
  items.push({
    id: "research_freshness",
    label: "Research freshness",
    value: !researched ? "Not researched" : stale ? "Stale" : "Fresh",
    note: lead.lastProspectResearchedAt
      ? `Last researched ${formatRelative(lead.lastProspectResearchedAt)}`
      : lead.lastResearchedAt
        ? `Last researched ${formatRelative(lead.lastResearchedAt)}`
        : null,
  })

  if (lead.relationshipLastMeaningfulTouchAt || (lead.relationshipStrengthScore != null && lead.relationshipStrengthScore > 0)) {
    items.push({
      id: "relationship",
      label: "Relationship",
      value:
        lead.relationshipStrengthTier != null
          ? `${lead.relationshipStrengthTier}${
              lead.relationshipStrengthScore != null ? ` (${lead.relationshipStrengthScore})` : ""
            }`
          : String(lead.relationshipStrengthScore),
      note: lead.relationshipSummary,
    })
  } else {
    items.push({
      id: "relationship",
      label: "Relationship",
      value: "No relationship history yet",
    })
  }

  return items
}

export function buildAvaCognitiveWorkspaceCertFixture(): {
  assessment: GrowthAvaCurrentAssessment
  beliefs: GrowthAvaBelief[]
  evidence: GrowthAvaEvidenceFact[]
} {
  const lead = {
    id: "cert-lead",
    companyName: "Block Imaging",
    status: "enriched",
    decisionMakerStatus: "none",
    nextBestAction: "find_decision_maker",
    nextBestActionReason: "Need verified operations contact before outreach",
    score: 72,
    website: "https://example.com",
    city: "Holt",
    state: "MI",
    lastProspectResearchedAt: new Date().toISOString(),
    latestProspectResearchRunId: "run-1",
    lastResearchedAt: null,
    latestResearchRunId: null,
    opportunityBlockers: [],
    opportunityAccelerators: [],
  } as unknown as GrowthLead

  const prospectRun = {
    id: "run-1",
    leadId: "cert-lead",
    status: "completed",
    websiteUrl: "https://example.com",
    companyName: "Block Imaging",
    industryGuess: "Medical Equipment",
    employeeSizeGuess: "51-200",
    revenueSizeGuess: null,
    websiteMaturityScore: 61,
    socialPresenceScore: null,
    reputationScore: null,
    technologyScore: 40,
    detectedTechnologies: ["WordPress"],
    signals: {
      painSignals: ["missing_customer_portal", "missing_online_booking"],
      hasCustomerPortal: false,
      hasOnlineBooking: false,
    },
    competitors: [],
    researchSummary: "Medical imaging equipment service company with limited digital self-service.",
    suggestedPitchAngle: null,
    suggestedSequence: null,
    suggestedCallOpening: null,
    recommendedNextAction: "Manual Review",
    researchConfidence: 0.78,
    completedAt: new Date().toISOString(),
    failedReason: null,
    createdAt: new Date().toISOString(),
  } as GrowthResearchRunPublicView

  const input = { lead, prospectRun, pendingApprovalCount: 0 }
  return {
    assessment: buildAvaCurrentAssessment(input),
    beliefs: buildAvaBeliefs(input),
    evidence: buildAvaEvidenceFacts(input),
  }
}
