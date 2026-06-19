/** Deterministic meeting prep assembly (Sprint 3.1). Client-safe. */

import type { GrowthLeadDecisionMaker } from "@/lib/growth/decision-maker-types"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import {
  GROWTH_MEETING_PREP_QA_MARKER,
  type GrowthMeetingPrepBundle,
  type MeetingPrepAccountPlaybookContext,
  type MeetingPrepBuyingStage,
  type MeetingPrepCompanySnapshot,
  type MeetingPrepDecisionMaker,
  type MeetingPrepLeadScore,
  type MeetingPrepObjective,
  type MeetingPrepOpenRisk,
  type MeetingPrepReadiness,
  type MeetingPrepResearchSummary,
  type MeetingPrepRiskPriority,
  type MeetingPrepTerritoryContext,
} from "@/lib/growth/meeting-intelligence/meeting-prep-types"
import type { GrowthVideoMeetingPrepContext } from "@/lib/growth/sequences/growth-sequence-video-intelligence-types"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import type { GrowthLead } from "@/lib/growth/types"

function riskPriorityWeight(priority: MeetingPrepRiskPriority): number {
  switch (priority) {
    case "Critical":
      return 4
    case "High":
      return 3
    case "Medium":
      return 2
    default:
      return 1
  }
}

export function rankMeetingPrepRisks(risks: MeetingPrepOpenRisk[]): MeetingPrepOpenRisk[] {
  return [...risks].sort((a, b) => {
    const diff = riskPriorityWeight(b.priority) - riskPriorityWeight(a.priority)
    if (diff !== 0) return diff
    return a.label.localeCompare(b.label)
  })
}

function formatLocation(lead: GrowthLead): string | null {
  const parts = [lead.city, lead.state, lead.postalCode, lead.country].filter(Boolean)
  return parts.length ? parts.join(", ") : null
}

export function buildMeetingPrepCompanySnapshot(
  lead: GrowthLead,
  research: GrowthResearchRunPublicView | null,
): MeetingPrepCompanySnapshot {
  return {
    companyName: lead.companyName,
    website: lead.website,
    industry: research?.industryGuess ?? null,
    location: formatLocation(lead),
    employees: lead.estimatedEmployeeCount ?? null,
    revenue: lead.estimatedAnnualRevenue ?? null,
  }
}

export function buildMeetingPrepTerritoryContext(lead: GrowthLead): MeetingPrepTerritoryContext {
  const reasons: string[] = []
  if (lead.state) reasons.push(`State: ${lead.state}`)
  if (lead.city) reasons.push(`City: ${lead.city}`)
  if (lead.postalCode) reasons.push(`Postal: ${lead.postalCode}`)
  if (lead.country) reasons.push(`Country: ${lead.country}`)
  const label = formatLocation(lead)
  return { label, reasons }
}

export function mapDecisionMakersForPrep(
  decisionMakers: GrowthLeadDecisionMaker[],
): MeetingPrepDecisionMaker[] {
  return decisionMakers
    .filter((dm) => dm.status !== "rejected")
    .slice(0, 8)
    .map((dm) => ({
      id: dm.id,
      name: dm.fullName,
      title: dm.title,
      confidence: dm.confidence,
      status: dm.status,
      isPrimary: dm.isPrimary,
    }))
}

export function buildMeetingPrepSignals(
  lead: GrowthLead,
  research: GrowthResearchRunPublicView | null,
  memory?: {
    summary: string | null
    priorInteractions: string[]
    commitments: string[]
    preferences?: string[]
  },
): string[] {
  const signals: string[] = []
  if (memory?.summary) signals.push(memory.summary)
  signals.push(...(memory?.priorInteractions ?? []), ...(memory?.commitments ?? []))
  signals.push(...(memory?.preferences ?? []))
  if (lead.momentumWhySummary) signals.push(lead.momentumWhySummary)
  if (lead.executiveRecommendation) signals.push(lead.executiveRecommendation)
  if (lead.nextBestActionReason) signals.push(lead.nextBestActionReason)
  if (lead.crmDetected) signals.push(`CRM detected: ${lead.crmDetected}`)
  if (lead.fieldServiceStackDetected) signals.push(`Field service stack: ${lead.fieldServiceStackDetected}`)
  if (research?.detectedTechnologies?.length) {
    signals.push(`Technologies: ${research.detectedTechnologies.slice(0, 3).join(", ")}`)
  }
  return [...new Set(signals.map((item) => item.trim()).filter(Boolean))].slice(0, 6)
}

function appendVideoEngagementSignals(
  signals: string[],
  videoEngagementContext?: GrowthVideoMeetingPrepContext | null,
): string[] {
  if (!videoEngagementContext?.prospectWatched) return signals
  const next = [...signals]
  next.push(
    `Prospect watched: ${videoEngagementContext.prospectWatched} (${Math.round(videoEngagementContext.completionPercent)}% completion, ${videoEngagementContext.viewCount} views)`,
  )
  next.push(
    `Video CTA: ${videoEngagementContext.ctaClicked ? "clicked" : "not clicked"} · Calendar: ${videoEngagementContext.calendarClicked ? "clicked" : "not clicked"}`,
  )
  return [...new Set(next.map((item) => item.trim()).filter(Boolean))].slice(0, 8)
}

export function buildMeetingPrepOpenRisks(input: {
  lead: GrowthLead
  buyingStage: MeetingPrepBuyingStage
  leadScore: MeetingPrepLeadScore
  decisionMakers: MeetingPrepDecisionMaker[]
  contactIntelligence: GrowthProspectSearchContactIntelligence | null
  research: GrowthResearchRunPublicView | null
  memoryObjections?: string[]
  memoryRiskFlags?: string[]
  accountPlaybookContext?: MeetingPrepAccountPlaybookContext | null
}): MeetingPrepOpenRisk[] {
  const risks: MeetingPrepOpenRisk[] = []
  const { lead } = input

  for (const objection of input.memoryObjections ?? []) {
    risks.push({
      id: `memory-objection-${objection.slice(0, 24)}`,
      label: "Memory objection",
      priority: "High",
      reason: objection,
      source: "relationship_memory",
    })
  }
  for (const flag of input.memoryRiskFlags ?? []) {
    risks.push({
      id: `memory-risk-${flag.slice(0, 24)}`,
      label: "Memory risk",
      priority: "Medium",
      reason: flag,
      source: "relationship_memory",
    })
  }

  if ((lead.conversationCompetitorPressure ?? 0) >= 30 || lead.conversationCompetitorMentions.length > 0) {
    risks.push({
      id: "competitor_risk",
      label: "Competitor risk",
      priority: (lead.conversationCompetitorPressure ?? 0) >= 60 ? "Critical" : "High",
      reason:
        lead.conversationCompetitorMentions[0]?.name ??
        `Competitor pressure at ${lead.conversationCompetitorPressure}%`,
      source: "conversation_intelligence",
    })
  }

  if (
    lead.decisionMakerStatus !== "confirmed" &&
    lead.decisionMakerStatus !== "verified_contactable"
  ) {
    risks.push({
      id: "low_authority_contact",
      label: "Low authority contact",
      priority: "High",
      reason: `Decision maker status: ${lead.decisionMakerStatus.replace(/_/g, " ")}`,
      source: "lead_qualification",
    })
  }

  const committeePct = input.contactIntelligence?.committee_completeness_pct ?? null
  if (committeePct != null && committeePct < 50) {
    risks.push({
      id: "missing_buying_committee",
      label: "Missing buying committee coverage",
      priority: committeePct < 25 ? "Critical" : "High",
      reason: `Committee completeness ${committeePct}%`,
      source: "contact_intelligence",
    })
  } else if (input.decisionMakers.length <= 1) {
    risks.push({
      id: "single_thread",
      label: "Single-thread meeting risk",
      priority: "Medium",
      reason: "Only one evidence-backed decision maker indexed.",
      source: "decision_makers",
    })
  }

  const effectiveScore = input.leadScore.score
  if (effectiveScore != null && effectiveScore < 50) {
    risks.push({
      id: "weak_qualification",
      label: "Weak qualification",
      priority: effectiveScore < 35 ? "High" : "Medium",
      reason: input.leadScore.explanation ?? `Lead score ${effectiveScore}`,
      source: input.leadScore.source ?? "lead_score",
    })
  }

  if (!input.buyingStage.stage) {
    risks.push({
      id: "missing_buying_stage",
      label: "Buying stage unknown",
      priority: "Medium",
      reason: "No assessed buying stage on record.",
      source: "buying_stage",
    })
  } else if ((input.buyingStage.confidence ?? 0) < 0.5) {
    risks.push({
      id: "low_stage_confidence",
      label: "Low buying stage confidence",
      priority: "Medium",
      reason: input.buyingStage.reason ?? `Stage ${input.buyingStage.stage} with limited evidence`,
      source: "buying_stage",
    })
  }

  const stage = (input.buyingStage.stage ?? "").toLowerCase()
  if (stage && !stage.includes("timeline") && !stage.includes("purchase")) {
    risks.push({
      id: "missing_timeline",
      label: "Timeline not validated",
      priority: "Medium",
      reason: "Buying stage does not indicate timeline confidence yet.",
      source: "buying_stage",
    })
  }

  if ((lead.intelligenceConflictSeverityScore ?? 0) >= 40) {
    risks.push({
      id: "intelligence_conflicts",
      label: "Intelligence conflicts",
      priority: (lead.intelligenceConflictSeverityScore ?? 0) >= 60 ? "Critical" : "High",
      reason: "Conflicting intelligence caches detected on lead.",
      source: "lead_intelligence",
    })
  }

  if (lead.opportunityBlockers.some((blocker) => blocker.key === "suppressed")) {
    risks.push({
      id: "suppressed",
      label: "Suppressed lead",
      priority: "Critical",
      reason: "Lead is suppressed — confirm outreach policy before meeting.",
      source: "opportunity_blockers",
    })
  }

  if (!input.research?.researchSummary) {
    risks.push({
      id: "sparse_research",
      label: "Limited research evidence",
      priority: "Low",
      reason: "No completed research summary on file.",
      source: "research_runs",
    })
  }

  if (input.accountPlaybookContext?.committeeCoverageRisks.length) {
    risks.push(...input.accountPlaybookContext.committeeCoverageRisks)
  }

  return rankMeetingPrepRisks(risks)
}

export function buildMeetingPrepObjectives(input: {
  lead: GrowthLead
  buyingStage: MeetingPrepBuyingStage
  leadScore: MeetingPrepLeadScore
  contactIntelligence: GrowthProspectSearchContactIntelligence | null
  research: GrowthResearchRunPublicView | null
  openRisks: MeetingPrepOpenRisk[]
  accountPlaybookContext?: MeetingPrepAccountPlaybookContext | null
}): MeetingPrepObjective[] {
  const objectives: MeetingPrepObjective[] = []
  const stage = (input.buyingStage.stage ?? "").toLowerCase()

  if (stage.includes("purchase") || stage.includes("active")) {
    objectives.push({
      objective: "Lock next meeting step",
      reasons: ["Buying stage indicates active evaluation"],
      evidence: [input.buyingStage.reason ?? input.buyingStage.stage ?? "Assessed buying stage"].filter(
        Boolean,
      ) as string[],
      priority: 95,
    })
  }

  if (stage.includes("consideration") || stage.includes("evaluation")) {
    objectives.push({
      objective: "Confirm timeline",
      reasons: ["Stage requires timeline validation"],
      evidence: [input.buyingStage.reason ?? "Buying stage assessed"].filter(Boolean) as string[],
      priority: 90,
    })
  }

  if (
    input.openRisks.some((risk) => risk.id === "competitor_risk") ||
    (input.lead.conversationCompetitorPressure ?? 0) >= 30
  ) {
    objectives.push({
      objective: "Identify incumbent vendor",
      reasons: ["Competitor pressure detected"],
      evidence: input.lead.conversationCompetitorMentions.map((item) => item.name).slice(0, 2),
      priority: 88,
    })
  }

  if (input.openRisks.some((risk) => risk.id === "missing_buying_committee" || risk.id === "single_thread")) {
    objectives.push({
      objective: "Expand buying committee",
      reasons: ["Committee coverage is incomplete"],
      evidence: input.contactIntelligence?.committee_roles.slice(0, 2).map((role) => role.role) ?? [],
      priority: 86,
    })
  }

  if (input.openRisks.some((risk) => risk.id === "low_authority_contact")) {
    objectives.push({
      objective: "Validate budget ownership",
      reasons: ["Primary contact may lack authority"],
      evidence: [`Decision maker status: ${input.lead.decisionMakerStatus}`],
      priority: 92,
    })
  }

  const painSignals = input.research?.signals?.painSignals ?? []
  if (painSignals.length > 0) {
    objectives.push({
      objective: "Validate operational pain",
      reasons: ["Research identified pain signals"],
      evidence: painSignals.slice(0, 3).map((signal) => signal.replace(/_/g, " ")),
      priority: 80,
    })
  }

  if ((input.leadScore.score ?? 0) < 60) {
    objectives.push({
      objective: "Strengthen qualification",
      reasons: ["Lead score below strong threshold"],
      evidence: [input.leadScore.explanation ?? `Score ${input.leadScore.score ?? "—"}`].filter(Boolean) as string[],
      priority: 75,
    })
  }

  if (input.contactIntelligence?.first_contact) {
    objectives.push({
      objective: `Align with ${input.contactIntelligence.first_contact.role}`,
      reasons: ["Evidence-backed first contact recommendation"],
      evidence: input.contactIntelligence.first_contact.reasons,
      priority: 78,
    })
  }

  if (input.accountPlaybookContext?.accountLevelObjective) {
    objectives.unshift(input.accountPlaybookContext.accountLevelObjective)
  }

  return objectives
    .sort((a, b) => b.priority - a.priority)
    .filter(
      (objective, index, list) =>
        list.findIndex((item) => item.objective.toLowerCase() === objective.objective.toLowerCase()) === index,
    )
    .slice(0, 5)
}

export function computeMeetingPrepReadiness(input: {
  lead: GrowthLead
  leadScore: MeetingPrepLeadScore
  buyingStage: MeetingPrepBuyingStage
  decisionMakers: MeetingPrepDecisionMaker[]
  contactIntelligence: GrowthProspectSearchContactIntelligence | null
  research: GrowthResearchRunPublicView | null
  openRisks: MeetingPrepOpenRisk[]
}): MeetingPrepReadiness {
  let score = 0
  const missing: string[] = []

  if (input.research?.researchSummary) score += 20
  else missing.push("Research summary")

  if (
    input.lead.decisionMakerStatus === "confirmed" ||
    input.lead.decisionMakerStatus === "verified_contactable" ||
    input.decisionMakers.some((dm) => dm.status === "confirmed")
  ) {
    score += 20
  } else missing.push("Confirmed decision maker")

  if (input.buyingStage.stage && (input.buyingStage.confidence ?? 0) >= 0.5) score += 15
  else missing.push("Buying stage confidence")

  const committeePct = input.contactIntelligence?.committee_completeness_pct
  if (committeePct != null && committeePct >= 50) score += 15
  else if (input.decisionMakers.length >= 2) score += 10
  else missing.push("Second decision maker / committee")

  const effectiveScore = input.leadScore.score ?? input.lead.score
  if (effectiveScore != null && effectiveScore >= 60) score += 15
  else missing.push("Strong lead score")

  if (input.lead.momentumWhySummary || input.lead.nextBestActionReason) score += 10
  else missing.push("Recent intent signals")

  if (input.lead.city || input.lead.state) score += 5

  score = Math.max(0, Math.min(100, score))

  let label = "Needs preparation"
  if (score >= 85) label = "Strong preparation"
  else if (score >= 70) label = "Meeting ready"
  else if (score >= 50) label = "Partially ready"

  const criticalCount = input.openRisks.filter((risk) => risk.priority === "Critical").length
  const summary =
    criticalCount > 0
      ? `${label} — address ${criticalCount} critical risk${criticalCount === 1 ? "" : "s"} before the meeting.`
      : `${label} — review top objectives and decision makers.`

  return { score, label, summary, missing: missing.slice(0, 4) }
}

export function buildMeetingPrepResearchSummary(
  research: GrowthResearchRunPublicView | null,
): MeetingPrepResearchSummary {
  if (!research) {
    return {
      summary: null,
      pitchAngle: null,
      confidence: null,
      painSignals: [],
      recommendedNextAction: null,
    }
  }
  return {
    summary: research.researchSummary,
    pitchAngle: research.suggestedPitchAngle,
    confidence: research.researchConfidence,
    painSignals: research.signals?.painSignals?.map((signal) => signal.replace(/_/g, " ")) ?? [],
    recommendedNextAction: research.recommendedNextAction,
  }
}

export function assembleMeetingPrepBundle(input: {
  meeting: GrowthMeeting
  lead: GrowthLead
  leadScore: MeetingPrepLeadScore
  buyingStage: MeetingPrepBuyingStage
  decisionMakers: GrowthLeadDecisionMaker[]
  contactIntelligence: GrowthProspectSearchContactIntelligence | null
  research: GrowthResearchRunPublicView | null
  accountPlaybookContext?: MeetingPrepAccountPlaybookContext | null
  videoEngagementContext?: GrowthVideoMeetingPrepContext | null
  relationshipMemory?: {
    summary: string | null
    topObjections: string[]
    priorInteractions: string[]
    commitments: string[]
    riskFlags: string[]
    preferences?: string[]
  }
}): GrowthMeetingPrepBundle {
  const companySnapshot = buildMeetingPrepCompanySnapshot(input.lead, input.research)
  const territoryContext = buildMeetingPrepTerritoryContext(input.lead)
  const mappedDecisionMakers = mapDecisionMakersForPrep(input.decisionMakers)
  const researchSummary = buildMeetingPrepResearchSummary(input.research)
  const signals = appendVideoEngagementSignals(
    buildMeetingPrepSignals(input.lead, input.research, {
      summary: input.relationshipMemory?.summary ?? null,
      priorInteractions: input.relationshipMemory?.priorInteractions ?? [],
      commitments: input.relationshipMemory?.commitments ?? [],
      preferences: input.relationshipMemory?.preferences ?? [],
    }),
    input.videoEngagementContext,
  )
  const openRisks = buildMeetingPrepOpenRisks({
    lead: input.lead,
    buyingStage: input.buyingStage,
    leadScore: input.leadScore,
    decisionMakers: mappedDecisionMakers,
    contactIntelligence: input.contactIntelligence,
    research: input.research,
    memoryObjections: input.relationshipMemory?.topObjections,
    memoryRiskFlags: input.relationshipMemory?.riskFlags,
    accountPlaybookContext: input.accountPlaybookContext,
  })
  const recommendedObjectives = buildMeetingPrepObjectives({
    lead: input.lead,
    buyingStage: input.buyingStage,
    leadScore: input.leadScore,
    contactIntelligence: input.contactIntelligence,
    research: input.research,
    openRisks,
    accountPlaybookContext: input.accountPlaybookContext,
  })
  const readiness = computeMeetingPrepReadiness({
    lead: input.lead,
    leadScore: input.leadScore,
    buyingStage: input.buyingStage,
    decisionMakers: mappedDecisionMakers,
    contactIntelligence: input.contactIntelligence,
    research: input.research,
    openRisks,
  })

  return {
    qa_marker: GROWTH_MEETING_PREP_QA_MARKER,
    meeting: {
      id: input.meeting.id,
      leadId: input.meeting.leadId,
      title: input.meeting.title,
      status: input.meeting.status,
      startAt: input.meeting.startAt,
      endAt: input.meeting.endAt,
      source: input.meeting.source,
      calendarEventId: input.meeting.calendarEventId,
      attendeeEmails: input.meeting.attendeeEmails,
      meetingUrl: input.meeting.meetingUrl,
    },
    companySnapshot,
    leadScore: input.leadScore,
    buyingStage: input.buyingStage,
    decisionMakers: mappedDecisionMakers,
    contactIntelligence: input.contactIntelligence,
    territoryContext,
    signals,
    openRisks,
    researchSummary,
    recommendedObjectives,
    readiness,
    accountPlaybookContext: input.accountPlaybookContext ?? null,
    videoEngagementContext: input.videoEngagementContext ?? null,
  }
}
