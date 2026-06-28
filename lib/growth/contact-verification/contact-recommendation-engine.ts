/**
 * GE-IRE-6B — Contact Recommendation Engine (deterministic outreach ranking).
 * Ranks people, not just email patterns. Not a verifier, executor, or LLM system.
 */

import {
  predictContactEngagement,
  resolveContactEngagementScore,
} from "@/lib/growth/contact-verification/contact-engagement-prediction"
import { roundScore } from "@/lib/growth/contact-verification/confidence-signals-core"
import {
  aggregateEmailLearningByDomain,
  type EmailLearningObservation,
} from "@/lib/growth/contact-verification/email-learning"
import {
  deriveCompanyPatternEvidenceFromLearning,
  normalizeIdentityResolutionIndustry,
  resolveEmailIdentity,
  type IdentityCompanyPatternEvidence,
  type IdentityResolutionDependencies,
  type IdentityResolutionHistoricalLearning,
  type IdentityResolutionResult,
} from "@/lib/growth/contact-verification/identity-resolution-engine"
import { verifyEmailNatively } from "@/lib/growth/contact-verification/native-email-verification"
import {
  isDisposableEmailDomain,
  isFreeEmailDomain,
  isRoleEmailLocalPart,
} from "@/lib/growth/import/email-classifiers"
import { isValidGrowthEmailFormat } from "@/lib/growth/import/email-format"
import { normalizeEmail, parseEmailDomain, parseEmailLocalPart } from "@/lib/growth/import/normalize"

export const GROWTH_CONTACT_RECOMMENDATION_ENGINE_QA_MARKER =
  "contact-recommendation-engine-v1" as const

/**
 * Overall contact score (CRE v1):
 *
 * overall =
 *   identity       × 0.20
 * + deliverability × 0.20
 * + authority      × 0.25
 * + accessibility  × 0.15
 * + engagement     × 0.15
 * + relationship   × 0.05
 */
export const CONTACT_RECOMMENDATION_WEIGHTING_MODEL = {
  version: "cre-v1",
  components: {
    identity: 0.2,
    deliverability: 0.2,
    authority: 0.25,
    accessibility: 0.15,
    engagement: 0.15,
    relationship: 0.05,
  },
} as const

export type ContactRecommendationCandidateInput = {
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  jobTitle?: string
  department?: string
  seniority?: string
  linkedinUrl?: string
  phone?: string
  source?: string
  confidence?: number
}

export type ContactRecommendationInput = {
  companyName?: string
  domain?: string
  industry?: string
  contacts: ContactRecommendationCandidateInput[]
  historicalLearning?: EmailLearningObservation[]
  companyPatternEvidence?: IdentityCompanyPatternEvidence | null
  relationshipSignals?: unknown
  buyingCommitteeSignals?: unknown
}

export type ContactRecommendationScores = {
  identity: number
  deliverability: number
  authority: number
  accessibility: number
  engagement: number
  relationship: number
  overall: number
}

export type ContactRecommendation = {
  rank: number
  contact: {
    display_name: string
    first_name?: string
    last_name?: string
    job_title?: string
    department?: string
    seniority?: string
    email?: string
  }
  recommended_email?: string
  scores: ContactRecommendationScores
  confidence: number
  reasons: string[]
  evidence: string[]
  warnings: string[]
}

export type ContactRecommendationResult = {
  qa_marker: typeof GROWTH_CONTACT_RECOMMENDATION_ENGINE_QA_MARKER
  companyName?: string
  domain?: string
  recommended: ContactRecommendation[]
  summary: {
    total_contacts: number
    recommended_count: number
    top_contact?: string
    top_score?: number
    recommendation: string
  }
  warnings: string[]
}

export type ContactRecommendationDependencies = IdentityResolutionDependencies & {
  resolveEmailIdentity?: typeof resolveEmailIdentity
}

type ParsedContact = {
  firstName: string
  lastName: string
  displayName: string
  email: string | null
  jobTitle: string | null
  department: string | null
  seniority: string | null
  linkedinUrl: string | null
  phone: string | null
  source: string | null
  sourceConfidence: number | null
}

type AuthorityTier = "high" | "medium" | "low" | "generic"

export const CONTACT_AUTHORITY_TITLE_RULES: Array<{
  tier: AuthorityTier
  patterns: RegExp[]
  score: number
  label: string
}> = [
  {
    tier: "high",
    score: 0.95,
    label: "Executive / owner authority",
    patterns: [
      /\b(owner|founder|co-founder|cofounder)\b/i,
      /\b(ceo|chief executive)\b/i,
      /\b(president)\b/i,
      /\b(coo|chief operating)\b/i,
      /\b(vp|vice president).*(operations|ops|procurement|facilities|service)\b/i,
      /\b(director).*(operations|ops|procurement|facilities|service)\b/i,
      /\b(general manager|gm)\b/i,
      /\b(procurement)\b/i,
      /\b(facilities manager)\b/i,
    ],
  },
  {
    tier: "medium",
    score: 0.68,
    label: "Manager / supervisor authority",
    patterns: [
      /\b(manager|supervisor|lead|department head|head of)\b/i,
      /\b(operations manager|service manager|plant manager)\b/i,
    ],
  },
  {
    tier: "low",
    score: 0.42,
    label: "Individual contributor",
    patterns: [/\b(coordinator|specialist|technician|analyst|associate)\b/i],
  },
  {
    tier: "generic",
    score: 0.2,
    label: "Generic / low-authority role",
    patterns: [/\b(assistant|intern|administrator|receptionist|clerk)\b/i],
  },
]

const DEPARTMENT_ENGAGEMENT_BOOSTS: Record<string, number> = {
  operations: 0.08,
  procurement: 0.07,
  facilities: 0.06,
  service: 0.05,
  executive: 0.09,
  sales: 0.03,
}

const INDUSTRY_ENGAGEMENT_BASELINE: Record<
  ReturnType<typeof normalizeIdentityResolutionIndustry>,
  number
> = {
  healthcare: 0.58,
  manufacturing: 0.52,
  construction: 0.5,
  software: 0.62,
  government: 0.45,
  education: 0.48,
  professional_services: 0.6,
  default: 0.55,
}

function toConfidencePercent(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.round(Math.max(0, Math.min(100, score * 100)))
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return roundScore(Math.max(0, Math.min(1, value)))
}

function asTrimmed(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function slugPart(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function normalizeDomain(domain: string | null | undefined): string | null {
  const trimmed = asTrimmed(domain)
  if (!trimmed) return null
  return trimmed.toLowerCase().replace(/^www\./, "")
}

function parseContact(input: ContactRecommendationCandidateInput): ParsedContact {
  let firstName = asTrimmed(input.firstName) ?? ""
  let lastName = asTrimmed(input.lastName) ?? ""

  if ((!firstName || !lastName) && asTrimmed(input.fullName)) {
    const parts = input.fullName!.trim().split(/\s+/).filter(Boolean)
    if (!firstName && parts[0]) firstName = parts[0]
    if (!lastName && parts.length > 1) lastName = parts[parts.length - 1] ?? ""
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    asTrimmed(input.fullName) ||
    asTrimmed(input.email) ||
    "Unknown contact"

  return {
    firstName,
    lastName,
    displayName,
    email: normalizeEmail(input.email),
    jobTitle: asTrimmed(input.jobTitle),
    department: asTrimmed(input.department),
    seniority: asTrimmed(input.seniority),
    linkedinUrl: asTrimmed(input.linkedinUrl),
    phone: asTrimmed(input.phone),
    source: asTrimmed(input.source),
    sourceConfidence:
      typeof input.confidence === "number" && Number.isFinite(input.confidence)
        ? clampScore(input.confidence)
        : null,
  }
}

export function buildContactRecommendationHistoricalLearning(input: {
  domain: string
  observations: readonly EmailLearningObservation[]
}): IdentityResolutionHistoricalLearning {
  const domain = normalizeDomain(input.domain) ?? ""
  const stats = aggregateEmailLearningByDomain(input.observations).find((row) => row.domain === domain)
  const domainObservations = input.observations.filter((row) => row.domain === domain)
  const verifiedContacts = new Set(
    domainObservations
      .filter((row) => row.event_type === "manual_verified" && row.normalized_email)
      .map((row) => row.normalized_email as string),
  )

  return {
    domain_reply_rate: stats?.reply_rate ?? null,
    domain_meeting_rate:
      stats && stats.messages_sent > 0 ? clampScore(stats.meetings / stats.messages_sent) : null,
    pattern_success_rates: {},
    verified_contact_count: verifiedContacts.size,
    placeholders: ["relationship_intelligence_placeholder", "reply_prediction_placeholder"],
  }
}

export function resolveCompanyPatternEvidence(input: {
  domain?: string | null
  explicit?: IdentityCompanyPatternEvidence | null
  observations?: readonly EmailLearningObservation[]
}): IdentityCompanyPatternEvidence | null {
  if (input.explicit) return input.explicit
  const domain = normalizeDomain(input.domain)
  if (!domain || !input.observations?.length) return null
  return deriveCompanyPatternEvidenceFromLearning({ domain, observations: input.observations })
}

export function scoreContactAuthority(input: {
  jobTitle?: string | null
  seniority?: string | null
  department?: string | null
}): { score: number; tier: AuthorityTier; reason: string } {
  const title = `${input.jobTitle ?? ""} ${input.seniority ?? ""} ${input.department ?? ""}`.trim()
  if (!title) {
    return { score: 0.45, tier: "low", reason: "Title unavailable — neutral authority assumed" }
  }

  for (const rule of CONTACT_AUTHORITY_TITLE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(title))) {
      return { score: clampScore(rule.score), tier: rule.tier, reason: rule.label }
    }
  }

  if (/\b(director|vp|president|chief|head)\b/i.test(title)) {
    return { score: 0.82, tier: "high", reason: "Leadership title indicates buying authority" }
  }

  return { score: 0.5, tier: "medium", reason: "Standard business title" }
}

export function scoreContactAccessibility(input: {
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  firstName: string
  lastName: string
}): { score: number; reasons: string[]; warnings: string[] } {
  const reasons: string[] = []
  const warnings: string[] = []
  let score = 0.25

  if (input.firstName && input.lastName) {
    score += 0.15
    reasons.push("Complete name available")
  } else if (!input.lastName) {
    warnings.push("Missing last name reduces reachability confidence")
  }

  if (input.email) {
    const local = parseEmailLocalPart(input.email)
    if (isRoleEmailLocalPart(local)) {
      score += 0.05
      warnings.push("Role/generic email reduces direct accessibility")
    } else {
      score += 0.25
      reasons.push("Direct email available")
    }
  } else {
    warnings.push("No direct email on record")
  }

  if (input.phone) {
    score += 0.15
    reasons.push("Phone number available")
  }

  if (input.linkedinUrl) {
    score += 0.12
    reasons.push("LinkedIn profile available")
  }

  if (!input.email && !input.phone && !input.linkedinUrl) {
    warnings.push("No direct outreach channel on record")
    score = Math.min(score, 0.2)
  }

  return { score: clampScore(score), reasons, warnings }
}

export function scoreContactEngagement(input: {
  industry: ReturnType<typeof normalizeIdentityResolutionIndustry>
  jobTitle?: string | null
  department?: string | null
  sourceConfidence?: number | null
  domainReplyRate?: number | null
  ireEngagement?: number | null
}): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = INDUSTRY_ENGAGEMENT_BASELINE[input.industry]
  reasons.push(`${input.industry.replace(/_/g, " ")} industry baseline`)

  if (input.domainReplyRate != null) {
    score = clampScore(score * 0.55 + input.domainReplyRate * 0.45)
    reasons.push("Historical domain reply rate available")
  }

  if (input.ireEngagement != null) {
    score = clampScore(score * 0.65 + input.ireEngagement * 0.35)
    reasons.push("Identity engagement probability considered")
  }

  const departmentKey = slugPart(input.department)
  if (departmentKey && DEPARTMENT_ENGAGEMENT_BOOSTS[departmentKey]) {
    score = clampScore(score + DEPARTMENT_ENGAGEMENT_BOOSTS[departmentKey])
    reasons.push(`${input.department} department historically responsive`)
  }

  if (input.jobTitle && /\b(operations|procurement|facilities|service)\b/i.test(input.jobTitle)) {
    score = clampScore(score + 0.05)
    reasons.push("Operations-facing title aligns with service outreach")
  }

  if (input.sourceConfidence != null) {
    score = clampScore(score * 0.85 + input.sourceConfidence * 0.15)
    reasons.push("Discovery source confidence considered")
  }

  return { score: clampScore(score), reasons }
}

export function scoreContactRelationship(_signals: unknown): { score: number; reason: string } {
  return {
    score: 0.5,
    reason: "Relationship intelligence placeholder — neutral default",
  }
}

function scoreProvidedEmailIdentity(input: {
  email: string
  domain: string | null
  firstName: string
  lastName: string
}): { score: number; reasons: string[]; warnings: string[] } {
  const reasons: string[] = []
  const warnings: string[] = []
  let score = 0.78

  if (!isValidGrowthEmailFormat(input.email)) {
    return { score: 0.15, reasons: ["Provided email failed syntax validation"], warnings }
  }

  reasons.push("Verified/provided email on record")
  score = 0.88

  const emailDomain = parseEmailDomain(input.email)
  if (input.domain && emailDomain === input.domain) {
    score = clampScore(score + 0.06)
    reasons.push("Provided email matches company domain")
  } else if (emailDomain && input.domain && emailDomain !== input.domain) {
    warnings.push("Provided email domain differs from company domain")
    score = clampScore(score - 0.12)
  }

  if (isFreeEmailDomain(emailDomain)) {
    warnings.push("Free email domain on provided address")
    score = clampScore(score - 0.15)
  }
  if (isDisposableEmailDomain(emailDomain)) {
    warnings.push("Disposable email domain on provided address")
    score = 0.1
  }

  const local = parseEmailLocalPart(input.email)
  if (isRoleEmailLocalPart(local)) {
    warnings.push("Provided email appears to be a role account")
    score = clampScore(score - 0.2)
  }

  const first = slugPart(input.firstName)
  const last = slugPart(input.lastName)
  if (first && last && local && (local.includes(first) || local.includes(last))) {
    score = clampScore(score + 0.04)
    reasons.push("Provided email aligns with contact name")
  }

  return { score: clampScore(score), reasons, warnings }
}

async function scoreDeliverabilityForEmail(input: {
  email: string
  dependencies: ContactRecommendationDependencies
}): Promise<{ score: number; evidence: string[]; warnings: string[] }> {
  const result = await verifyEmailNatively(
    { email: input.email, skipDns: input.dependencies.skipDns ?? true },
    input.dependencies.nativeVerificationDependencies,
  )

  const evidence: string[] = []
  const warnings: string[] = []
  let score = clampScore(result.confidence.score)

  if (result.status === "invalid") score = clampScore(score * 0.35)
  if (result.status === "risky") score = clampScore(score * 0.72)
  if (result.business_domain) evidence.push("Business domain")
  if (result.free_email) warnings.push("Free email domain")
  if (result.role_account) warnings.push("Role account pattern")
  if (result.disposable) warnings.push("Disposable domain")

  return { score, evidence, warnings }
}

export function computeContactRecommendationOverallScore(scores: {
  identity: number
  deliverability: number
  authority: number
  accessibility: number
  engagement: number
  relationship: number
}): number {
  const weights = CONTACT_RECOMMENDATION_WEIGHTING_MODEL.components
  return clampScore(
    scores.identity * weights.identity +
      scores.deliverability * weights.deliverability +
      scores.authority * weights.authority +
      scores.accessibility * weights.accessibility +
      scores.engagement * weights.engagement +
      scores.relationship * weights.relationship,
  )
}

function buildSummaryRecommendation(input: {
  top: ContactRecommendation | null
  industry: ReturnType<typeof normalizeIdentityResolutionIndustry>
}): string {
  if (!input.top) return "No contact recommendations available — insufficient candidate data"

  const pct = input.top.confidence
  const title = input.top.contact.job_title ?? "contact"
  return `Prioritize ${input.top.contact.display_name} (${title}) first — ${pct}% overall confidence; strongest blend of authority, identity, and reachability for ${input.industry.replace(/_/g, " ")} outreach`
}

export function buildContactRecommendationExplanation(input: {
  recommendation: ContactRecommendation
  ireResult?: IdentityResolutionResult | null
  ireAlternativeEmail?: string | null
}): { reasons: string[]; evidence: string[] } {
  const reasons = [...input.recommendation.reasons]
  const evidence = [...input.recommendation.evidence]

  if (input.recommendation.recommended_email) {
    evidence.push(`recommended email: ${input.recommendation.recommended_email}`)
  }
  evidence.push(`identity score: ${input.recommendation.scores.identity}`)
  evidence.push(`deliverability score: ${input.recommendation.scores.deliverability}`)
  evidence.push(`authority score: ${input.recommendation.scores.authority}`)

  if (input.ireResult?.recommended?.pattern.display_name) {
    reasons.push(
      `${input.ireResult.recommended.pattern.display_name} pattern matches company evidence`,
    )
  }

  if (
    input.ireAlternativeEmail &&
    input.recommendation.recommended_email &&
    input.ireAlternativeEmail !== input.recommendation.recommended_email
  ) {
    evidence.push(`IRE alternative candidate: ${input.ireAlternativeEmail}`)
  }

  return {
    reasons: [...new Set(reasons)],
    evidence: [...new Set(evidence)],
  }
}

export async function recommendContacts(
  input: ContactRecommendationInput,
  dependencies: ContactRecommendationDependencies = {},
): Promise<ContactRecommendationResult> {
  const warnings: string[] = []
  const industry = normalizeIdentityResolutionIndustry(input.industry)
  const domain =
    normalizeDomain(input.domain) ??
    normalizeDomain(parseEmailDomain(input.contacts.find((row) => row.email)?.email ?? ""))

  if (!domain) warnings.push("company_domain_missing")

  const companyPatternEvidence = resolveCompanyPatternEvidence({
    domain,
    explicit: input.companyPatternEvidence ?? null,
    observations: input.historicalLearning,
  })

  const ireHistoricalLearning =
    domain && input.historicalLearning?.length
      ? buildContactRecommendationHistoricalLearning({
          domain,
          observations: input.historicalLearning,
        })
      : null

  const relationship = scoreContactRelationship(input.relationshipSignals)
  const domainReplyRate = ireHistoricalLearning?.domain_reply_rate ?? null

  const resolveIdentity = dependencies.resolveEmailIdentity ?? resolveEmailIdentity
  const scored: ContactRecommendation[] = []

  for (const candidate of input.contacts) {
    const parsed = parseContact(candidate)
    const contactWarnings: string[] = []
    const reasons: string[] = []
    const evidence: string[] = []

    const authority = scoreContactAuthority({
      jobTitle: parsed.jobTitle,
      seniority: parsed.seniority,
      department: parsed.department,
    })
    reasons.push(authority.reason)

    const accessibility = scoreContactAccessibility({
      email: parsed.email,
      phone: parsed.phone,
      linkedinUrl: parsed.linkedinUrl,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
    })
    reasons.push(...accessibility.reasons)
    contactWarnings.push(...accessibility.warnings)

    let ireResult: IdentityResolutionResult | null = null
    let identityScore = 0.35
    let deliverabilityScore = 0.3
    let ireEngagement: number | null = null
    let recommendedEmail: string | undefined = parsed.email ?? undefined
    let ireAlternativeEmail: string | null = null

    if (parsed.email) {
      const providedIdentity = scoreProvidedEmailIdentity({
        email: parsed.email,
        domain,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
      })
      identityScore = providedIdentity.score
      reasons.push(...providedIdentity.reasons)
      contactWarnings.push(...providedIdentity.warnings)

      const deliverability = await scoreDeliverabilityForEmail({
        email: parsed.email,
        dependencies,
      })
      deliverabilityScore = deliverability.score
      evidence.push(...deliverability.evidence)
      contactWarnings.push(...deliverability.warnings)
    }

    if (domain && parsed.firstName && parsed.lastName) {
      ireResult = await resolveIdentity(
        {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          domain,
          companyName: input.companyName,
          industry: input.industry,
          jobTitle: parsed.jobTitle,
          department: parsed.department,
          knownEmails: parsed.email ? [parsed.email] : [],
          historicalPatterns: companyPatternEvidence,
          historicalLearning: ireHistoricalLearning,
        },
        dependencies,
      )

      if (ireResult.recommended) {
        ireAlternativeEmail = ireResult.recommended.email
        ireEngagement = ireResult.recommended.engagement_probability

        if (!parsed.email) {
          recommendedEmail = ireResult.recommended.email
          identityScore = clampScore(ireResult.recommended.overall_probability)
          deliverabilityScore = clampScore(
            Math.max(deliverabilityScore, ireResult.recommended.deliverability_probability),
          )
          reasons.push("Top IRE identity candidate selected")
          evidence.push(...ireResult.recommended.evidence)
          contactWarnings.push(...ireResult.recommended.warnings)
        } else if (ireResult.recommended.email !== parsed.email) {
          evidence.push(`IRE top candidate differs: ${ireResult.recommended.email}`)
        } else {
          identityScore = clampScore(Math.max(identityScore, ireResult.recommended.overall_probability))
          reasons.push("Provided email matches top IRE identity candidate")
        }
      } else {
        contactWarnings.push("IRE could not generate identity candidates")
      }
    } else if (!parsed.email) {
      contactWarnings.push("Insufficient identity inputs for IRE email resolution")
    }

    const legacyEngagement = scoreContactEngagement({
      industry,
      jobTitle: parsed.jobTitle,
      department: parsed.department,
      sourceConfidence: parsed.sourceConfidence,
      domainReplyRate,
      ireEngagement: null,
    })

    let engagementScore = legacyEngagement.score
    let engagementReasons = [...legacyEngagement.reasons]

    if (input.historicalLearning?.length) {
      const prediction = predictContactEngagement({
        companyName: input.companyName,
        domain,
        industry: input.industry,
        contact: {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          fullName: parsed.displayName,
          email: parsed.email ?? undefined,
          jobTitle: parsed.jobTitle ?? undefined,
          department: parsed.department ?? undefined,
          seniority: parsed.seniority ?? undefined,
          source: parsed.source ?? undefined,
          sourceConfidence: parsed.sourceConfidence ?? undefined,
        },
        historicalLearning: input.historicalLearning,
        relationshipSignals: input.relationshipSignals,
      })
      const resolved = resolveContactEngagementScore({
        prediction,
        legacyScore: legacyEngagement.score,
        ireEngagement,
      })
      engagementScore = resolved.score
      engagementReasons = resolved.reasons
      if (prediction.warnings.length > 0) {
        contactWarnings.push(...prediction.warnings)
      }
      evidence.push(`engagement_tier:${prediction.engagement_tier}`)
    } else {
      if (ireEngagement != null) {
        engagementScore = clampScore(legacyEngagement.score * 0.65 + ireEngagement * 0.35)
        engagementReasons.push("Identity engagement probability considered")
      }
    }

    reasons.push(...engagementReasons)

    const scores: ContactRecommendationScores = {
      identity: identityScore,
      deliverability: deliverabilityScore,
      authority: authority.score,
      accessibility: accessibility.score,
      engagement: engagementScore,
      relationship: relationship.score,
      overall: 0,
    }
    scores.overall = computeContactRecommendationOverallScore(scores)

    const explanation = buildContactRecommendationExplanation({
      recommendation: {
        rank: 0,
        contact: {
          display_name: parsed.displayName,
          first_name: parsed.firstName || undefined,
          last_name: parsed.lastName || undefined,
          job_title: parsed.jobTitle ?? undefined,
          department: parsed.department ?? undefined,
          seniority: parsed.seniority ?? undefined,
          email: parsed.email ?? undefined,
        },
        recommended_email: recommendedEmail,
        scores,
        confidence: toConfidencePercent(scores.overall),
        reasons,
        evidence,
        warnings: contactWarnings,
      },
      ireResult,
      ireAlternativeEmail,
    })

    scored.push({
      rank: 0,
      contact: {
        display_name: parsed.displayName,
        first_name: parsed.firstName || undefined,
        last_name: parsed.lastName || undefined,
        job_title: parsed.jobTitle ?? undefined,
        department: parsed.department ?? undefined,
        seniority: parsed.seniority ?? undefined,
        email: parsed.email ?? undefined,
      },
      recommended_email: recommendedEmail,
      scores,
      confidence: toConfidencePercent(scores.overall),
      reasons: explanation.reasons,
      evidence: explanation.evidence,
      warnings: [...new Set(contactWarnings)],
    })
  }

  scored.sort(
    (a, b) =>
      b.scores.overall - a.scores.overall ||
      b.scores.authority - a.scores.authority ||
      b.scores.deliverability - a.scores.deliverability ||
      a.contact.display_name.localeCompare(b.contact.display_name),
  )

  scored.forEach((row, index) => {
    row.rank = index + 1
  })

  const top = scored[0] ?? null

  return {
    qa_marker: GROWTH_CONTACT_RECOMMENDATION_ENGINE_QA_MARKER,
    companyName: input.companyName,
    domain: domain ?? undefined,
    recommended: scored,
    summary: {
      total_contacts: input.contacts.length,
      recommended_count: scored.length,
      top_contact: top?.contact.display_name,
      top_score: top?.confidence,
      recommendation: buildSummaryRecommendation({ top, industry }),
    },
    warnings: [...new Set(warnings)],
  }
}
