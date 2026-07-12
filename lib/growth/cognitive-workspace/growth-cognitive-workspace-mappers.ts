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
import { buildProspectKnowledgePack } from "@/lib/growth/research/company-evidence/prospect-knowledge-pack"
import type {
  GrowthAvaAccountStatusLabel,
  GrowthAvaBelief,
  GrowthAvaCurrentAssessment,
  GrowthAvaEvidenceFact,
  GrowthAvaOperationalItem,
  GrowthAvaProgressStep,
  GrowthAvaResearchJournalEntry,
  GrowthAvaVisitSnapshot,
  GrowthAvaWhatsChanged,
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
  const dmReady =
    lead.decisionMakerStatus === "confirmed" || lead.decisionMakerStatus === "verified_contactable"
  const dmMissing = !dmReady

  if (prospectRun?.status === "failed") {
    paragraphs.push(
      `I tried to research ${company}, but that run failed${
        prospectRun.failedReason ? `: ${prospectRun.failedReason}` : "."
      }`,
    )
  } else if (researched && dmMissing) {
    paragraphs.push(
      `I researched ${company} and still haven't verified a decision maker.`,
    )
  } else if (researched && dmReady) {
    paragraphs.push(`I researched ${company} and have a decision-maker contact on file.`)
  } else if (prospectRun?.status === "queued" || prospectRun?.status === "running" || lead.status === "researching") {
    paragraphs.push(`I'm still researching ${company}. I'll update this once that finishes.`)
  } else {
    paragraphs.push(`I haven't finished usable research on ${company} yet.`)
  }

  if (prospectRun?.industryGuess && prospectRun.industryGuess !== "Unknown") {
    paragraphs.push(`Public website signals point to ${prospectRun.industryGuess}.`)
  }

  if (researched && dmMissing) {
    paragraphs.push("I'm holding personalized outreach until that contact is found.")
  }

  const recommendation = resolveRecommendation(lead, nativeDecision, prospectRun)
  if (recommendation) {
    paragraphs.push(`Next up: ${recommendation}.`)
  }

  if (pendingApprovalCount > 0) {
    paragraphs.push(
      pendingApprovalCount === 1
        ? "I have one item waiting on your approval."
        : `I have ${pendingApprovalCount} items waiting on your approval.`,
    )
  } else if (researched || prospectRun?.status === "queued" || prospectRun?.status === "running") {
    paragraphs.push(
      "I'm continuing on this account. I'll let you know if I need approval or additional direction.",
    )
  }

  return paragraphs
}

/** GE-AIOS-25B — compact executive bullets (same facts, less height). */
export function buildAvaAssessmentSummaryBullets(input: BuildAvaCognitiveProjectionInput): string[] {
  const { lead, prospectRun, nativeDecision, pendingApprovalCount = 0 } = input
  const bullets: string[] = []
  const researched = hasUsableLeadResearch(lead) || prospectRun?.status === "completed"
  const dmReady =
    lead.decisionMakerStatus === "confirmed" || lead.decisionMakerStatus === "verified_contactable"
  const researching =
    prospectRun?.status === "queued" || prospectRun?.status === "running" || lead.status === "researching"

  if (prospectRun?.status === "failed") {
    bullets.push("Research run failed")
  } else if (researched) {
    bullets.push("Researched company")
  } else if (researching) {
    bullets.push("Research in progress")
  } else {
    bullets.push("Research incomplete")
  }

  if (dmReady) {
    bullets.push("Decision maker verified")
  } else if (researched || researching) {
    bullets.push("Decision maker not verified")
  }

  if (researched && !dmReady) {
    bullets.push("Outreach paused")
  } else if (lead.status === "in_outreach" || lead.status === "replied" || lead.status === "call_ready") {
    bullets.push("Outreach active")
  } else if (lead.status === "converted") {
    bullets.push("Converted to customer")
  }

  if (pendingApprovalCount > 0) {
    bullets.push(
      pendingApprovalCount === 1 ? "1 approval waiting" : `${pendingApprovalCount} approvals waiting`,
    )
  }

  const blocker = resolveBlocker(lead, nativeDecision)
  if (blocker && !bullets.some((b) => b.toLowerCase().includes("decision maker"))) {
    bullets.push(blocker.length > 48 ? `${blocker.slice(0, 45)}…` : blocker)
  }

  return bullets.slice(0, 5)
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
    summaryBullets: buildAvaAssessmentSummaryBullets(input),
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
      : "I'm continuing. I'll ask if I need approval or direction.",
    lastUpdatedLabel: formatRelative(lastUpdatedAt),
    lastUpdatedAt,
  }
}

function isDecisionMakerReady(lead: GrowthLead): boolean {
  return (
    lead.decisionMakerStatus === "confirmed" || lead.decisionMakerStatus === "verified_contactable"
  )
}

function hasEmailContact(lead: GrowthLead): boolean {
  return Boolean(lead.contactEmail?.includes("@"))
}

function hasPersonalizationSignal(lead: GrowthLead): boolean {
  const action = lead.nextBestAction ?? ""
  return (
    action === "start_recommended_sequence" ||
    action === "switch_sequence_pattern" ||
    action === "use_executive_sequence" ||
    Boolean(lead.prospectRecommendedNextAction?.toLowerCase().includes("personal"))
  )
}

function hasOutreachSignal(lead: GrowthLead): boolean {
  return (
    lead.status === "in_outreach" ||
    lead.status === "replied" ||
    lead.status === "call_ready" ||
    lead.callAttemptCount > 0 ||
    Boolean(lead.lastHumanTouchAt)
  )
}

function hasMeetingSignal(lead: GrowthLead): boolean {
  const action = lead.nextBestAction ?? ""
  return (
    lead.status === "converted" ||
    action === "accelerate_close_motion" ||
    action === "owner_close_motion" ||
    action === "executive_close_motion" ||
    Boolean(lead.promotedAt)
  )
}

/** GE-AIOS-25B — execution progress checklist (deterministic). */
export function buildAvaExecutionProgressTimeline(
  input: BuildAvaCognitiveProjectionInput,
): GrowthAvaProgressStep[] {
  const { lead, prospectRun } = input
  const researched = hasUsableLeadResearch(lead) || prospectRun?.status === "completed"
  const websiteOk = Boolean(lead.website?.trim() || prospectRun?.websiteUrl?.trim()) && researched
  const scored =
    lead.score != null ||
    lead.opportunityReadinessTier != null ||
    lead.opportunityReadinessScore != null
  const dmReady = isDecisionMakerReady(lead)
  const emailOk =
    lead.decisionMakerStatus === "verified_contactable" || (dmReady && hasEmailContact(lead))
  const personalized = hasPersonalizationSignal(lead) || hasOutreachSignal(lead)
  const outreach = hasOutreachSignal(lead)
  const meeting = hasMeetingSignal(lead)

  const flags = [
    { id: "researched", label: "Company researched", done: researched },
    { id: "website", label: "Website verified", done: websiteOk },
    { id: "scored", label: "Opportunity scored", done: scored },
    { id: "decision_maker", label: "Decision maker", done: dmReady },
    { id: "email", label: "Email verified", done: emailOk },
    { id: "personalization", label: "Personalization", done: personalized },
    { id: "outreach", label: "Outreach", done: outreach },
    { id: "meeting", label: "Meeting booked", done: meeting },
  ]

  let currentAssigned = false
  return flags.map((step) => {
    if (step.done) return { id: step.id, label: step.label, status: "done" as const }
    if (!currentAssigned) {
      currentAssigned = true
      return { id: step.id, label: step.label, status: "current" as const }
    }
    return { id: step.id, label: step.label, status: "upcoming" as const }
  })
}

export function captureAvaVisitSnapshot(input: BuildAvaCognitiveProjectionInput): GrowthAvaVisitSnapshot {
  const assessment = buildAvaCurrentAssessment(input)
  const evidence = buildAvaEvidenceFacts(input)
  const { lead, prospectRun } = input
  return {
    confidencePercent: assessment.confidence?.valuePercent ?? null,
    decisionMakerStatus: lead.decisionMakerStatus,
    employeeSizeGuess: prospectRun?.employeeSizeGuess ?? lead.estimatedEmployeeCount,
    researched: hasUsableLeadResearch(lead) || prospectRun?.status === "completed",
    recommendation: assessment.recommendation,
    blocker: assessment.blocker,
    evidenceCount: evidence.length,
    website: lead.website ?? prospectRun?.websiteUrl ?? null,
    accountStatus: assessment.accountStatus,
    visitedAt: new Date().toISOString(),
  }
}

export function buildAvaWhatsChanged(options: {
  current: GrowthAvaVisitSnapshot
  previous: GrowthAvaVisitSnapshot | null
  followUpAt?: string | null
  lastProspectResearchedAt?: string | null
}): GrowthAvaWhatsChanged {
  const { current, previous, followUpAt, lastProspectResearchedAt } = options
  const bullets: string[] = []

  if (!previous) {
    bullets.push(
      current.researched ? "Opening briefing for this account" : "No prior visit snapshot — establishing baseline",
    )
    if (current.blocker) bullets.push(current.blocker)
    if (current.recommendation) bullets.push(`Current focus: ${current.recommendation}`)
  } else {
    if (
      current.employeeSizeGuess &&
      previous.employeeSizeGuess &&
      current.employeeSizeGuess !== previous.employeeSizeGuess &&
      !/unknown/i.test(current.employeeSizeGuess)
    ) {
      bullets.push(`Employee size updated ${previous.employeeSizeGuess} → ${current.employeeSizeGuess}`)
    } else if (
      current.employeeSizeGuess &&
      !previous.employeeSizeGuess &&
      !/unknown/i.test(current.employeeSizeGuess)
    ) {
      bullets.push(`Found employee size signal: ${current.employeeSizeGuess}`)
    }

    if (
      current.confidencePercent != null &&
      previous.confidencePercent != null &&
      current.confidencePercent !== previous.confidencePercent
    ) {
      bullets.push(`Confidence ${previous.confidencePercent} → ${current.confidencePercent}`)
    } else if (current.confidencePercent != null && previous.confidencePercent == null) {
      bullets.push(`Confidence established at ${current.confidencePercent}`)
    }

    const dmPrev = previous.decisionMakerStatus ?? "none"
    const dmNow = current.decisionMakerStatus ?? "none"
    if (dmPrev !== dmNow) {
      bullets.push(`Decision maker status ${dmPrev.replace(/_/g, " ")} → ${dmNow.replace(/_/g, " ")}`)
    } else if (dmNow === "none" || dmNow === "suspected" || !current.decisionMakerStatus) {
      if (current.researched) bullets.push("Decision maker still missing")
    }

    if (current.evidenceCount > previous.evidenceCount) {
      const delta = current.evidenceCount - previous.evidenceCount
      bullets.push(
        delta === 1 ? "New evidence collected" : `${delta} new evidence facts collected`,
      )
    } else if (current.website && current.website !== previous.website) {
      bullets.push("New evidence collected from website")
    } else if (current.researched && !previous.researched) {
      bullets.push("Company research completed since last visit")
    }

    if (
      current.recommendation &&
      previous.recommendation &&
      current.recommendation !== previous.recommendation
    ) {
      bullets.push(`Recommendation updated: ${current.recommendation}`)
    }

    if (current.blocker && current.blocker !== previous.blocker) {
      bullets.push(`Blocked by: ${current.blocker}`)
    }

    if (current.accountStatus !== previous.accountStatus) {
      bullets.push(`Account status ${previous.accountStatus} → ${current.accountStatus}`)
    }
  }

  let nextResearchLabel: string | null = null
  const scheduleIso = followUpAt?.trim() || null
  if (scheduleIso) {
    const ms = Date.parse(scheduleIso)
    if (!Number.isNaN(ms)) {
      const minutes = Math.round((ms - Date.now()) / 60000)
      if (minutes > 0 && minutes < 60 * 48) {
        nextResearchLabel =
          minutes < 60
            ? `Next follow-up in ${minutes} minute${minutes === 1 ? "" : "s"}`
            : `Next follow-up in ${Math.round(minutes / 60)} hour${Math.round(minutes / 60) === 1 ? "" : "s"}`
        bullets.push(nextResearchLabel)
      }
    }
  } else if (lastProspectResearchedAt && isProspectResearchStale(lastProspectResearchedAt)) {
    nextResearchLabel = "Research is stale — refresh recommended"
    bullets.push(nextResearchLabel)
  }

  if (bullets.length === 0) {
    bullets.push("No material changes since last visit")
  }

  return {
    bullets: bullets.slice(0, 6),
    isFirstVisit: !previous,
    nextResearchLabel,
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

  const pack =
    prospectRun?.signals?.prospectKnowledgePack_v25c ??
    (prospectRun?.signals?.companyEvidence_v22
      ? buildProspectKnowledgePack({
          bundle: prospectRun.signals.companyEvidence_v22,
          signals: prospectRun.signals,
        })
      : null)
  for (const inference of pack?.derived_inferences.slice(0, 4) ?? []) {
    if (typeof inference.value === "boolean" && inference.value) {
      push(
        `kp-inf:${inference.field}`,
        `I believe ${inference.evidenceExcerpt ?? inference.field.replace(/_/g, " ")}.`,
        `prospectKnowledgePack.${inference.field}`,
      )
    }
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

  const evidenceBundle = prospectRun?.signals?.companyEvidence_v22
  const knowledgePack =
    prospectRun?.signals?.prospectKnowledgePack_v25c ??
    (evidenceBundle
      ? buildProspectKnowledgePack({ bundle: evidenceBundle, signals: prospectRun?.signals })
      : null)

  if (evidenceBundle?.profile.primaryServices?.values.length) {
    add(
      "v22_services",
      "Services (evidence)",
      evidenceBundle.profile.primaryServices.values.slice(0, 6).join(", "),
      {
        source: evidenceBundle.profile.primaryServices.sourceUrls[0] ?? null,
        confidencePercent: Math.round(evidenceBundle.profile.primaryServices.confidence * 100),
      },
    )
  }
  if (evidenceBundle?.profile.industriesServed?.values.length) {
    add(
      "v22_industries",
      "Industries (evidence)",
      evidenceBundle.profile.industriesServed.values.slice(0, 6).join(", "),
      {
        source: evidenceBundle.profile.industriesServed.sourceUrls[0] ?? null,
        confidencePercent: Math.round(evidenceBundle.profile.industriesServed.confidence * 100),
      },
    )
  }
  if (knowledgePack) {
    for (const fact of knowledgePack.observed_facts.slice(0, 8)) {
      if (facts.some((f) => f.id === `kp:${fact.field}`)) continue
      const value =
        typeof fact.value === "boolean"
          ? fact.value
            ? "Yes"
            : "No"
          : Array.isArray(fact.value)
            ? fact.value.slice(0, 4).join(", ")
            : fact.value
      add(`kp:${fact.field}`, fact.field.replace(/_/g, " "), value, {
        source: fact.sourceUrls[0] ?? null,
        confidencePercent: fact.confidence != null ? Math.round(fact.confidence * 100) : null,
      })
    }
  }

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
