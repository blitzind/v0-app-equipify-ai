/**
 * GE-IRE-6A — Identity Resolution Engine foundation (email resolver v1).
 * Deterministic reasoning only. Not a verifier, provider, or runtime replacement.
 */

import { roundScore } from "@/lib/growth/contact-verification/confidence-signals-core"
import type { EmailLearningObservation } from "@/lib/growth/contact-verification/email-learning"
import { inferEmailLocalPartPattern } from "@/lib/growth/contact-verification/email-learning"
import {
  verifyEmailNatively,
  type NativeEmailVerificationDependencies,
  type NativeEmailVerificationResult,
} from "@/lib/growth/contact-verification/native-email-verification"
import { isValidGrowthEmailFormat } from "@/lib/growth/import/email-format"

export const GROWTH_IDENTITY_RESOLUTION_ENGINE_QA_MARKER = "identity-resolution-engine-v1" as const

/** Future resolver slots — email is the only active resolver in v1. */
export const IDENTITY_RESOLVER_TYPES = [
  "email",
  "phone",
  "linkedin",
  "buying_committee",
  "social",
  "preferred_channel",
] as const

export type IdentityResolverType = (typeof IDENTITY_RESOLVER_TYPES)[number]

export const IDENTITY_EMAIL_PATTERN_IDS = [
  "first_dot_last",
  "first_last_concat",
  "first_underscore_last",
  "first_hyphen_last",
  "first_initial_last",
  "first_initial_dot_last",
  "first_dot_last_initial",
  "first_only",
  "last_only",
  "last_dot_first",
  "last_first_concat",
  "last_first_initial",
] as const

export type IdentityEmailPatternId = (typeof IDENTITY_EMAIL_PATTERN_IDS)[number]

export const IDENTITY_RESOLUTION_INDUSTRIES = [
  "healthcare",
  "manufacturing",
  "construction",
  "software",
  "government",
  "education",
  "professional_services",
  "default",
] as const

export type IdentityResolutionIndustry = (typeof IDENTITY_RESOLUTION_INDUSTRIES)[number]

/**
 * Weighting model (IRE v1) — documented, deterministic, not a simple average.
 *
 * overall =
 *   pattern_probability        × 0.30
 * + deliverability_probability × 0.25
 * + engagement_probability     × 0.20
 * + historical_learning        × 0.15
 * + company_evidence           × 0.07
 * + industry_evidence          × 0.03
 * − conflict_penalty           (up to 0.25; known-email mismatch up to 0.35)
 */
export const IDENTITY_RESOLUTION_WEIGHTING_MODEL = {
  version: "ire-v1",
  components: {
    pattern_probability: 0.3,
    deliverability_probability: 0.25,
    engagement_probability: 0.2,
    historical_learning: 0.15,
    company_evidence: 0.07,
    industry_evidence: 0.03,
  },
  conflict_penalty_max: 0.25,
  known_email_mismatch_penalty: 0.35,
} as const

export type IdentityPatternDefinition = {
  id: IdentityEmailPatternId
  display_name: string
  example: string
  generator: (parts: { first: string; last: string; domain: string }) => string | null
  default_confidence: number
  evidence: string[]
}

export type IdentityCompanyPatternEvidence = {
  domain: string
  total_verified: number
  pattern_counts: Partial<Record<IdentityEmailPatternId, number>>
  dominant_pattern: IdentityEmailPatternId | null
  dominant_share: number | null
}

export type IdentityResolutionHistoricalLearning = {
  domain_reply_rate: number | null
  domain_meeting_rate: number | null
  pattern_success_rates: Partial<Record<IdentityEmailPatternId, number>>
  verified_contact_count: number
  placeholders: string[]
}

export type IdentityResolutionInput = {
  firstName: string
  lastName: string
  domain: string
  companyName?: string | null
  industry?: string | null
  jobTitle?: string | null
  department?: string | null
  knownEmails?: string[]
  historicalPatterns?: IdentityCompanyPatternEvidence | null
  historicalLearning?: IdentityResolutionHistoricalLearning | null
}

export type IdentityResolutionPatternRef = {
  id: IdentityEmailPatternId
  display_name: string
  example: string
}

export type IdentityResolutionCandidate = {
  resolver_type: "email"
  pattern: IdentityResolutionPatternRef
  email: string
  pattern_probability: number
  deliverability_probability: number
  engagement_probability: number
  historical_learning_score: number
  company_evidence_score: number
  industry_evidence_score: number
  conflict_penalty: number
  overall_probability: number
  rank: number
  confidence: "low" | "medium" | "high" | "excellent"
  reasons: string[]
  evidence: string[]
  warnings: string[]
}

export type IdentityResolutionExplanation = {
  recommended_email: string | null
  overall_probability: number | null
  pattern_probability: number | null
  deliverability_probability: number | null
  engagement_probability: number | null
  evidence_bullets: string[]
  warnings: string[]
}

export type IdentityResolutionResult = {
  qa_marker: typeof GROWTH_IDENTITY_RESOLUTION_ENGINE_QA_MARKER
  resolver_type: "email"
  active_resolvers: IdentityResolverType[]
  weighting_model: typeof IDENTITY_RESOLUTION_WEIGHTING_MODEL
  input_summary: {
    domain: string
    first_name_present: boolean
    last_name_present: boolean
    company_name_present: boolean
    industry: IdentityResolutionIndustry
  }
  candidates: IdentityResolutionCandidate[]
  recommended: IdentityResolutionCandidate | null
  explanation: IdentityResolutionExplanation
  warnings: string[]
}

export type IdentityResolutionDependencies = {
  verifyEmailNatively?: (
    input: Parameters<typeof verifyEmailNatively>[0],
    dependencies?: NativeEmailVerificationDependencies,
  ) => Promise<NativeEmailVerificationResult>
  nativeVerificationDependencies?: NativeEmailVerificationDependencies
  skipDns?: boolean
}

type NameParts = {
  first: string
  last: string
  fi: string
  li: string
  domain: string
}

const PATTERN_LIBRARY: IdentityPatternDefinition[] = [
  {
    id: "first_dot_last",
    display_name: "firstname.lastname",
    example: "john.smith@company.com",
    generator: ({ first, last, domain }) => `${first}.${last}@${domain}`,
    default_confidence: 0.34,
    evidence: ["Most common B2B convention"],
  },
  {
    id: "first_last_concat",
    display_name: "firstlast",
    example: "johnsmith@company.com",
    generator: ({ first, last, domain }) => `${first}${last}@${domain}`,
    default_confidence: 0.18,
    evidence: ["Common compact pattern"],
  },
  {
    id: "first_underscore_last",
    display_name: "first_last",
    example: "john_smith@company.com",
    generator: ({ first, last, domain }) => `${first}_${last}@${domain}`,
    default_confidence: 0.08,
    evidence: ["Used by some enterprise IT policies"],
  },
  {
    id: "first_hyphen_last",
    display_name: "first-last",
    example: "john-smith@company.com",
    generator: ({ first, last, domain }) => `${first}-${last}@${domain}`,
    default_confidence: 0.07,
    evidence: ["Seen in regulated industries"],
  },
  {
    id: "first_initial_last",
    display_name: "flast",
    example: "jsmith@company.com",
    generator: ({ first, last, domain }) => `${first[0] ?? ""}${last}@${domain}`,
    default_confidence: 0.12,
    evidence: ["Initial + last name pattern"],
  },
  {
    id: "first_initial_dot_last",
    display_name: "f.last",
    example: "j.smith@company.com",
    generator: ({ first, last, domain }) => `${first[0] ?? ""}.${last}@${domain}`,
    default_confidence: 0.1,
    evidence: ["Initial dot last pattern"],
  },
  {
    id: "first_dot_last_initial",
    display_name: "first.l",
    example: "john.s@company.com",
    generator: ({ first, last, domain }) => `${first}.${last[0] ?? ""}@${domain}`,
    default_confidence: 0.06,
    evidence: ["First name plus last initial"],
  },
  {
    id: "first_only",
    display_name: "first",
    example: "john@company.com",
    generator: ({ first, domain }) => `${first}@${domain}`,
    default_confidence: 0.05,
    evidence: ["Small-company first-name inbox"],
  },
  {
    id: "last_only",
    display_name: "last",
    example: "smith@company.com",
    generator: ({ last, domain }) => `${last}@${domain}`,
    default_confidence: 0.04,
    evidence: ["Rare last-name-only inbox"],
  },
  {
    id: "last_dot_first",
    display_name: "lastname.firstname",
    example: "smith.john@company.com",
    generator: ({ first, last, domain }) => `${last}.${first}@${domain}`,
    default_confidence: 0.03,
    evidence: ["European / legacy directory style"],
  },
  {
    id: "last_first_concat",
    display_name: "lastnamefirst",
    example: "smithjohn@company.com",
    generator: ({ first, last, domain }) => `${last}${first}@${domain}`,
    default_confidence: 0.02,
    evidence: ["Reverse concat pattern"],
  },
  {
    id: "last_first_initial",
    display_name: "lastf",
    example: "smithj@company.com",
    generator: ({ first, last, domain }) => `${last}${first[0] ?? ""}@${domain}`,
    default_confidence: 0.02,
    evidence: ["Reverse initial pattern"],
  },
]

const INDUSTRY_PATTERN_BOOSTS: Record<
  IdentityResolutionIndustry,
  Partial<Record<IdentityEmailPatternId, number>>
> = {
  healthcare: {
    first_dot_last: 0.12,
    first_hyphen_last: 0.04,
    first_initial_last: 0.03,
  },
  manufacturing: {
    first_dot_last: 0.1,
    first_initial_last: 0.08,
    first_last_concat: 0.05,
  },
  construction: {
    first_initial_last: 0.1,
    first_dot_last: 0.08,
    first_only: 0.04,
  },
  software: {
    first_dot_last: 0.08,
    first_last_concat: 0.08,
    first_only: 0.05,
  },
  government: {
    first_dot_last: 0.1,
    first_underscore_last: 0.06,
    last_dot_first: 0.04,
  },
  education: {
    first_dot_last: 0.09,
    first_initial_last: 0.07,
    last_dot_first: 0.04,
  },
  professional_services: {
    first_dot_last: 0.11,
    first_initial_dot_last: 0.06,
    first_last_concat: 0.04,
  },
  default: {
    first_dot_last: 0.08,
    first_last_concat: 0.04,
  },
}

const INDUSTRY_ENGAGEMENT_BASELINE: Record<IdentityResolutionIndustry, number> = {
  healthcare: 0.58,
  manufacturing: 0.52,
  construction: 0.5,
  software: 0.62,
  government: 0.45,
  education: 0.48,
  professional_services: 0.6,
  default: 0.55,
}

const EXECUTIVE_TITLE_PATTERN = /\b(ceo|cfo|cto|coo|cmo|chief|president|vp|vice president|director|head|owner|founder|partner)\b/i

function slugPart(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0
  return roundScore(Math.max(0, Math.min(1, value)))
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "")
}

export function normalizeIdentityResolutionIndustry(
  raw: string | null | undefined,
): IdentityResolutionIndustry {
  const normalized = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  if ((IDENTITY_RESOLUTION_INDUSTRIES as readonly string[]).includes(normalized)) {
    return normalized as IdentityResolutionIndustry
  }

  if (/health|medical|hospital|biomedical|pharma/.test(normalized)) return "healthcare"
  if (/manufactur|industrial|factory/.test(normalized)) return "manufacturing"
  if (/construct|builder|contractor/.test(normalized)) return "construction"
  if (/software|saas|tech|technology|it/.test(normalized)) return "software"
  if (/government|public sector|municipal|federal|state/.test(normalized)) return "government"
  if (/education|school|university|college|academic/.test(normalized)) return "education"
  if (/consult|legal|account|professional|services|agency/.test(normalized)) {
    return "professional_services"
  }

  return "default"
}

function mapLearningPatternToIdentityPattern(
  pattern: ReturnType<typeof inferEmailLocalPartPattern>,
): IdentityEmailPatternId | null {
  const map: Partial<Record<ReturnType<typeof inferEmailLocalPartPattern>, IdentityEmailPatternId>> = {
    first_dot_last: "first_dot_last",
    first_last_concat: "first_last_concat",
    first_initial_last: "first_initial_last",
    first_only: "first_only",
    first_initial_dot_last: "first_initial_dot_last",
    first_dot_last_initial: "first_dot_last_initial",
    last_only: "last_only",
  }
  return map[pattern] ?? null
}

export function deriveCompanyPatternEvidenceFromLearning(input: {
  domain: string
  observations: readonly EmailLearningObservation[]
}): IdentityCompanyPatternEvidence {
  const domain = normalizeDomain(input.domain)
  const verifiedOutcomes = new Set(["manual_verified", "delivered", "replied", "positive_reply", "meeting_booked"])
  const patternCounts: Partial<Record<IdentityEmailPatternId, number>> = {}
  let totalVerified = 0

  for (const observation of input.observations) {
    if (observation.domain !== domain) continue
    if (!verifiedOutcomes.has(observation.event_type)) continue
    if (!observation.email_pattern) continue
    const mapped = mapLearningPatternToIdentityPattern(observation.email_pattern)
    if (!mapped) continue
    totalVerified += 1
    patternCounts[mapped] = (patternCounts[mapped] ?? 0) + 1
  }

  const dominant = [...Object.entries(patternCounts)].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]

  return {
    domain,
    total_verified: totalVerified,
    pattern_counts: patternCounts,
    dominant_pattern: (dominant?.[0] as IdentityEmailPatternId | undefined) ?? null,
    dominant_share: dominant && totalVerified > 0 ? roundScore(dominant[1] / totalVerified) : null,
  }
}

export function buildCompanyPatternEvidenceFromCounts(input: {
  domain: string
  pattern_counts: Partial<Record<IdentityEmailPatternId, number>>
}): IdentityCompanyPatternEvidence {
  const total = Object.values(input.pattern_counts).reduce((sum, count) => sum + (count ?? 0), 0)
  const dominant = [...Object.entries(input.pattern_counts)].sort(
    (a, b) => (b[1] ?? 0) - (a[1] ?? 0) || a[0].localeCompare(b[0]),
  )[0]

  return {
    domain: normalizeDomain(input.domain),
    total_verified: total,
    pattern_counts: input.pattern_counts,
    dominant_pattern: (dominant?.[0] as IdentityEmailPatternId | undefined) ?? null,
    dominant_share: dominant && total > 0 ? roundScore((dominant[1] ?? 0) / total) : null,
  }
}

function resolveNameParts(input: IdentityResolutionInput): NameParts | null {
  const domain = normalizeDomain(input.domain)
  const first = slugPart(input.firstName)
  const last = slugPart(input.lastName)
  if (!domain || !domain.includes(".") || !first || !last) return null
  return { first, last, fi: first[0] ?? "", li: last[0] ?? "", domain }
}

export function generateIdentityEmailCandidates(
  input: IdentityResolutionInput,
): Array<{ pattern: IdentityPatternDefinition; email: string }> {
  const parts = resolveNameParts(input)
  if (!parts) return []

  const seen = new Set<string>()
  const candidates: Array<{ pattern: IdentityPatternDefinition; email: string }> = []

  for (const pattern of PATTERN_LIBRARY) {
    const raw = pattern.generator(parts)
    if (!raw) continue
    const email = raw.trim().toLowerCase()
    if (!isValidGrowthEmailFormat(email) || seen.has(email)) continue
    seen.add(email)
    candidates.push({ pattern, email })
  }

  return candidates.sort((a, b) => a.email.localeCompare(b.email))
}

function scorePatternProbability(input: {
  patternId: IdentityEmailPatternId
  companyEvidence: IdentityCompanyPatternEvidence | null
  industry: IdentityResolutionIndustry
}): { score: number; evidence: string[] } {
  const definition = PATTERN_LIBRARY.find((row) => row.id === input.patternId)
  const evidence = [...(definition?.evidence ?? [])]
  let score = definition?.default_confidence ?? 0.05

  if (input.companyEvidence && input.companyEvidence.total_verified > 0) {
    const count = input.companyEvidence.pattern_counts[input.patternId] ?? 0
    const share = count / input.companyEvidence.total_verified
    if (share > 0) {
      score = clampProbability(score * 0.25 + share * 0.75)
      evidence.push(
        `${roundScore(share * 100)}% of company emails follow ${definition?.display_name ?? input.patternId}`,
      )
    }
    if (input.companyEvidence.dominant_pattern === input.patternId) {
      score = clampProbability(score + 0.08)
      evidence.push("Dominant company email pattern")
    }
  }

  const industryBoost = INDUSTRY_PATTERN_BOOSTS[input.industry][input.patternId] ?? 0
  if (industryBoost > 0) {
    score = clampProbability(score + industryBoost * 0.5)
    evidence.push(`Common ${input.industry.replace(/_/g, " ")} convention`)
  }

  return { score: clampProbability(score), evidence }
}

function mapNativeStatusToDeliverability(result: NativeEmailVerificationResult): number {
  const base = clampProbability(result.confidence.score)
  if (result.status === "invalid") return clampProbability(base * 0.35)
  if (result.status === "risky") return clampProbability(base * 0.72)
  if (result.status === "unknown") return clampProbability(base * 0.82)
  return base
}

async function scoreDeliverability(input: {
  email: string
  dependencies: IdentityResolutionDependencies
}): Promise<{ score: number; evidence: string[]; warnings: string[] }> {
  const verify = input.dependencies.verifyEmailNatively ?? verifyEmailNatively
  const result = await verify(
    { email: input.email, skipDns: input.dependencies.skipDns ?? true },
    input.dependencies.nativeVerificationDependencies,
  )

  const evidence: string[] = []
  const warnings: string[] = []

  if (result.syntax_valid) evidence.push("Syntax valid")
  if (result.business_domain) evidence.push("Business domain")
  if (result.free_email) evidence.push("Free email domain detected")
  if (result.role_account) evidence.push("Role account pattern")
  if (result.disposable) warnings.push("Disposable domain detected")
  if (result.mx_checked && result.mx_exists) evidence.push("MX records present")
  if (result.spf_present) evidence.push("SPF present")
  if (result.dmarc_present) evidence.push("DMARC present")
  if (!result.mx_checked && (input.dependencies.skipDns ?? true)) {
    evidence.push("Native verification confidence (DNS skipped)")
  } else {
    evidence.push("Native verification confidence high")
  }

  return {
    score: mapNativeStatusToDeliverability(result),
    evidence,
    warnings,
  }
}

function scoreEngagement(input: {
  patternId: IdentityEmailPatternId
  industry: IdentityResolutionIndustry
  jobTitle?: string | null
  historicalLearning: IdentityResolutionHistoricalLearning | null
}): { score: number; evidence: string[] } {
  const evidence: string[] = []
  let score = INDUSTRY_ENGAGEMENT_BASELINE[input.industry]

  if (input.historicalLearning?.domain_reply_rate != null) {
    score = clampProbability(score * 0.55 + input.historicalLearning.domain_reply_rate * 0.45)
    evidence.push("Historical domain reply rate available")
  } else {
    evidence.push("Industry engagement baseline")
    input.historicalLearning?.placeholders.forEach((item) => evidence.push(item))
  }

  const patternSuccess = input.historicalLearning?.pattern_success_rates[input.patternId]
  if (patternSuccess != null) {
    score = clampProbability(score * 0.7 + patternSuccess * 0.3)
    evidence.push("Pattern success history")
  }

  if (input.jobTitle && EXECUTIVE_TITLE_PATTERN.test(input.jobTitle)) {
    score = clampProbability(score + 0.06)
    evidence.push("Executive / decision-maker title")
  }

  if ((input.historicalLearning?.verified_contact_count ?? 0) > 0) {
    score = clampProbability(score + 0.03)
    evidence.push("Verified company contacts on record")
  }

  return { score: clampProbability(score), evidence }
}

function scoreHistoricalLearning(input: {
  patternId: IdentityEmailPatternId
  historicalLearning: IdentityResolutionHistoricalLearning | null
}): number {
  if (!input.historicalLearning) return 0.5
  const patternRate = input.historicalLearning.pattern_success_rates[input.patternId]
  if (patternRate != null) return clampProbability(patternRate)
  if (input.historicalLearning.verified_contact_count > 0) return 0.62
  return 0.5
}

function scoreCompanyEvidence(input: {
  patternId: IdentityEmailPatternId
  companyEvidence: IdentityCompanyPatternEvidence | null
}): number {
  if (!input.companyEvidence || input.companyEvidence.total_verified <= 0) return 0.5
  const count = input.companyEvidence.pattern_counts[input.patternId] ?? 0
  return clampProbability(count / input.companyEvidence.total_verified)
}

function scoreIndustryEvidence(input: {
  patternId: IdentityEmailPatternId
  industry: IdentityResolutionIndustry
}): number {
  const boost = INDUSTRY_PATTERN_BOOSTS[input.industry][input.patternId] ?? 0
  return clampProbability(0.45 + boost)
}

function computeConflictPenalty(input: {
  email: string
  knownEmails: string[]
}): { penalty: number; reasons: string[] } {
  const reasons: string[] = []
  if (input.knownEmails.length === 0) {
    return { penalty: 0, reasons }
  }

  const normalizedKnown = new Set(input.knownEmails.map((email) => email.trim().toLowerCase()))
  if (normalizedKnown.has(input.email.trim().toLowerCase())) {
    return { penalty: 0, reasons: ["Matches known company email"] }
  }

  reasons.push("Generated email differs from known company emails")
  return {
    penalty: IDENTITY_RESOLUTION_WEIGHTING_MODEL.known_email_mismatch_penalty,
    reasons,
  }
}

export function computeIdentityResolutionOverallProbability(input: {
  pattern_probability: number
  deliverability_probability: number
  engagement_probability: number
  historical_learning_score: number
  company_evidence_score: number
  industry_evidence_score: number
  conflict_penalty: number
}): number {
  const weights = IDENTITY_RESOLUTION_WEIGHTING_MODEL.components
  const raw =
    input.pattern_probability * weights.pattern_probability +
    input.deliverability_probability * weights.deliverability_probability +
    input.engagement_probability * weights.engagement_probability +
    input.historical_learning_score * weights.historical_learning +
    input.company_evidence_score * weights.company_evidence +
    input.industry_evidence_score * weights.industry_evidence -
    Math.min(
      input.conflict_penalty,
      IDENTITY_RESOLUTION_WEIGHTING_MODEL.conflict_penalty_max +
        IDENTITY_RESOLUTION_WEIGHTING_MODEL.known_email_mismatch_penalty,
    )

  return clampProbability(raw)
}

function confidenceTier(score: number): IdentityResolutionCandidate["confidence"] {
  if (score >= 0.9) return "excellent"
  if (score >= 0.75) return "high"
  if (score >= 0.55) return "medium"
  return "low"
}

export function buildIdentityResolutionExplanation(input: {
  recommended: IdentityResolutionCandidate | null
  companyEvidence: IdentityCompanyPatternEvidence | null
  industry: IdentityResolutionIndustry
}): IdentityResolutionExplanation {
  if (!input.recommended) {
    return {
      recommended_email: null,
      overall_probability: null,
      pattern_probability: null,
      deliverability_probability: null,
      engagement_probability: null,
      evidence_bullets: [],
      warnings: ["No identity candidates could be generated"],
    }
  }

  const bullets = [
    ...input.recommended.evidence,
    ...input.recommended.reasons,
  ]

  if (input.companyEvidence?.dominant_share != null && input.companyEvidence.dominant_pattern) {
    bullets.push(
      `${roundScore(input.companyEvidence.dominant_share * 100)}% of company emails follow ${input.companyEvidence.dominant_pattern.replace(/_/g, ".")}`,
    )
    bullets.push("Historical company learning agrees")
  }

  bullets.push(`Common ${input.industry.replace(/_/g, " ")} convention`)

  if (input.recommended.conflict_penalty <= 0) {
    bullets.push("No conflicting evidence")
  }

  return {
    recommended_email: input.recommended.email,
    overall_probability: input.recommended.overall_probability,
    pattern_probability: input.recommended.pattern_probability,
    deliverability_probability: input.recommended.deliverability_probability,
    engagement_probability: input.recommended.engagement_probability,
    evidence_bullets: [...new Set(bullets)],
    warnings: input.recommended.warnings,
  }
}

export async function resolveEmailIdentity(
  input: IdentityResolutionInput,
  dependencies: IdentityResolutionDependencies = {},
): Promise<IdentityResolutionResult> {
  const warnings: string[] = []
  const industry = normalizeIdentityResolutionIndustry(input.industry)
  const domain = normalizeDomain(input.domain)
  const resolvedCompanyEvidence = input.historicalPatterns ?? null

  const generated = generateIdentityEmailCandidates(input)
  if (generated.length === 0) {
    warnings.push("missing_or_invalid_name_parts")
    return {
      qa_marker: GROWTH_IDENTITY_RESOLUTION_ENGINE_QA_MARKER,
      resolver_type: "email",
      active_resolvers: ["email"],
      weighting_model: IDENTITY_RESOLUTION_WEIGHTING_MODEL,
      input_summary: {
        domain,
        first_name_present: Boolean(slugPart(input.firstName)),
        last_name_present: Boolean(slugPart(input.lastName)),
        company_name_present: Boolean(input.companyName?.trim()),
        industry,
      },
      candidates: [],
      recommended: null,
      explanation: buildIdentityResolutionExplanation({
        recommended: null,
        companyEvidence: resolvedCompanyEvidence,
        industry,
      }),
      warnings,
    }
  }

  const knownEmails = (input.knownEmails ?? []).map((email) => email.trim().toLowerCase())
  const scored: IdentityResolutionCandidate[] = []

  for (const candidate of generated) {
    const patternScore = scorePatternProbability({
      patternId: candidate.pattern.id,
      companyEvidence: resolvedCompanyEvidence,
      industry,
    })
    const deliverability = await scoreDeliverability({ email: candidate.email, dependencies })
    const engagement = scoreEngagement({
      patternId: candidate.pattern.id,
      industry,
      jobTitle: input.jobTitle,
      historicalLearning: input.historicalLearning ?? null,
    })
    const historicalLearningScore = scoreHistoricalLearning({
      patternId: candidate.pattern.id,
      historicalLearning: input.historicalLearning ?? null,
    })
    const companyEvidenceScore = scoreCompanyEvidence({
      patternId: candidate.pattern.id,
      companyEvidence: resolvedCompanyEvidence,
    })
    const industryEvidenceScore = scoreIndustryEvidence({
      patternId: candidate.pattern.id,
      industry,
    })
    const conflict = computeConflictPenalty({
      email: candidate.email,
      knownEmails,
    })

    const overall = computeIdentityResolutionOverallProbability({
      pattern_probability: patternScore.score,
      deliverability_probability: deliverability.score,
      engagement_probability: engagement.score,
      historical_learning_score: historicalLearningScore,
      company_evidence_score: companyEvidenceScore,
      industry_evidence_score: industryEvidenceScore,
      conflict_penalty: conflict.penalty,
    })

    scored.push({
      resolver_type: "email",
      pattern: {
        id: candidate.pattern.id,
        display_name: candidate.pattern.display_name,
        example: candidate.pattern.example,
      },
      email: candidate.email,
      pattern_probability: patternScore.score,
      deliverability_probability: deliverability.score,
      engagement_probability: engagement.score,
      historical_learning_score: historicalLearningScore,
      company_evidence_score: companyEvidenceScore,
      industry_evidence_score: industryEvidenceScore,
      conflict_penalty: conflict.penalty,
      overall_probability: overall,
      rank: 0,
      confidence: confidenceTier(overall),
      reasons: [...patternScore.evidence, ...conflict.reasons],
      evidence: [...deliverability.evidence, ...engagement.evidence],
      warnings: deliverability.warnings,
    })
  }

  scored.sort(
    (a, b) =>
      b.overall_probability - a.overall_probability ||
      a.email.localeCompare(b.email) ||
      a.pattern.id.localeCompare(b.pattern.id),
  )
  scored.forEach((candidate, index) => {
    candidate.rank = index + 1
  })

  const recommended = scored[0] ?? null

  return {
    qa_marker: GROWTH_IDENTITY_RESOLUTION_ENGINE_QA_MARKER,
    resolver_type: "email",
    active_resolvers: ["email"],
    weighting_model: IDENTITY_RESOLUTION_WEIGHTING_MODEL,
    input_summary: {
      domain,
      first_name_present: Boolean(slugPart(input.firstName)),
      last_name_present: Boolean(slugPart(input.lastName)),
      company_name_present: Boolean(input.companyName?.trim()),
      industry,
    },
    candidates: scored,
    recommended,
    explanation: buildIdentityResolutionExplanation({
      recommended,
      companyEvidence: resolvedCompanyEvidence,
      industry,
    }),
    warnings,
  }
}

/** Alias for evidence-oriented consumers. */
export async function buildIdentityResolutionEvidenceSummary(
  input: IdentityResolutionInput,
  dependencies?: IdentityResolutionDependencies,
): Promise<IdentityResolutionResult> {
  return resolveEmailIdentity(input, dependencies)
}
