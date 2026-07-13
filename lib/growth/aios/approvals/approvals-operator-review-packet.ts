/**
 * GE-AIOS-APPROVALS-2A / OUTREACH-QUALITY-1A — Operator review packet projection (client-safe).
 * Composes outreach package + lead/DM/research fields into an SDR work product.
 * No new store — projection only.
 */

import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import {
  countWords,
  estimateReadTimeSeconds,
} from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import type { GrowthOutreachOperatorReasoning } from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

import {
  buildOperatorResearchSummaries,
  normalizeOperatorResearchLine,
} from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"

export const GROWTH_AIOS_APPROVALS_2A_QA_MARKER =
  "ge-aios-approvals-2a-operator-review-experience-v1" as const

export const GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2B_OPERATOR_LAYOUT_QA_MARKER =
  "ge-aios-conversation-intelligence-2b-operator-review-layout-v1" as const

export const GROWTH_AIOS_CONVERSATION_INTELLIGENCE_3A_OPERATOR_LAYOUT_QA_MARKER =
  "ge-aios-conversation-intelligence-3a-consultant-discovery-layout-v1" as const

export const GROWTH_AIOS_REVENUE_STRATEGY_1A_OPERATOR_LAYOUT_QA_MARKER =
  "ge-aios-revenue-strategy-1a-sales-strategy-layout-v1" as const

export { GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_OPERATOR_LAYOUT_QA_MARKER } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"
export { GROWTH_AIOS_ADAPTIVE_LOOP_1A_OPERATOR_LAYOUT_QA_MARKER } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"

export const APPROVALS_2A_DRAFT_CHANNELS = [
  "email",
  "linkedin",
  "call",
  "voicemail",
  "sms",
  "sendr",
  "follow_up",
  "meeting_request",
] as const

export type Approvals2ADraftChannel = (typeof APPROVALS_2A_DRAFT_CHANNELS)[number]

export type Approvals2AEvidenceCard = {
  id: string
  label: string
  present: boolean
  detail: string | null
}

export type Approvals2ADraftSlot = {
  channel: Approvals2ADraftChannel
  label: string
  prepared: boolean
  preview: string | null
  wordCount: number | null
  readTimeSeconds: number | null
  characterCount: number | null
  versionStatus?: "generated" | "edited" | "approved"
  editedByOperator?: boolean
  constitutionWarnings?: string[]
}

export type Approvals2AOperatorReviewPacket = {
  qaMarker: typeof GROWTH_AIOS_APPROVALS_2A_QA_MARKER
  packageId: string
  leadId: string
  company: {
    name: string
    website: string | null
    industry: string | null
    location: string | null
    employees: string | null
    revenueEstimate: string | null
    equipmentServiced: string[]
    researchConfidence: number | null
    logoUrl: string | null
  }
  decisionMaker: {
    name: string | null
    title: string | null
    email: string | null
    phone: string | null
    linkedIn: string | null
    contactConfidence: number | null
    verificationStatus: string | null
  }
  whySelected: string[]
  personalization: string[]
  evidenceCards: Approvals2AEvidenceCard[]
  /** OUTREACH-QUALITY-1A — review strategy before drafts. */
  salesStrategy: GrowthOutreachSalesStrategyBrief | null
  /** SALES-PLAYBOOK-1B — keep seller / prospect / conversation distinct in review. */
  knowledgeLayers: {
    sellerTruth: string[]
    prospectTruth: string[]
    conversationStrategy: string[]
  }
  /** CONVERSATION-INTELLIGENCE-1A — operator-facing Ava reasoning. */
  operatorReasoning: GrowthOutreachOperatorReasoning | null
  drafts: Approvals2ADraftSlot[]
  explainability: {
    whyPursue: string
    whyContact: string
    whyMessaging: string
    whyTiming: string
    supportingEvidence: string[]
    confidence: number
    unknownAssumptions: string[]
  }
  risk: {
    overallConfidence: number
    spamRisk: string
    bounceRisk: string
    relationshipStrength: string | null
    researchCompleteness: string
    contactVerification: string
    unknownFields: string[]
    autonomousSendBlockedReasons: string[]
  }
  transparency: {
    generatedAt: string
    lastUpdatedAt: string | null
    researchAge: string | null
    decisionMakerAge: string | null
    contactSource: string | null
    packageVersion: string
    preparationLabel: string
  }
  links: {
    leadHref: string
    researchHref: string
    companyHref: string
    contactHref: string
  }
  pendingHumanApproval: true
  transportBlocked: true
  teammateName: string
  /** CONVERSATION-INTELLIGENCE-2B — prioritized scan path + collapsed detail buckets. */
  operatorReviewLayout: {
    relationshipStrategyEssentials: string[]
    adaptiveLoopEssentials: string[]
    conversationStrategyEssentials: string[]
    consultantDiscoveryEssentials: string[]
    revenueStrategyEssentials: string[]
    researchSummary: string[]
    sellerTruthEssentials: string[]
    expandable: {
      relationshipStrategyDetail: string[]
      sellerTruthDetail: string[]
      prospectTruthDetail: string[]
      observationIntelligence: string[]
      consultantDiscoveryDetail: string[]
      revenueStrategyDetail: string[]
      explainabilityDetail: string[]
      evidenceDetail: string[]
      transparencyDetail: string[]
      strategyDetail: string[]
      personalizationDetail: string[]
    }
    priorityLineCount: number
    expandableLineCount: number
  }
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return null
}

function formatAge(iso: string | null | undefined, nowMs: number): string | null {
  if (!iso) return null
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return null
  const hours = Math.max(0, Math.round((nowMs - then) / 3_600_000))
  if (hours < 1) return "Updated less than an hour ago"
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} old`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} old`
}

function locationFromLead(input: {
  city?: string | null
  state?: string | null
  country?: string | null
}): string | null {
  const parts = [input.city, input.state, input.country].map((p) => p?.trim()).filter(Boolean)
  return parts.length ? parts.join(", ") : null
}

function mapPackageChannelToDraft(
  channel: string,
): Approvals2ADraftChannel | null {
  if ((APPROVALS_2A_DRAFT_CHANNELS as readonly string[]).includes(channel)) {
    return channel as Approvals2ADraftChannel
  }
  return null
}

function draftLabel(channel: Approvals2ADraftChannel): string {
  switch (channel) {
    case "email":
      return "Email"
    case "linkedin":
      return "LinkedIn"
    case "call":
      return "Call guide"
    case "voicemail":
      return "Voicemail"
    case "sms":
      return "SMS"
    case "sendr":
      return "Personalized Video"
    case "follow_up":
      return "Follow-up sequence"
    case "meeting_request":
      return "Meeting request"
  }
}

function draftMetrics(preview: string | null, channel: Approvals2ADraftChannel): {
  wordCount: number | null
  readTimeSeconds: number | null
  characterCount: number | null
} {
  if (!preview?.trim()) {
    return { wordCount: null, readTimeSeconds: null, characterCount: null }
  }
  if (channel === "sms") {
    return {
      wordCount: countWords(preview),
      readTimeSeconds: null,
      characterCount: preview.length,
    }
  }
  return {
    wordCount: countWords(preview),
    readTimeSeconds: estimateReadTimeSeconds(preview),
    characterCount: null,
  }
}

function buildEvidenceCards(input: {
  website: string | null
  supportingResearch: string[]
  researchSummary?: string[]
  hasDecisionMaker: boolean
  hasEmail: boolean
  hasPhone: boolean
  contactSource: string | null
}): Approvals2AEvidenceCard[] {
  const researchJoined = [
    ...input.supportingResearch,
    ...(input.researchSummary ?? []),
  ]
    .join(" ")
    .toLowerCase()
  const has = (needle: RegExp) => needle.test(researchJoined)

  return [
    {
      id: "website",
      label: "Website",
      present: Boolean(input.website) || has(/website|site/),
      detail: input.website,
    },
    {
      id: "pricing",
      label: "Pricing",
      present: has(/pricing|price|cost/),
      detail: null,
    },
    {
      id: "about",
      label: "About",
      present: has(/about|company summary|overview/),
      detail: null,
    },
    {
      id: "careers",
      label: "Careers",
      present: has(/career|hiring|job|technician/),
      detail: null,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      present: has(/linkedin/),
      detail: null,
    },
    {
      id: "decision_maker",
      label: "Decision maker",
      present: input.hasDecisionMaker,
      detail: null,
    },
    {
      id: "contact_sources",
      label: "Contact sources",
      present: input.hasEmail || input.hasPhone,
      detail: input.contactSource,
    },
    {
      id: "datamoon",
      label: "DataMoon",
      present: has(/datamoon|decision.?maker/) || Boolean(input.contactSource?.toLowerCase().includes("datamoon")),
      detail: null,
    },
    {
      id: "internal_research",
      label: "Internal research",
      present: input.supportingResearch.length > 0 || (input.researchSummary?.length ?? 0) > 0,
      detail: input.researchSummary?.length
        ? input.researchSummary.slice(0, 2).join(" · ")
        : input.supportingResearch.length
          ? `${input.supportingResearch.length} evidence signal${input.supportingResearch.length === 1 ? "" : "s"}`
          : null,
    },
  ]
}

function countReviewLines(lines: Array<string | null | undefined>): number {
  return lines.filter((line) => Boolean(line?.trim())).length
}

export function projectApprovals2AOperatorReviewPacket(input: {
  pkg: GrowthAutonomousOutreachApprovalPackage
  teammateName?: string | null
  now?: string
  lead?: {
    companyName?: string | null
    website?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    estimatedEmployeeCount?: string | null
    estimatedAnnualRevenue?: string | null
    fieldServiceStackDetected?: string | null
    lastResearchedAt?: string | null
    sourceVendor?: string | null
    sourceChannel?: string | null
    relationshipStrengthTier?: string | null
    decisionMakerStatus?: string | null
    metadata?: Record<string, unknown> | null
  } | null
  decisionMaker?: {
    fullName?: string | null
    title?: string | null
    email?: string | null
    phone?: string | null
    linkedinUrl?: string | null
    confidence?: number | null
    verificationStatus?: string | null
    discoveredAt?: string | null
    source?: string | null
  } | null
  research?: {
    updatedAt?: string | null
    confidence?: number | null
    industry?: string | null
    equipmentServiced?: string[]
    missingEvidence?: string[]
    potentialRisks?: string[]
    assumptions?: string[]
    opportunitySummary?: string | null
  } | null
}): Approvals2AOperatorReviewPacket {
  const teammate = resolveAiTeammatePresentation(input.teammateName)
  const nowIso = input.now ?? new Date().toISOString()
  const nowMs = Date.parse(nowIso)
  const lead = input.lead ?? null
  const dm = input.decisionMaker ?? null
  const research = input.research ?? null
  const pkg = input.pkg
  const strategy = pkg.salesStrategyBrief ?? null

  const email = firstNonEmpty(dm?.email, lead?.contactEmail)
  const phone = firstNonEmpty(dm?.phone, lead?.contactPhone)
  const name = firstNonEmpty(dm?.fullName, lead?.contactName)
  const equipment =
    research?.equipmentServiced?.length
      ? research.equipmentServiced
      : typeof lead?.fieldServiceStackDetected === "string" && lead.fieldServiceStackDetected.trim()
        ? [lead.fieldServiceStackDetected.trim()]
        : []

  const researchSummary = buildOperatorResearchSummaries([
    ...pkg.supportingResearch,
    ...(strategy?.evidence.map((row) => row.detail) ?? []),
    ...(strategy?.prospectTruth?.evidence.map((row) => row.detail) ?? []),
  ])

  const whySelected = [
    ...researchSummary.slice(0, 3),
    equipment[0] ? `Equipment focus: ${equipment.join(" · ")}` : null,
    name ? `Decision maker: ${name}${dm?.title ? ` (${dm.title})` : ""}` : null,
    strategy?.prospectTruth?.fitReason ? `ICP fit: ${strategy.prospectTruth.fitReason}` : "Fits approved ICP",
  ]
    .filter((line): line is string => Boolean(line?.trim()))
    .slice(0, 5)

  const personalization = researchSummary.length
    ? researchSummary.slice(0, 4)
    : ["Personalization rationale attached on the prepared package."]

  const assetsByChannel = new Map<string, GrowthAutonomousOutreachApprovalPackage["generatedAssets"][number]>()
  for (const asset of pkg.generatedAssets) {
    if (!assetsByChannel.has(asset.channel)) {
      assetsByChannel.set(asset.channel, asset)
    }
  }

  const drafts: Approvals2ADraftSlot[] = APPROVALS_2A_DRAFT_CHANNELS.map((channel) => {
    const mapped = mapPackageChannelToDraft(channel)
    const asset = mapped ? assetsByChannel.get(mapped) ?? null : null
    const preview =
      asset?.approvedPreview?.trim() ||
      asset?.operatorPreview?.trim() ||
      asset?.preview?.trim() ||
      asset?.generatedPreview?.trim() ||
      null
    const preparedPreview = preview?.trim() ? preview : null
    const metrics = draftMetrics(preparedPreview, channel)
    return {
      channel,
      label: draftLabel(channel),
      prepared: Boolean(preparedPreview),
      preview: preparedPreview,
      wordCount:
        channel === "email" && pkg.draftQuality?.emailWordCount != null
          ? pkg.draftQuality.emailWordCount
          : metrics.wordCount,
      readTimeSeconds:
        channel === "email" && pkg.draftQuality?.emailReadTimeSeconds != null
          ? pkg.draftQuality.emailReadTimeSeconds
          : metrics.readTimeSeconds,
      characterCount:
        channel === "sms" && pkg.draftQuality?.smsCharacterCount != null
          ? pkg.draftQuality.smsCharacterCount
          : metrics.characterCount,
      versionStatus: asset?.versionStatus ?? (preparedPreview ? "generated" : undefined),
      editedByOperator: asset?.versionStatus === "edited" || asset?.versionStatus === "approved",
      constitutionWarnings: asset?.constitutionWarnings ?? [],
    }
  })

  const unknownFields = [
    ...(email ? [] : ["email"]),
    ...(phone ? [] : ["phone"]),
    ...(dm?.linkedinUrl ? [] : ["linkedin"]),
    ...(lead?.website ? [] : ["website"]),
    ...(research?.missingEvidence ?? []),
    ...(pkg.salesStrategyBrief?.missingPersonalizationOpportunities ?? []),
  ]

  const contactSource =
    firstNonEmpty(dm?.source, lead?.sourceVendor, lead?.sourceChannel, "Canonical lead contacts") ??
    null

  const sellerTruthEssentials = [
    strategy?.sellerTruth?.primaryValueProposition
      ? `Positioning: ${strategy.sellerTruth.primaryValueProposition}`
      : null,
    ...(strategy?.sellerTruth?.differentiators.slice(0, 2).map((line) => `Differentiator: ${line}`) ?? []),
    strategy?.sellerTruth?.wordsToAvoid?.length
      ? `Words to avoid: ${strategy.sellerTruth.wordsToAvoid.slice(0, 4).join(", ")}`
      : null,
    strategy?.sellerTruth?.neverSay?.length
      ? `Never say: ${strategy.sellerTruth.neverSay.slice(0, 3).join(", ")}`
      : null,
  ].filter((line): line is string => Boolean(line))

  const sellerTruthDetail = [
    strategy?.sellerTruth?.source === "approved_business_profile"
      ? "Approved Business Profile loaded"
      : "Approved Business Profile unavailable — safe seller defaults",
    strategy?.sellerTruth?.elevatorPitch
      ? `Elevator pitch: ${strategy.sellerTruth.elevatorPitch}`
      : null,
    strategy?.sellerTruth?.mission ? `Mission: ${strategy.sellerTruth.mission}` : null,
    ...(strategy?.sellerTruth?.ctaPreferences.map((line) => `Preferred CTA: ${line}`) ?? []),
    ...(strategy?.sellerTruth?.discoveryQuestions?.slice(0, 4).map((line) => `Discovery: ${line}`) ?? []),
    strategy?.sellerTruth?.industryPlaybookUsedAsFallback
      ? "Industry playbook used only as fallback for missing seller guidance"
      : null,
    strategy?.sellerTruth?.biUsedAsEnrichmentOnly
      ? "Business Intelligence used as enrichment only (profile remains SoT)"
      : null,
    ...(strategy?.sellerTruth?.enrichments.fromOrganizationalKnowledge.slice(0, 3).map(
      (line) => `Org knowledge: ${line}`,
    ) ?? []),
    ...(strategy?.sellerTruth?.enrichments.fromKnowledgeCenter.slice(0, 3).map(
      (line) => `Knowledge Center: ${line}`,
    ) ?? []),
  ].filter((line): line is string => Boolean(line))

  const prospectTruthEssentials = [
    strategy?.prospectTruth?.companyName
      ? `Company: ${strategy.prospectTruth.companyName}`
      : `Company: ${firstNonEmpty(pkg.companyName, lead?.companyName) ?? "Account"}`,
    strategy?.prospectTruth?.fitReason ? `Fit: ${strategy.prospectTruth.fitReason}` : null,
    strategy?.prospectTruth?.opportunitySummary
      ? `Opportunity: ${strategy.prospectTruth.opportunitySummary}`
      : null,
    strategy?.relationshipStage || strategy?.prospectTruth?.relationshipStage
      ? `Relationship stage: ${strategy?.relationshipStage ?? strategy?.prospectTruth?.relationshipStage}`
      : null,
  ].filter((line): line is string => Boolean(line))

  const prospectTruthDetail = [
    ...(strategy?.prospectTruth?.businessProblems.map((line) => `Problem: ${line}`) ?? []),
    ...(strategy?.prospectTruth?.evidence.slice(0, 6).map((row) => {
      const normalized = normalizeOperatorResearchLine(row.detail)
      return normalized ? `Evidence: ${normalized}` : null
    }) ?? []),
  ].filter((line): line is string => Boolean(line))

  const revenueStrategy = strategy?.revenueStrategyIntelligence ?? null
  const relationship = strategy?.relationshipAssessment ?? null
  const adaptiveEvolution = strategy?.adaptiveLoopEvolution ?? null

  const relationshipStrategyEssentials = [
    adaptiveEvolution?.strategyChange.relationshipChangedBecause.length
      ? `Relationship changed because: ${adaptiveEvolution.strategyChange.relationshipChangedBecause.join(", ")}`
      : null,
    adaptiveEvolution?.strategyChange.previousStrategy.recommendation &&
    adaptiveEvolution?.strategyChange.currentStrategy.recommendation &&
    adaptiveEvolution.strategyChange.previousStrategy.recommendation !==
      adaptiveEvolution.strategyChange.currentStrategy.recommendation
      ? `Previous strategy: ${adaptiveEvolution.strategyChange.previousStrategy.recommendation} → Current: ${adaptiveEvolution.strategyChange.currentStrategy.recommendation}`
      : null,
    ...(adaptiveEvolution?.strategyChange.meaningfulChanges.slice(0, 3).map((line) => `Change: ${line}`) ?? []),
    relationship?.relationshipStory.summary ? `Story: ${relationship.relationshipStory.summary}` : null,
    relationship?.relationshipGoal.label ? `Goal: ${relationship.relationshipGoal.label}` : null,
    relationship?.relationshipDirection ? `Direction: ${relationship.relationshipDirection}` : null,
    relationship?.relationshipMomentum
      ? `Momentum: ${relationship.relationshipMomentum.trend} (${relationship.relationshipMomentum.score}/100)`
      : null,
    relationship?.trustBudget ? `Trust budget: ${relationship.trustBudget.level}` : null,
    relationship?.relationshipConfidence
      ? `Relationship confidence: ${relationship.relationshipConfidence.level.replace(/_/g, " ")}`
      : null,
    relationship?.strategyEvolution.evolutionSummary[0] ?? null,
    relationship?.strategyEvolution.whyChanged[0] ?? null,
    revenueStrategy ? `Current recommendation: ${revenueStrategy.recommendation}` : null,
    relationship?.strategyEvolution.confidenceDelta != null
      ? `Confidence delta: ${relationship.strategyEvolution.confidenceDelta > 0 ? "+" : ""}${Math.round(relationship.strategyEvolution.confidenceDelta * 100)} pts`
      : revenueStrategy
        ? `Confidence: ${revenueStrategy.confidenceLevel}`
        : null,
  ].filter((line): line is string => Boolean(line))

  const revenueStrategyEssentials = [
    revenueStrategy ? `Sales recommendation: ${revenueStrategy.recommendation}` : null,
    revenueStrategy?.recommendationSummary ? `Why: ${revenueStrategy.recommendationSummary}` : null,
    revenueStrategy?.primaryEntryPoint
      ? `Recommended entry: ${revenueStrategy.primaryEntryPoint.label}`
      : null,
    revenueStrategy?.backupEntryPoint
      ? `Backup entry: ${revenueStrategy.backupEntryPoint.label}`
      : null,
    revenueStrategy?.conversationApproach
      ? `Strategy: ${revenueStrategy.conversationApproach}`
      : null,
    revenueStrategy
      ? `Confidence: ${revenueStrategy.confidenceLevel} (${Math.round(revenueStrategy.confidenceScore * 100)}%)`
      : null,
  ].filter((line): line is string => Boolean(line))

  const consultantDiscovery = strategy?.consultantDiscoveryIntelligence ?? null

  const consultantDiscoveryEssentials = [
    consultantDiscovery?.primaryBusinessPressure
      ? `Top business pressure: ${consultantDiscovery.primaryBusinessPressure.label}`
      : null,
    consultantDiscovery?.operationalBottleneck
      ? `Operational bottleneck: ${consultantDiscovery.operationalBottleneck}`
      : null,
    consultantDiscovery?.primaryBuyingTrigger
      ? `Primary buying trigger (${consultantDiscovery.primaryBuyingTrigger.impact}): ${consultantDiscovery.primaryBuyingTrigger.label}`
      : null,
    consultantDiscovery?.conversationAngle
      ? `Conversation angle: ${consultantDiscovery.conversationAngle}`
      : null,
    consultantDiscovery?.recommendedFirstQuestion
      ? `Recommended first question: ${consultantDiscovery.recommendedFirstQuestion}`
      : null,
    consultantDiscovery
      ? `Reason confidence: ${Math.round(consultantDiscovery.reasonConfidence * 100)}%`
      : null,
  ].filter((line): line is string => Boolean(line))

  const conversationStrategyEssentials = [
    strategy?.evidenceIntelligence?.selectedObservation?.consultantObservation
      ? `Opening observation: ${strategy.evidenceIntelligence.selectedObservation.consultantObservation}`
      : strategy?.operatorReasoning?.primaryInsight
        ? `Opening observation: ${strategy.operatorReasoning.primaryInsight}`
        : null,
    strategy?.recommendedCta ? `Recommended CTA: ${strategy.recommendedCta}` : null,
    strategy?.conversationStrategy?.smallestCommitment
      ? `Smallest commitment: ${strategy.conversationStrategy.smallestCommitment}`
      : strategy?.operatorReasoning?.smallestCommitment
        ? `Smallest commitment: ${strategy.operatorReasoning.smallestCommitment}`
        : null,
  ].filter((line): line is string => Boolean(line))

  const relationshipStrategyDetail = [
    ...(relationship?.relationshipStory.essentials.map((line) => `Story: ${line}`) ?? []),
    relationship?.relationshipGoal.rationale ? `Goal rationale: ${relationship.relationshipGoal.rationale}` : null,
    relationship?.relationshipGoal.successCriteria
      ? `Success criteria: ${relationship.relationshipGoal.successCriteria}`
      : null,
    relationship?.relationshipGoal.nextGoal
      ? `Next goal: ${relationship.relationshipGoal.nextGoal.replace(/_/g, " ")}`
      : null,
    ...(relationship?.safeRecall.map((row) => `Safe recall: ${row.naturalPhrase}`) ?? []),
    ...(relationship?.relationshipProtection.active
      ? relationship.relationshipProtection.rationale.map((line) => `Protection: ${line}`)
      : []),
    ...(relationship?.relationshipImprovementLikelihood.rationale.map(
      (line) => `Improvement outlook: ${line}`,
    ) ?? []),
    ...(relationship?.strategyEvolution.whyChanged.map((line) => `Why changed: ${line}`) ?? []),
    ...(relationship?.institutionalAdvice.map((row) => `Institutional advice: ${row.pattern}`) ?? []),
  ].filter((line): line is string => Boolean(line))

  const revenueStrategyDetail = [
    revenueStrategy?.vpSalesJudgment ? `VP judgment: ${revenueStrategy.vpSalesJudgment}` : null,
    revenueStrategy?.timingRationale ? `Timing: ${revenueStrategy.timingRationale}` : null,
    ...(revenueStrategy?.timingSignals.map((line) => `Timing signal: ${line}`) ?? []),
    revenueStrategy?.channelPlan
      ? `Channel: ${revenueStrategy.channelPlan.primaryChannel} — ${revenueStrategy.channelPlan.rationale}`
      : null,
    revenueStrategy?.sequencePlan
      ? `Sequence: ${revenueStrategy.sequencePlan.approach.replace(/_/g, " ")} — ${revenueStrategy.sequencePlan.rationale}`
      : null,
    revenueStrategy?.committeeStrategy
      ? `Committee: ${revenueStrategy.committeeStrategy.replace(/_/g, " ")}`
      : null,
    ...(revenueStrategy?.committeeStakeholders
      .filter((row) => row.present)
      .map((row) => `Stakeholder: ${row.label}`) ?? []),
    ...(revenueStrategy?.threadPlan.map(
      (row, index) =>
        `Thread ${index + 1}: ${row.contactTitle ?? "Contact"} — ${row.conversationAngle}`,
    ) ?? []),
    ...(revenueStrategy?.risks.map((row) => `Risk (${row.severity}): ${row.label}`) ?? []),
    ...(revenueStrategy?.delayReasons.map((line) => `Delay: ${line}`) ?? []),
    ...(revenueStrategy?.researchGaps.map((line) => `Research gap: ${line}`) ?? []),
    revenueStrategy?.competitivePosture.competitiveWedge
      ? `Competitive wedge: ${revenueStrategy.competitivePosture.competitiveWedge}`
      : null,
  ].filter((line): line is string => Boolean(line))

  const consultantDiscoveryDetail = [
    consultantDiscovery?.consultantHypothesis
      ? `Hypothesis: ${consultantDiscovery.consultantHypothesis}`
      : null,
    consultantDiscovery?.reasoningChain.operationalImplication
      ? `Operational implication: ${consultantDiscovery.reasoningChain.operationalImplication}`
      : null,
    consultantDiscovery?.reasoningChain.businessImplication
      ? `Business implication: ${consultantDiscovery.reasoningChain.businessImplication}`
      : null,
    consultantDiscovery?.reasoningChain.conversationOpportunity
      ? `Conversation opportunity: ${consultantDiscovery.reasoningChain.conversationOpportunity}`
      : null,
    consultantDiscovery?.conversationTiming.reason
      ? `Why now: ${consultantDiscovery.conversationTiming.reason}`
      : consultantDiscovery?.conversationTiming.internalNote ?? null,
    ...(consultantDiscovery?.rankedBuyingTriggers.slice(1, 4).map(
      (row) => `Buying trigger (${row.impact}): ${row.label}`,
    ) ?? []),
    ...(consultantDiscovery?.rankedDiscoveryQuestions.slice(1, 4).map(
      (row) => `Discovery (${row.themeKey}): ${row.question}`,
    ) ?? []),
    strategy?.operatorReasoning?.conversationGoal
      ? `Goal: ${strategy.operatorReasoning.conversationGoal}`
      : null,
    strategy?.operatorReasoning?.businessOutcome
      ? `Outcome: ${strategy.operatorReasoning.businessOutcome}`
      : null,
    strategy?.operatorReasoning?.reasonForCta
      ? `CTA rationale: ${strategy.operatorReasoning.reasonForCta}`
      : null,
  ].filter((line): line is string => Boolean(line))

  const observationIntelligence = [
    strategy?.evidenceIntelligence?.themeKey
      ? `Selected theme: ${strategy.evidenceIntelligence.themeKey}`
      : null,
    strategy?.evidenceIntelligence?.selectionRationale ?? null,
    ...(strategy?.evidenceIntelligence?.rankedObservations ?? [])
      .slice(0, 3)
      .map(
        (row) =>
          `Ranked (${row.scores.total.toFixed(2)}): ${row.themeKey} — ${row.consultantObservation}`,
      ),
    strategy?.evidenceIntelligence?.observationSelection?.runnerUp?.themeKey
      ? `Runner-up: ${strategy.evidenceIntelligence.observationSelection.runnerUp.themeKey}`
      : null,
  ].filter((line): line is string => Boolean(line))

  const knowledgeLayers = {
    sellerTruth: sellerTruthEssentials,
    prospectTruth: prospectTruthEssentials,
    conversationStrategy: conversationStrategyEssentials,
  }

  const explainabilityDetail = [
    `Why pursue: ${firstNonEmpty(strategy?.executiveSummary, research?.opportunitySummary, pkg.expectedOutcome, whySelected[0]) ?? `${teammate.name} prepared this account after research completed.`}`,
    `Why contact: ${firstNonEmpty(revenueStrategy?.primaryEntryPoint.label, strategy?.decisionMakerAnalysis.whyThisPerson, name ? `${name}${dm?.title ? ` (${dm.title})` : ""} is the selected decision maker.` : null) ?? `${teammate.name} used the best available decision-maker context.`}`,
    `Why messaging: ${firstNonEmpty(strategy?.primaryHook, strategy?.evidenceIntelligence?.selectedObservation?.consultantObservation) ?? `${teammate.name} tailored messaging from research and personalization signals.`}`,
    `Why timing: ${firstNonEmpty(revenueStrategy?.timingRationale, revenueStrategy?.recommendationSummary) ?? `${teammate.name} finished preparation at ${pkg.preparedAt} and stopped for your authorization before any send.`}`,
    ...(strategy?.operatorReasoning?.conversationRisks ?? []).map((line) => `Risk: ${line}`),
    ...(strategy?.operatorReasoning?.intentionallyAvoided ?? []).map((line) => `Avoid: ${line}`),
  ]

  const evidenceDetail = researchSummary.map((line) => `Research: ${line}`)

  const strategyDetail = [
    strategy?.conversationJustification ? `Justification: ${strategy.conversationJustification}` : null,
    strategy?.primaryHook ? `Primary hook: ${strategy.primaryHook}` : null,
    strategy?.businessValue ? `Business value: ${strategy.businessValue}` : null,
    ...(strategy?.businessProblems.map((line) => `Problem: ${line}`) ?? []),
    ...(strategy?.trustBuilders.map((line) => `Trust builder: ${line}`) ?? []),
    ...(strategy?.objections.map((row) => `Objection: ${row.objection} → ${row.response}`) ?? []),
    ...(strategy?.missingPersonalizationOpportunities.map((gap) => `Missing: ${gap}`) ?? []),
  ].filter((line): line is string => Boolean(line))

  const transparencyDetail = [
    `Generated: ${pkg.preparedAt}`,
    research?.updatedAt ? `Last updated: ${research.updatedAt}` : null,
    formatAge(research?.updatedAt ?? lead?.lastResearchedAt, nowMs)
      ? `Research age: ${formatAge(research?.updatedAt ?? lead?.lastResearchedAt, nowMs)}`
      : null,
    formatAge(dm?.discoveredAt, nowMs)
      ? `Decision maker age: ${formatAge(dm?.discoveredAt, nowMs)}`
      : null,
    contactSource ? `Contact source: ${contactSource}` : null,
    `Package: ${pkg.packageId}`,
  ].filter((line): line is string => Boolean(line))

  const personalizationDetail =
    pkg.personalizationEvidence.length > 0 ? pkg.personalizationEvidence.slice(0, 8) : []

  const priorityLineCount =
    countReviewLines([
      ...whySelected,
      ...relationshipStrategyEssentials,
      ...revenueStrategyEssentials.slice(0, 2),
      ...consultantDiscoveryEssentials.slice(0, 2),
      ...conversationStrategyEssentials.slice(0, 2),
      ...researchSummary.slice(0, 2),
    ]) +
    drafts.filter((draft) => draft.prepared).length * 2 +
    8

  const expandableLineCount = countReviewLines([
    ...relationshipStrategyDetail,
    ...sellerTruthDetail,
    ...prospectTruthDetail,
    ...observationIntelligence,
    ...consultantDiscoveryDetail,
    ...revenueStrategyDetail,
    ...explainabilityDetail,
    ...evidenceDetail,
    ...transparencyDetail,
    ...strategyDetail,
    ...personalizationDetail,
  ])

  const operatorReviewLayout = {
    relationshipStrategyEssentials,
    adaptiveLoopEssentials: adaptiveEvolution?.strategyChange.relationshipChangedBecause ?? [],
    conversationStrategyEssentials,
    consultantDiscoveryEssentials,
    revenueStrategyEssentials,
    researchSummary,
    sellerTruthEssentials,
    expandable: {
      relationshipStrategyDetail,
      sellerTruthDetail,
      prospectTruthDetail,
      observationIntelligence,
      consultantDiscoveryDetail,
      revenueStrategyDetail,
      explainabilityDetail,
      evidenceDetail,
      transparencyDetail,
      strategyDetail,
      personalizationDetail,
    },
    priorityLineCount,
    expandableLineCount,
  }

  return {
    qaMarker: GROWTH_AIOS_APPROVALS_2A_QA_MARKER,
    packageId: pkg.packageId,
    leadId: pkg.leadId,
    company: {
      name: firstNonEmpty(pkg.companyName, lead?.companyName) ?? "Account",
      website: lead?.website ?? null,
      industry: research?.industry ?? null,
      location: locationFromLead(lead ?? {}),
      employees: lead?.estimatedEmployeeCount ?? null,
      revenueEstimate: lead?.estimatedAnnualRevenue ?? null,
      equipmentServiced: equipment,
      researchConfidence: research?.confidence ?? pkg.confidence,
      logoUrl: null,
    },
    decisionMaker: {
      name,
      title: dm?.title ?? null,
      email,
      phone,
      linkedIn: dm?.linkedinUrl ?? null,
      contactConfidence: dm?.confidence ?? null,
      verificationStatus:
        firstNonEmpty(dm?.verificationStatus, lead?.decisionMakerStatus, email || phone ? "canonical" : "unverified") ??
        null,
    },
    whySelected,
    personalization,
    evidenceCards: buildEvidenceCards({
      website: lead?.website ?? null,
      supportingResearch: pkg.supportingResearch,
      researchSummary,
      hasDecisionMaker: Boolean(name),
      hasEmail: Boolean(email),
      hasPhone: Boolean(phone),
      contactSource,
    }),
    salesStrategy: strategy,
    knowledgeLayers,
    operatorReasoning: strategy?.operatorReasoning ?? null,
    drafts,
    explainability: {
      whyPursue:
        firstNonEmpty(
          strategy?.executiveSummary,
          research?.opportunitySummary,
          pkg.expectedOutcome,
          whySelected[0],
        ) ?? `${teammate.name} prepared this account after research completed.`,
      whyContact:
        firstNonEmpty(
          strategy?.decisionMakerAnalysis.whyThisPerson,
          pkg.personalizationEvidence.find((line) => /decision|contact|maker|dm|title/i.test(line)),
          name ? `${name}${dm?.title ? ` (${dm.title})` : ""} is the selected decision maker.` : null,
        ) ?? `${teammate.name} used the best available decision-maker context.`,
      whyMessaging:
        firstNonEmpty(
          strategy?.primaryHook,
          pkg.personalizationEvidence.find((line) => /hook|email|strategy|message|personal/i.test(line)),
          personalization[0],
        ) ?? `${teammate.name} tailored messaging from research and personalization signals.`,
      whyTiming: `${teammate.name} finished preparation at ${pkg.preparedAt} and stopped for your authorization before any send.`,
      supportingEvidence: researchSummary.slice(0, 6),
      confidence: strategy?.confidence ?? pkg.confidence,
      unknownAssumptions: [
        ...(research?.assumptions ?? []),
        ...(strategy?.missingPersonalizationOpportunities.map(
          (gap) => `Missing personalization: ${gap}`,
        ) ?? []),
        ...unknownFields.map((field) => `Unknown or incomplete: ${field}`),
      ].slice(0, 8),
    },
    risk: {
      overallConfidence: strategy?.confidence ?? pkg.confidence,
      spamRisk: pkg.confidence >= 0.7 ? "Low" : pkg.confidence >= 0.5 ? "Medium" : "Elevated",
      bounceRisk: email ? "Review before send" : "High — no email on package",
      relationshipStrength: lead?.relationshipStrengthTier ?? null,
      researchCompleteness:
        (research?.missingEvidence?.length ?? 0) === 0
          ? "Research evidence present"
          : `${research?.missingEvidence?.length} evidence gap${(research?.missingEvidence?.length ?? 0) === 1 ? "" : "s"}`,
      contactVerification:
        email || phone
          ? "Canonical contact present — verify before send"
          : "Contact incomplete",
      unknownFields: Array.from(new Set(unknownFields)).slice(0, 12),
      autonomousSendBlockedReasons: [
        "pendingHumanApproval",
        "transportBlocked",
        ...pkg.approvalRequirements,
        ...(research?.potentialRisks ?? []),
      ],
    },
    transparency: {
      generatedAt: pkg.preparedAt,
      lastUpdatedAt: research?.updatedAt ?? pkg.preparedAt,
      researchAge: formatAge(research?.updatedAt ?? lead?.lastResearchedAt, nowMs),
      decisionMakerAge: formatAge(dm?.discoveredAt, nowMs),
      contactSource,
      packageVersion: pkg.packageId,
      preparationLabel: "Outreach preparation",
    },
    links: {
      leadHref: `/growth/leads/${pkg.leadId}`,
      researchHref: `/growth/os/pilot/lead-research/${pkg.leadId}`,
      companyHref: `/growth/leads/${pkg.leadId}`,
      contactHref: `/growth/leads/${pkg.leadId}`,
    },
    pendingHumanApproval: true,
    transportBlocked: true,
    teammateName: teammate.name,
    operatorReviewLayout,
  }
}

/** Humanize calibration / supporting recommendation titles for operators. */
export function humanizeCompletedWorkSupportingSummary(
  item: { title: string; summary: string; source: string },
  teammate?: AiTeammatePresentation | string | null,
): string {
  const name =
    typeof teammate === "string"
      ? resolveAiTeammatePresentation(teammate).name
      : resolveAiTeammatePresentation(teammate?.name).name
  const blob = `${item.title} ${item.summary}`.toLowerCase()

  if (/calibrat|objective progress|objective signal/.test(blob)) {
    const countMatch = blob.match(/(\d+)\s+(recent|customer|interaction|signal)/)
    if (countMatch) {
      return `${name} analyzed ${countMatch[1]} recent customer interactions and recommends recalibrating objective scoring.`
    }
    return `${name} reviewed recent objective progress and recommends recalibrating scoring before the next cycle.`
  }
  if (/outbound risk|spam|bounce|deliverability/.test(blob)) {
    return `${name} flagged outbound risk signals that need your review before autonomous send stays enabled.`
  }
  if (/meta.?recommend|recommendation/.test(blob) && item.source === "meta_recommender") {
    return `${name} prepared a supporting recommendation — open details only if you want to adjust priorities.`
  }
  if (item.summary.trim().length > 24) return item.summary.trim()
  return item.title.trim()
}

export function countPreparedDrafts(packet: Approvals2AOperatorReviewPacket): number {
  return packet.drafts.filter((draft) => draft.prepared).length
}
