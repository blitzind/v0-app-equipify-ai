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
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

export const GROWTH_AIOS_APPROVALS_2A_QA_MARKER =
  "ge-aios-approvals-2a-operator-review-experience-v1" as const

export const APPROVALS_2A_DRAFT_CHANNELS = [
  "email",
  "linkedin",
  "call",
  "voicemail",
  "sms",
  "sendr",
  "follow_up",
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
  hasDecisionMaker: boolean
  hasEmail: boolean
  hasPhone: boolean
  contactSource: string | null
}): Approvals2AEvidenceCard[] {
  const researchJoined = input.supportingResearch.join(" ").toLowerCase()
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
      present: input.supportingResearch.length > 0,
      detail: `${input.supportingResearch.length} evidence line${input.supportingResearch.length === 1 ? "" : "s"}`,
    },
  ]
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

  const email = firstNonEmpty(dm?.email, lead?.contactEmail)
  const phone = firstNonEmpty(dm?.phone, lead?.contactPhone)
  const name = firstNonEmpty(dm?.fullName, lead?.contactName)
  const equipment =
    research?.equipmentServiced?.length
      ? research.equipmentServiced
      : typeof lead?.fieldServiceStackDetected === "string" && lead.fieldServiceStackDetected.trim()
        ? [lead.fieldServiceStackDetected.trim()]
        : []

  const whySelected = [
    ...pkg.supportingResearch.slice(0, 4),
    equipment[0] ? `Services ${equipment[0]}` : null,
    name ? "Decision maker verified" : null,
    "Fits approved ICP",
  ]
    .filter((line): line is string => Boolean(line?.trim()))
    .slice(0, 5)

  const personalization =
    pkg.personalizationEvidence.length > 0
      ? pkg.personalizationEvidence.slice(0, 6)
      : ["Personalization rationale attached on the prepared package."]

  const assetsByChannel = new Map<string, string>()
  for (const asset of pkg.generatedAssets) {
    if (!assetsByChannel.has(asset.channel) && asset.preview?.trim()) {
      assetsByChannel.set(asset.channel, asset.preview)
    }
  }

  const drafts: Approvals2ADraftSlot[] = APPROVALS_2A_DRAFT_CHANNELS.map((channel) => {
    const mapped = mapPackageChannelToDraft(channel)
    const preview = mapped ? assetsByChannel.get(mapped) ?? null : null
    // Voicemail is a required review slot; dedicated asset may not yet be prepared.
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

  const strategy = pkg.salesStrategyBrief ?? null

  const knowledgeLayers = {
    sellerTruth: [
      strategy?.sellerTruth?.source === "approved_business_profile"
        ? "Approved Business Profile loaded"
        : "Approved Business Profile unavailable — safe seller defaults",
      strategy?.sellerTruth?.primaryValueProposition
        ? `Value proposition: ${strategy.sellerTruth.primaryValueProposition}`
        : null,
      strategy?.sellerTruth?.elevatorPitch
        ? `Elevator pitch: ${strategy.sellerTruth.elevatorPitch}`
        : null,
      strategy?.sellerTruth?.mission ? `Mission: ${strategy.sellerTruth.mission}` : null,
      ...(strategy?.sellerTruth?.differentiators.map((line) => `Differentiator: ${line}`) ?? []),
      ...(strategy?.sellerTruth?.ctaPreferences.map((line) => `Preferred CTA: ${line}`) ?? []),
      strategy?.sellerTruth?.industryPlaybookUsedAsFallback
        ? "Industry playbook used only as fallback for missing seller guidance"
        : "Industry playbook not used as primary seller guidance",
      strategy?.sellerTruth?.biUsedAsEnrichmentOnly
        ? "Business Intelligence used as enrichment only (profile remains SoT)"
        : null,
      ...(strategy?.sellerTruth?.enrichments.fromOrganizationalKnowledge.slice(0, 2).map(
        (line) => `Org knowledge: ${line}`,
      ) ?? []),
      ...(strategy?.sellerTruth?.enrichments.fromKnowledgeCenter.slice(0, 2).map(
        (line) => `Knowledge Center: ${line}`,
      ) ?? []),
    ].filter((line): line is string => Boolean(line)),
    prospectTruth: [
      strategy?.prospectTruth?.companyName
        ? `Company: ${strategy.prospectTruth.companyName}`
        : `Company: ${firstNonEmpty(pkg.companyName, lead?.companyName) ?? "Account"}`,
      strategy?.prospectTruth?.fitReason
        ? `Fit: ${strategy.prospectTruth.fitReason}`
        : null,
      strategy?.prospectTruth?.opportunitySummary
        ? `Opportunity: ${strategy.prospectTruth.opportunitySummary}`
        : null,
      ...(strategy?.prospectTruth?.businessProblems.map((line) => `Problem: ${line}`) ??
        pkg.supportingResearch.slice(0, 3).map((line) => `Evidence: ${line}`)),
      ...(strategy?.prospectTruth?.evidence.slice(0, 4).map(
        (row) => `${row.source}: ${row.detail}`,
      ) ?? []),
      strategy?.relationshipStage || strategy?.prospectTruth?.relationshipStage
        ? `Relationship stage: ${strategy?.relationshipStage ?? strategy?.prospectTruth?.relationshipStage}`
        : null,
    ].filter((line): line is string => Boolean(line)),
    conversationStrategy: [
      strategy?.conversationJustification
        ? `Justification: ${strategy.conversationJustification}`
        : null,
      strategy?.conversationStrategy?.whyThisCompany
        ? `Why this company: ${strategy.conversationStrategy.whyThisCompany}`
        : null,
      strategy?.conversationStrategy?.whyThisPerson
        ? `Why this person: ${strategy.conversationStrategy.whyThisPerson}`
        : null,
      strategy?.conversationStrategy?.whyNow
        ? `Why now: ${strategy.conversationStrategy.whyNow}`
        : null,
      strategy?.conversationStrategy?.whySeller
        ? `Why seller: ${strategy.conversationStrategy.whySeller}`
        : null,
      strategy?.conversationStrategy?.whyThisConversation
        ? `Why this conversation: ${strategy.conversationStrategy.whyThisConversation}`
        : strategy?.recommendedConversation
          ? `Why this conversation: ${strategy.recommendedConversation}`
          : null,
      strategy?.conversationStrategy?.businessOutcomeThatMatters
        ? `Outcome that matters: ${strategy.conversationStrategy.businessOutcomeThatMatters}`
        : null,
      ...(strategy?.conversationStrategy?.doNotDiscuss.slice(0, 3).map(
        (line) => `Do not discuss: ${line}`,
      ) ?? []),
    ].filter((line): line is string => Boolean(line)),
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
      hasDecisionMaker: Boolean(name),
      hasEmail: Boolean(email),
      hasPhone: Boolean(phone),
      contactSource,
    }),
    salesStrategy: strategy,
    knowledgeLayers,
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
      supportingEvidence: [
        ...(strategy?.evidence.map((row) => `${row.source}: ${row.detail}`) ?? []),
        ...pkg.supportingResearch.slice(0, 6),
        ...personalization.slice(0, 3),
      ].slice(0, 10),
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
