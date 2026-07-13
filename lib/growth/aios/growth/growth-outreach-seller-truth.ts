/**
 * GE-AIOS-SALES-PLAYBOOK-1B — Seller truth + conversation strategy (client-safe).
 * Canonical seller SoT = Approved Business Profile (+ Business Strategy).
 * BI / Org Knowledge / Knowledge Center / Industry Playbooks enrich only.
 * Never invents a second seller knowledge store.
 */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type {
  EquipifyBuyerPersonaKnowledge,
  EquipifyIndustryKnowledge,
} from "@/lib/growth/business-profile/equipify-master-knowledge-types"
import type { BusinessStrategyContent } from "@/lib/growth/training/growth-business-strategy-types"
import { resolveBusinessStrategyContent } from "@/lib/growth/training/growth-business-strategy-types"
import type { GrowthIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-types"
import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"

export const GROWTH_AIOS_SALES_PLAYBOOK_1B_QA_MARKER =
  "ge-aios-sales-playbook-1b-canonical-seller-knowledge-wiring-v1" as const

export type GrowthOutreachEvidenceCitation = {
  source: string
  detail: string
}

export const GROWTH_OUTREACH_RELATIONSHIP_STAGES = [
  "Cold",
  "Aware",
  "Interested",
  "Engaged",
  "Meeting Scheduled",
  "Customer",
  "Dormant",
  "Lost",
] as const

export type GrowthOutreachRelationshipStage =
  (typeof GROWTH_OUTREACH_RELATIONSHIP_STAGES)[number]

export type GrowthOutreachSellerTruth = {
  source: "approved_business_profile" | "fallback_defaults"
  profileId: string | null
  sellerCompanyName: string | null
  companyIdentity: string | null
  productsServices: string[]
  primaryValueProposition: string | null
  elevatorPitch: string | null
  idealCustomerProfile: string[]
  disqualifiers: string[]
  industries: string[]
  differentiators: string[]
  positioning: string[]
  mission: string | null
  vision: string | null
  salesPhilosophy: string[]
  discoveryQuestions: string[]
  objections: Array<{ objection: string; response: string }>
  ctaPreferences: string[]
  messagingAngles: string[]
  wordsToAvoid: string[]
  neverSay: string[]
  competitiveNotes: string[]
  businessOutcomes: string[]
  tonePreference: string | null
  enrichments: {
    fromBusinessIntelligence: string[]
    fromOrganizationalKnowledge: string[]
    fromKnowledgeCenter: string[]
    fromIndustryPlaybook: string[]
  }
  industryPlaybookUsedAsFallback: boolean
  biUsedAsEnrichmentOnly: boolean
  /** MASTER-KNOWLEDGE-1A — enriched canonical knowledge projection (from profile_json). */
  masterKnowledgeVersion?: string | null
  matchedPersona?: string | null
  matchedIndustryKnowledge?: string | null
  currentCapabilities?: string[]
  limitations?: string[]
  whenNotToRecommend?: string[]
  proofPoints?: string[]
  commercialGuidance?: string[]
  buyingPsychology?: string[]
  postponeTopics?: string[]
}

export type GrowthOutreachProspectTruth = {
  companyName: string
  evidence: GrowthOutreachEvidenceCitation[]
  businessProblems: string[]
  decisionMaker: {
    name: string | null
    title: string | null
    whyThisPerson: string
    whyTheyCare: string
  }
  opportunitySummary: string | null
  fitReason: string | null
  assumptions: string[]
  missingEvidence: string[]
  relationshipStage: GrowthOutreachRelationshipStage
}

export type GrowthOutreachConversationStrategy = {
  whyThisCompany: string
  whyThisPerson: string
  whyNow: string
  whySeller: string
  whyThisConversation: string
  conversationJustification: string
  businessOutcomeThatMatters: string
  doNotDiscuss: string[]
  supportingEvidence: string[]
  remainingAssumptions: string[]
  missingInformation: string[]
  conversationThatEarnsReply: string
  relationshipStage: GrowthOutreachRelationshipStage
  /** MASTER-KNOWLEDGE-1A — internal conversation intelligence. */
  postponeTopics?: string[]
  gratefulReplyOutcome?: string
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.replace(/\s+/g, " ") : null
}

function unique(lines: Array<string | null | undefined>, limit = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const c = clean(line)
    if (!c) continue
    const key = c.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
    if (out.length >= limit) break
  }
  return out
}

function fieldText(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) return unique(value, 4).join("; ") || null
  return clean(value)
}

export function deriveOutreachRelationshipStage(input: {
  relationshipStrengthTier?: string | null
  contactTemperature?: string | null
  leadStatus?: string | null
  hasMeetingScheduled?: boolean
  isCustomer?: boolean
}): GrowthOutreachRelationshipStage {
  const status = (input.leadStatus ?? "").toLowerCase()
  if (input.isCustomer || status === "won" || status === "customer" || status === "converted") {
    return "Customer"
  }
  if (status === "lost" || status === "disqualified") return "Lost"
  if (input.hasMeetingScheduled || status === "meeting_scheduled") return "Meeting Scheduled"
  if (status === "dormant" || status === "nurture") return "Dormant"

  const tier = (input.relationshipStrengthTier ?? "").toLowerCase()
  const temp = (input.contactTemperature ?? "").toLowerCase()

  if (tier === "strategic" || tier === "trusted") return "Engaged"
  if (tier === "active" || temp === "hot" || temp === "engaged") return "Interested"
  if (tier === "developing" || temp === "warming") return "Aware"
  return "Cold"
}

export type BuildSellerTruthInput = {
  profileId?: string | null
  profile?: BusinessProfileDraftContent | null
  sellerCompanyName?: string | null
  biEnrichmentLines?: string[]
  organizationalKnowledge?: OrganizationalKnowledgeItem[]
  knowledgeCenterLines?: string[]
  industryPlaybook?: GrowthIndustryPlaybook | null
  prospectIndustry?: string | null
  prospectTitle?: string | null
}

function matchBuyerPersona(
  title: string | null | undefined,
  personas: EquipifyBuyerPersonaKnowledge[],
): EquipifyBuyerPersonaKnowledge | null {
  const normalized = (title ?? "").toLowerCase()
  if (!normalized) return null
  return (
    personas.find((row) => normalized.includes(row.persona.toLowerCase().split("/")[0].trim())) ??
    personas.find((row) =>
      row.persona
        .toLowerCase()
        .split("/")
        .some((part) => normalized.includes(part.trim())),
    ) ??
    null
  )
}

function matchIndustryKnowledge(
  industry: string | null | undefined,
  industries: EquipifyIndustryKnowledge[],
): EquipifyIndustryKnowledge | null {
  const normalized = (industry ?? "").toLowerCase()
  if (!normalized) return null
  return (
    industries.find((row) => normalized.includes(row.industry.toLowerCase())) ??
    industries.find((row) => row.industry.toLowerCase().includes(normalized)) ??
    null
  )
}

/**
 * Build seller truth from Approved Business Profile.
 * Industry playbook / BI / org knowledge / KC only fill gaps or enrich — never replace profile SoT.
 */
export function buildOutreachSellerTruth(input: BuildSellerTruthInput): GrowthOutreachSellerTruth {
  const profile = input.profile ?? null
  const strategy: BusinessStrategyContent | null = profile?.businessStrategy
    ? resolveBusinessStrategyContent(profile.businessStrategy)
    : null

  const hasProfile = Boolean(profile)
  const primaryValueProposition = clean(profile?.company.primaryValueProposition)
  const elevatorPitch = clean(strategy?.messaging.elevatorPitch)

  const profileObjections =
    strategy?.objections.items
      .map((item) => ({
        objection: clean(item.objection) ?? "",
        response: clean(item.preferredResponse) ?? "",
      }))
      .filter((row) => row.objection && row.response) ?? []

  let messagingAngles = unique(profile?.salesAndMarketing.messagingAngles ?? [], 6)
  const profileDiffs = unique(strategy?.positioning.competitiveAdvantages ?? [], 6)
  const profileCtas = unique(strategy?.messaging.ctaPreferences ?? [], 4)
  const profileDiscovery = unique(strategy?.salesPhilosophy.discoveryQuestions ?? [], 6)

  const playbook = input.industryPlaybook ?? null
  let industryPlaybookUsedAsFallback = false
  const fromIndustryPlaybook: string[] = []

  let objections = profileObjections
  if (objections.length === 0 && playbook?.structuredObjections?.length) {
    industryPlaybookUsedAsFallback = true
    objections = playbook.structuredObjections.slice(0, 4).map((row) => ({
      objection: row.objection,
      response: row.recommendedResponse,
    }))
    fromIndustryPlaybook.push("Objections filled from industry playbook fallback")
  } else if (objections.length === 0 && playbook?.objections?.length) {
    industryPlaybookUsedAsFallback = true
    objections = playbook.objections.slice(0, 3).map((objection) => ({
      objection,
      response: "Acknowledge the concern, then return to the concrete workflow outcome.",
    }))
    fromIndustryPlaybook.push("Objection themes filled from industry playbook fallback")
  }

  let discoveryQuestions = profileDiscovery
  if (discoveryQuestions.length === 0 && playbook?.discoveryQuestions?.length) {
    industryPlaybookUsedAsFallback = true
    discoveryQuestions = playbook.discoveryQuestions.slice(0, 4)
    fromIndustryPlaybook.push("Discovery questions filled from industry playbook fallback")
  }

  let ctaPreferences = profileCtas
  if (ctaPreferences.length === 0 && playbook?.recommendedCtas?.length) {
    industryPlaybookUsedAsFallback = true
    ctaPreferences = playbook.recommendedCtas.slice(0, 3)
    fromIndustryPlaybook.push("CTA preferences filled from industry playbook fallback")
  }

  let differentiators = profileDiffs
  if (differentiators.length === 0 && playbook?.capabilityMappings?.length) {
    industryPlaybookUsedAsFallback = true
    differentiators = playbook.capabilityMappings
      .slice(0, 3)
      .map((row) => `${row.capability} → ${row.equipifyModule}`)
    fromIndustryPlaybook.push("Differentiators filled from industry capability mappings")
  }

  const orgKnowledge = (input.organizationalKnowledge ?? [])
    .filter((item) => item.active && !item.superseded_by && item.confidence >= 0.55)
    .filter((item) =>
      ["messaging", "objection", "industry", "pain_point", "persona", "sales_process"].includes(
        item.category,
      ),
    )
    .slice(0, 8)

  const fromOrganizationalKnowledge = orgKnowledge.map(
    (item) => `${item.category}: ${item.finding}`,
  )

  // Org knowledge may enrich messaging/objections only when profile left them thin.
  if (messagingAngles.length === 0) {
    messagingAngles = unique(
      orgKnowledge.filter((row) => row.category === "messaging").map((row) => row.finding),
      6,
    )
  }
  if (objections.length === 0) {
    for (const item of orgKnowledge.filter((row) => row.category === "objection").slice(0, 3)) {
      objections.push({
        objection: item.finding,
        response: "Stay outcome-focused and evidence-backed; do not oversell.",
      })
    }
  }

  const biLines = unique(input.biEnrichmentLines ?? [], 6)
  const kcLines = unique(input.knowledgeCenterLines ?? [], 6)

  // BI fills empty value-prop / differentiator gaps only (enrichment, not SoT).
  let valueProp = primaryValueProposition
  let diffs = differentiators
  if (!valueProp && biLines[0]) {
    valueProp = biLines[0]
  }
  if (diffs.length === 0) {
    diffs = biLines.filter((line) => /differentiator|advantage|unique/i.test(line)).slice(0, 3)
  }

  const disqualifiers = unique(
    [
      ...(profile?.idealCustomers.disqualifiers ?? []),
      ...(strategy?.salesPhilosophy.disqualifiers ?? []),
    ],
    8,
  )

  const canonical = profile?.canonicalSellerKnowledge ?? null
  const matchedPersona = matchBuyerPersona(
    input.prospectTitle,
    canonical?.personas ?? [],
  )
  const matchedIndustry = matchIndustryKnowledge(
    input.prospectIndustry ?? profile?.idealCustomers.targetIndustries?.[0],
    canonical?.industries ?? [],
  )

  if (matchedPersona) {
    messagingAngles = unique(
      [...messagingAngles, ...matchedPersona.preferredLanguage.slice(0, 2)],
      6,
    )
    if (objections.length < 3) {
      for (const objection of matchedPersona.objections.slice(0, 2)) {
        objections.push({
          objection,
          response:
            "Acknowledge the concern, align to their desired business outcome, and keep the next step proportional.",
        })
      }
    }
    if (discoveryQuestions.length < 4) {
      discoveryQuestions = unique(
        [...discoveryQuestions, ...matchedPersona.desiredBusinessOutcomes.slice(0, 2)],
        6,
      )
    }
  }

  if (matchedIndustry) {
    messagingAngles = unique(
      [...messagingAngles, ...matchedIndustry.conversationStarters.slice(0, 1)],
      6,
    )
    if (discoveryQuestions.length < 5) {
      discoveryQuestions = unique(
        [...discoveryQuestions, ...matchedIndustry.discoveryOpportunities.slice(0, 2)],
        6,
      )
    }
  }

  const currentCapabilities =
    canonical?.products.modules
      .filter((row) => row.availability === "current")
      .map((row) => row.feature) ?? []

  const limitations = unique(canonical?.company.limitations ?? [], 6)
  const whenNotToRecommend = unique(canonical?.company.whenNotToRecommend ?? [], 8)
  const proofPoints = unique(
    canonical?.proof.map((row) => `${row.title}: ${row.businessOutcome}`) ?? [],
    4,
  )
  const commercialGuidance = unique(
    canonical
      ? [
          canonical.commercial.pricingPhilosophy,
          canonical.commercial.whenNotToDiscussPricing,
          canonical.commercial.packagingPhilosophy,
        ]
      : [],
    4,
  )
  const buyingPsychology = unique(
    canonical?.buyingPsychology.map(
      (row) => `${row.persona} buys ${row.whyTheyBuy.toLowerCase()}`,
    ) ?? [],
    5,
  )
  const postponeTopics = unique(
    [
      ...(canonical?.products.modules
        .filter((row) => row.availability === "future")
        .map((row) => `Postpone: ${row.feature} (future capability)`) ?? []),
      canonical?.commercial.whenNotToDiscussPricing
        ? "Postpone: specific pricing until workflow scope is understood"
        : null,
      "Postpone: full product tour before confirming the workflow problem",
    ],
    6,
  )

  if (canonical?.company.mission && !valueProp) {
    valueProp = clean(canonical.company.mission)
  }
  if (canonical?.company.differentiators.length && diffs.length === 0) {
    diffs = unique(canonical.company.differentiators, 6)
  }

  return {
    source: hasProfile ? "approved_business_profile" : "fallback_defaults",
    profileId: input.profileId ?? null,
    sellerCompanyName: clean(input.sellerCompanyName) ?? clean(profile?.company.companyName),
    companyIdentity: unique(
      [
        profile?.company.companyName,
        profile?.company.shortDescription,
        profile?.company.businessModel,
      ],
      3,
    ).join(" · ") || null,
    productsServices: unique(profile?.company.productsServices ?? [], 8),
    primaryValueProposition: valueProp,
    elevatorPitch,
    idealCustomerProfile: unique(
      [
        ...(profile?.idealCustomers.buyerPersonas ?? []),
        ...(profile?.idealCustomers.companySizeRanges ?? []).map((row) => `Size: ${row}`),
        ...(profile?.idealCustomers.geography ?? []).map((row) => `Geo: ${row}`),
      ],
      8,
    ),
    disqualifiers,
    industries: unique(profile?.idealCustomers.targetIndustries ?? [], 8),
    differentiators: unique(diffs, 6),
    positioning: unique(
      [
        ...(strategy?.positioning.competitiveAdvantages ?? []),
        ...(strategy?.positioning.competitorNotes ?? []),
        strategy?.positioning.pricingPhilosophy,
      ],
      6,
    ),
    mission: clean(strategy?.companyWide.mission),
    vision: clean(strategy?.companyWide.brandPersonality),
    salesPhilosophy: unique(
      [
        ...(strategy?.salesPhilosophy.qualificationStandards ?? []),
        ...(strategy?.salesAndRelationships.principles ?? []),
        strategy?.salesAndRelationships.notes,
      ],
      8,
    ),
    discoveryQuestions: unique(discoveryQuestions, 6),
    objections: objections.slice(0, 5),
    ctaPreferences: unique(ctaPreferences, 4),
    messagingAngles: unique(messagingAngles, 6),
    wordsToAvoid: unique(strategy?.messaging.wordsToAvoid ?? [], 8),
    neverSay: unique(strategy?.messaging.neverSay ?? [], 8),
    competitiveNotes: unique(
      [
        ...(profile?.problemsAndTriggers.competitorsAlternatives ?? []),
        ...(strategy?.positioning.competitorNotes ?? []),
      ],
      6,
    ),
    businessOutcomes: unique(
      [
        ...(profile?.problemsAndTriggers.painPoints ?? []).map(
          (pain) => `Help customers resolve: ${pain}`,
        ),
        ...(profile?.problemsAndTriggers.buyingTriggers ?? []),
      ],
      6,
    ),
    tonePreference: clean(strategy?.messaging.tone) || (hasProfile ? "consultative" : null),
    enrichments: {
      fromBusinessIntelligence: biLines,
      fromOrganizationalKnowledge,
      fromKnowledgeCenter: kcLines,
      fromIndustryPlaybook,
    },
    industryPlaybookUsedAsFallback,
    biUsedAsEnrichmentOnly: biLines.length > 0,
    masterKnowledgeVersion: canonical?.version ?? null,
    matchedPersona: matchedPersona?.persona ?? null,
    matchedIndustryKnowledge: matchedIndustry?.industry ?? null,
    currentCapabilities,
    limitations,
    whenNotToRecommend,
    proofPoints,
    commercialGuidance,
    buyingPsychology,
    postponeTopics,
  }
}

export function buildOutreachConversationStrategy(input: {
  seller: GrowthOutreachSellerTruth
  prospect: GrowthOutreachProspectTruth
  recommendedConversation: string
  primaryHook: string
}): GrowthOutreachConversationStrategy {
  const seller = input.seller
  const prospect = input.prospect
  const sellerName = seller.sellerCompanyName || "our team"

  const whyThisCompany =
    prospect.fitReason ||
    prospect.opportunitySummary ||
    (prospect.businessProblems[0]
      ? `${prospect.companyName} shows an evidence-backed opening around ${prospect.businessProblems[0].replace(/\.$/, "").toLowerCase()}.`
      : `${prospect.companyName} was selected from research signals that warrant a focused conversation.`)

  const whyThisPerson = prospect.decisionMaker.whyThisPerson

  const whyNow =
    prospect.evidence.find((row) => /hiring|growth|expand|news|trigger/i.test(row.detail))?.detail ||
    (prospect.relationshipStage === "Cold"
      ? "No prior relationship on file — a short, evidence-led first conversation is the lowest-friction next step."
      : `Relationship stage is ${prospect.relationshipStage}; keep the ask proportional and specific.`)

  const whySeller =
    seller.elevatorPitch ||
    seller.primaryValueProposition ||
    seller.differentiators[0] ||
    `${sellerName} helps equipment and field-service teams run clearer service operations — outcomes over features.`

  const businessOutcomeThatMatters =
    prospect.businessProblems[0] ||
    seller.businessOutcomes[0] ||
    "Clarify whether a tighter service workflow would reduce avoidable friction."

  const conversationJustification = [
    `If there is only one chance to earn a reply from ${prospect.decisionMaker.name ?? "this contact"},`,
    `the conversation should be about ${businessOutcomeThatMatters.replace(/\.$/, "").toLowerCase()}`,
    `— grounded in ${prospect.evidence[0]?.detail ? "observed evidence" : "the research on file"}`,
    `and whether ${sellerName} is relevant to that outcome.`,
  ].join(" ")

  const doNotDiscussBase = unique(
    [
      ...seller.neverSay.map((line) => `Never say: ${line}`),
      ...seller.wordsToAvoid.map((line) => `Avoid wording: ${line}`),
      ...seller.disqualifiers.map((line) => `Do not pursue if: ${line}`),
      ...(seller.whenNotToRecommend ?? []).map((line) => `Poor fit when: ${line}`),
      "Do not pitch a product tour before confirming the workflow problem.",
      "Do not invent initiatives, tech stack, or pain points not supported by evidence.",
      seller.competitiveNotes[0] ? "Do not lead with competitive attacks." : null,
    ],
    8,
  )
  const doNotDiscuss = unique([...doNotDiscussBase, ...(seller.postponeTopics ?? [])], 12)

  const gratefulReplyOutcome =
    prospect.businessProblems[0] && seller.matchedPersona
      ? `They would be grateful for a concise note that respects their time and connects ${prospect.businessProblems[0].replace(/\.$/, "").toLowerCase()} to a realistic next step — without a feature dump.`
      : prospect.businessProblems[0]
        ? `They would be grateful for a short, evidence-led note about ${prospect.businessProblems[0].replace(/\.$/, "").toLowerCase()} — not a generic platform overview.`
        : "They would be grateful for a respectful, specific reason to reply — not a templated pitch."

  return {
    whyThisCompany,
    whyThisPerson,
    whyNow,
    whySeller,
    whyThisConversation: input.recommendedConversation,
    conversationJustification,
    businessOutcomeThatMatters,
    doNotDiscuss,
    supportingEvidence: unique(
      [
        ...prospect.evidence.map((row) => `${row.source}: ${row.detail}`),
        seller.primaryValueProposition,
        ...seller.enrichments.fromKnowledgeCenter.slice(0, 2),
      ],
      8,
    ),
    remainingAssumptions: unique(prospect.assumptions, 6),
    missingInformation: unique(prospect.missingEvidence, 6),
    conversationThatEarnsReply: input.primaryHook || conversationJustification,
    relationshipStage: prospect.relationshipStage,
    postponeTopics: seller.postponeTopics ?? [],
    gratefulReplyOutcome,
  }
}

/** Extract gap-fill lines from a BI report field without treating BI as SoT. */
export function extractBusinessIntelligenceEnrichmentLines(
  report: {
    sections?: {
      company?: {
        primary_offer?: { value?: string | string[] | null }
        differentiators?: { value?: string | string[] | null }
        services?: { value?: string | string[] | null }
      }
      sales_and_growth?: {
        likely_pain_points?: { value?: string | string[] | null }
        likely_objections?: { value?: string | string[] | null }
      }
      market?: {
        industries_served?: { value?: string | string[] | null }
      }
    }
  } | null,
): string[] {
  if (!report?.sections) return []
  const sections = report.sections
  return unique(
    [
      fieldText(sections.company?.primary_offer?.value)
        ? `Offer: ${fieldText(sections.company?.primary_offer?.value)}`
        : null,
      fieldText(sections.company?.differentiators?.value)
        ? `Differentiators: ${fieldText(sections.company?.differentiators?.value)}`
        : null,
      fieldText(sections.company?.services?.value)
        ? `Services: ${fieldText(sections.company?.services?.value)}`
        : null,
      fieldText(sections.sales_and_growth?.likely_pain_points?.value)
        ? `Likely customer pains: ${fieldText(sections.sales_and_growth?.likely_pain_points?.value)}`
        : null,
      fieldText(sections.sales_and_growth?.likely_objections?.value)
        ? `Likely objections: ${fieldText(sections.sales_and_growth?.likely_objections?.value)}`
        : null,
      fieldText(sections.market?.industries_served?.value)
        ? `Industries: ${fieldText(sections.market?.industries_served?.value)}`
        : null,
    ],
    6,
  )
}
