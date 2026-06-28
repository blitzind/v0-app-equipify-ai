/**
 * GE-IRE-6C — Buying Committee Intelligence (deterministic account reasoning).
 * Groups contacts by committee role, scores coverage, recommends primary outreach target.
 * Not an executor, LLM classifier, or runtime replacement.
 */

import { roundScore } from "@/lib/growth/contact-verification/confidence-signals-core"
import {
  recommendContacts,
  type ContactRecommendation,
  type ContactRecommendationCandidateInput,
  type ContactRecommendationDependencies,
} from "@/lib/growth/contact-verification/contact-recommendation-engine"
import type { EmailLearningObservation } from "@/lib/growth/contact-verification/email-learning"
import type { IdentityCompanyPatternEvidence } from "@/lib/growth/contact-verification/identity-resolution-engine"

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER =
  "buying-committee-intelligence-v1" as const

export const BUYING_COMMITTEE_ROLES = [
  "economic_buyer",
  "operational_buyer",
  "technical_evaluator",
  "champion",
  "finance_procurement",
  "executive_sponsor",
  "end_user",
  "influencer",
  "unknown",
] as const

export type BuyingCommitteeRole = (typeof BUYING_COMMITTEE_ROLES)[number]

export const BUYING_COMMITTEE_TARGET_USE_CASES = [
  "growth_engine",
  "equipify_core",
  "service_operations",
  "generic",
] as const

export type BuyingCommitteeTargetUseCase = (typeof BUYING_COMMITTEE_TARGET_USE_CASES)[number]

export type BuyingCommitteeIntelligenceInput = {
  companyName?: string
  domain?: string
  industry?: string
  contacts: ContactRecommendationCandidateInput[]
  historicalLearning?: EmailLearningObservation[]
  companyPatternEvidence?: IdentityCompanyPatternEvidence | null
  relationshipSignals?: unknown
  targetUseCase?: BuyingCommitteeTargetUseCase
}

export type BuyingCommitteeCoverage = {
  required_roles: BuyingCommitteeRole[]
  covered_roles: BuyingCommitteeRole[]
  missing_roles: BuyingCommitteeRole[]
  coverage_score: number
  coverage_tier: "strong" | "moderate" | "weak" | "insufficient"
}

export type BuyingCommitteeRoleClusterContact = {
  contact: ContactRecommendation
  role_confidence: number
  role_fit_score: number
  reasons: string[]
}

export type BuyingCommitteeRoleCluster = {
  role: BuyingCommitteeRole
  contacts: BuyingCommitteeRoleClusterContact[]
  best_contact?: ContactRecommendation
  coverage: "covered" | "missing"
}

export type BuyingCommitteeRecommendation = {
  primary_contact?: ContactRecommendation
  primary_role?: BuyingCommitteeRole
  backup_contacts: ContactRecommendation[]
  recommended_strategy: string
  reasons: string[]
  warnings: string[]
}

export type BuyingCommitteeIntelligenceResult = {
  qa_marker: typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER
  companyName?: string
  domain?: string
  roles: Record<BuyingCommitteeRole, BuyingCommitteeRoleCluster>
  coverage: BuyingCommitteeCoverage
  recommendation: BuyingCommitteeRecommendation
  summary: {
    total_contacts: number
    classified_contacts: number
    committee_strength: number
    top_role?: BuyingCommitteeRole
    primary_contact?: string
    recommendation: string
  }
  warnings: string[]
}

export type BuyingCommitteeRoleRule = {
  role: BuyingCommitteeRole
  label: string
  patterns: RegExp[]
  base_confidence: number
}

export const BUYING_COMMITTEE_ROLE_RULES: BuyingCommitteeRoleRule[] = [
  {
    role: "economic_buyer",
    label: "Economic buyer",
    base_confidence: 0.92,
    patterns: [
      /\b(owner|founder|co-founder|cofounder|managing partner)\b/i,
      /\b(ceo|chief executive)\b/i,
      /\b(president)\b/i,
    ],
  },
  {
    role: "operational_buyer",
    label: "Operational buyer",
    base_confidence: 0.9,
    patterns: [
      /\b(coo|chief operating)\b/i,
      /\b(operations director|director of operations)\b/i,
      /\b(vp|vice president).*(operations|ops)\b/i,
      /\b(general manager|gm)\b/i,
      /\b(service manager|field service manager|practice manager)\b/i,
    ],
  },
  {
    role: "technical_evaluator",
    label: "Technical evaluator",
    base_confidence: 0.86,
    patterns: [
      /\b(it manager|systems administrator|sysadmin)\b/i,
      /\b(engineering manager|technical lead|tech lead)\b/i,
      /\b(biomedical engineer|clinical engineer)\b/i,
      /\b(cto|chief technology)\b/i,
    ],
  },
  {
    role: "champion",
    label: "Champion",
    base_confidence: 0.72,
    patterns: [
      /\b(operations manager|department manager)\b/i,
      /\b(service coordinator|program coordinator)\b/i,
      /\b(team lead|shift lead)\b/i,
    ],
  },
  {
    role: "finance_procurement",
    label: "Finance / procurement",
    base_confidence: 0.88,
    patterns: [
      /\b(cfo|chief financial)\b/i,
      /\b(controller|finance manager)\b/i,
      /\b(procurement|purchasing|buyer)\b/i,
    ],
  },
  {
    role: "executive_sponsor",
    label: "Executive sponsor",
    base_confidence: 0.85,
    patterns: [
      /\b(ceo|president|coo|chief)\b/i,
      /\b(vp|vice president|executive director)\b/i,
    ],
  },
  {
    role: "end_user",
    label: "End user",
    base_confidence: 0.65,
    patterns: [
      /\b(technician|specialist|coordinator|dispatcher)\b/i,
      /\b(field staff|field tech|service tech)\b/i,
    ],
  },
  {
    role: "influencer",
    label: "Influencer",
    base_confidence: 0.6,
    patterns: [/\b(consultant|advisor|partner)\b/i, /\b(administrator|admin)\b/i],
  },
]

const REQUIRED_ROLES_BY_USE_CASE: Record<
  BuyingCommitteeTargetUseCase,
  BuyingCommitteeRole[]
> = {
  equipify_core: [
    "operational_buyer",
    "economic_buyer",
    "champion",
    "technical_evaluator",
    "finance_procurement",
  ],
  service_operations: [
    "operational_buyer",
    "economic_buyer",
    "champion",
    "technical_evaluator",
    "finance_procurement",
  ],
  growth_engine: [
    "economic_buyer",
    "operational_buyer",
    "executive_sponsor",
    "champion",
    "finance_procurement",
  ],
  generic: ["economic_buyer", "operational_buyer", "champion"],
}

const ROLE_IMPORTANCE_BY_USE_CASE: Record<
  BuyingCommitteeTargetUseCase,
  Partial<Record<BuyingCommitteeRole, number>>
> = {
  equipify_core: {
    operational_buyer: 1,
    economic_buyer: 0.95,
    champion: 0.85,
    technical_evaluator: 0.8,
    finance_procurement: 0.75,
    executive_sponsor: 0.7,
  },
  service_operations: {
    operational_buyer: 1,
    economic_buyer: 0.92,
    champion: 0.88,
    technical_evaluator: 0.78,
    finance_procurement: 0.74,
    executive_sponsor: 0.68,
  },
  growth_engine: {
    economic_buyer: 1,
    executive_sponsor: 0.95,
    operational_buyer: 0.88,
    champion: 0.82,
    finance_procurement: 0.76,
  },
  generic: {
    economic_buyer: 1,
    operational_buyer: 0.9,
    champion: 0.8,
  },
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return roundScore(Math.max(0, Math.min(1, value)))
}

function normalizeUseCase(value: string | undefined): BuyingCommitteeTargetUseCase {
  const normalized = (value ?? "generic").trim().toLowerCase() as BuyingCommitteeTargetUseCase
  return (BUYING_COMMITTEE_TARGET_USE_CASES as readonly string[]).includes(normalized)
    ? normalized
    : "generic"
}

function contactIdentityKey(input: {
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
}): string {
  const first = (input.firstName ?? "").trim().toLowerCase()
  const last = (input.lastName ?? "").trim().toLowerCase()
  if (first && last) return `${first}|${last}`
  const full = (input.fullName ?? "").trim().toLowerCase()
  if (full) return full
  const email = (input.email ?? "").trim().toLowerCase()
  if (email) return email
  return ""
}

function findMatchingCandidate(
  recommendation: ContactRecommendation,
  contacts: ContactRecommendationCandidateInput[],
): ContactRecommendationCandidateInput {
  const key = contactIdentityKey({
    firstName: recommendation.contact.first_name,
    lastName: recommendation.contact.last_name,
    fullName: recommendation.contact.display_name,
    email: recommendation.contact.email,
  })

  const matched = contacts.find((candidate) => {
    const candidateKey = contactIdentityKey(candidate)
    return candidateKey && candidateKey === key
  })

  if (matched) return matched

  return {
    firstName: recommendation.contact.first_name,
    lastName: recommendation.contact.last_name,
    fullName: recommendation.contact.display_name,
    email: recommendation.contact.email,
    jobTitle: recommendation.contact.job_title,
    department: recommendation.contact.department,
    seniority: recommendation.contact.seniority,
  }
}

function buildTitleContext(contact: ContactRecommendationCandidateInput): string {
  return [contact.jobTitle, contact.department, contact.seniority, contact.source]
    .filter(Boolean)
    .join(" ")
    .trim()
}

export type ClassifiedCommitteeContact = {
  primary_role: BuyingCommitteeRole
  roles: Array<{ role: BuyingCommitteeRole; confidence: number; reasons: string[] }>
}

export function classifyBuyingCommitteeRoles(input: {
  contact: ContactRecommendationCandidateInput
  recommendation?: ContactRecommendation | null
}): ClassifiedCommitteeContact {
  const context = buildTitleContext(input.contact)
  const roles: ClassifiedCommitteeContact["roles"] = []

  for (const rule of BUYING_COMMITTEE_ROLE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(context))) {
      roles.push({
        role: rule.role,
        confidence: clampScore(rule.base_confidence),
        reasons: [`${rule.label} title heuristic matched`],
      })
    }
  }

  if (
    input.recommendation &&
    input.recommendation.scores.engagement >= 0.65 &&
    !roles.some((row) => row.role === "champion")
  ) {
    roles.push({
      role: "champion",
      confidence: clampScore(0.68 + (input.recommendation.scores.engagement - 0.65) * 0.5),
      reasons: ["High engagement score suggests internal champion potential"],
    })
  }

  if (roles.length === 0) {
    return {
      primary_role: "unknown",
      roles: [{ role: "unknown", confidence: 0.35, reasons: ["No committee role heuristics matched"] }],
    }
  }

  const sorted = [...roles].sort(
    (a, b) => b.confidence - a.confidence || a.role.localeCompare(b.role),
  )

  return {
    primary_role: sorted[0]!.role,
    roles: sorted,
  }
}

export function computeRoleFitScore(input: {
  role: BuyingCommitteeRole
  roleConfidence: number
  recommendation: ContactRecommendation
  useCase: BuyingCommitteeTargetUseCase
}): number {
  const importance = ROLE_IMPORTANCE_BY_USE_CASE[input.useCase][input.role] ?? 0.45
  return clampScore(
    input.recommendation.scores.overall * 0.55 +
      input.roleConfidence * 0.25 +
      importance * 0.2,
  )
}

export function computeBuyingCommitteeCoverage(input: {
  useCase: BuyingCommitteeTargetUseCase
  coveredRoles: Set<BuyingCommitteeRole>
}): BuyingCommitteeCoverage {
  const required_roles = [...REQUIRED_ROLES_BY_USE_CASE[input.useCase]]
  const covered_roles = required_roles.filter((role) => input.coveredRoles.has(role))
  const missing_roles = required_roles.filter((role) => !input.coveredRoles.has(role))
  const coverage_score =
    required_roles.length > 0
      ? clampScore(covered_roles.length / required_roles.length)
      : 0

  let coverage_tier: BuyingCommitteeCoverage["coverage_tier"] = "insufficient"
  if (coverage_score >= 0.8) coverage_tier = "strong"
  else if (coverage_score >= 0.5) coverage_tier = "moderate"
  else if (coverage_score >= 0.25) coverage_tier = "weak"

  return {
    required_roles,
    covered_roles,
    missing_roles,
    coverage_score,
    coverage_tier,
  }
}

export function computePrimaryOutreachScore(input: {
  recommendation: ContactRecommendation
  primaryRole: BuyingCommitteeRole
  roleConfidence: number
  useCase: BuyingCommitteeTargetUseCase
}): number {
  const roleImportance = ROLE_IMPORTANCE_BY_USE_CASE[input.useCase][input.primaryRole] ?? 0.45
  return clampScore(
    input.recommendation.scores.overall * 0.4 +
      roleImportance * 0.25 +
      input.roleConfidence * 0.15 +
      input.recommendation.scores.deliverability * 0.1 +
      input.recommendation.scores.accessibility * 0.05 +
      input.recommendation.scores.engagement * 0.05,
  )
}

function emptyRoleCluster(role: BuyingCommitteeRole): BuyingCommitteeRoleCluster {
  return { role, contacts: [], coverage: "missing" }
}

function buildRoleClusters(input: {
  recommendations: ContactRecommendation[]
  classifications: Map<string, ClassifiedCommitteeContact>
  useCase: BuyingCommitteeTargetUseCase
}): Record<BuyingCommitteeRole, BuyingCommitteeRoleCluster> {
  const clusters = Object.fromEntries(
    BUYING_COMMITTEE_ROLES.map((role) => [role, emptyRoleCluster(role)]),
  ) as Record<BuyingCommitteeRole, BuyingCommitteeRoleCluster>

  for (const recommendation of input.recommendations) {
    const key = recommendation.contact.display_name
    const classification = input.classifications.get(key)
    if (!classification) continue

    for (const roleMatch of classification.roles) {
      if (roleMatch.role === "unknown") continue
      const cluster = clusters[roleMatch.role]
      const roleFitScore = computeRoleFitScore({
        role: roleMatch.role,
        roleConfidence: roleMatch.confidence,
        recommendation,
        useCase: input.useCase,
      })
      cluster.contacts.push({
        contact: recommendation,
        role_confidence: roleMatch.confidence,
        role_fit_score: roleFitScore,
        reasons: roleMatch.reasons,
      })
    }
  }

  for (const role of BUYING_COMMITTEE_ROLES) {
    const cluster = clusters[role]
    cluster.contacts.sort(
      (a, b) =>
        b.role_fit_score - a.role_fit_score ||
        b.contact.scores.overall - a.contact.scores.overall ||
        a.contact.contact.display_name.localeCompare(b.contact.contact.display_name),
    )
    cluster.best_contact = cluster.contacts[0]?.contact
    cluster.coverage = cluster.contacts.length > 0 ? "covered" : "missing"
  }

  return clusters
}

export function buildBuyingCommitteeRecommendationExplanation(input: {
  primaryContact?: ContactRecommendation
  primaryRole?: BuyingCommitteeRole
  coverage: BuyingCommitteeCoverage
  useCase: BuyingCommitteeTargetUseCase
  strategy: string
}): { reasons: string[]; warnings: string[] } {
  const reasons: string[] = []
  const warnings: string[] = []

  if (input.primaryContact) {
    reasons.push("Highest contact recommendation score among prioritized committee roles")
    reasons.push(`Operations/title maps strongly to ${input.useCase.replace(/_/g, " ")} buyer`)
    if (input.primaryContact.recommended_email) {
      reasons.push("Recommended email is deliverable")
    }
    if (input.primaryContact.evidence.some((item) => item.toLowerCase().includes("pattern"))) {
      reasons.push("Company pattern evidence supports identity")
    }
  }

  if (input.primaryRole) {
    reasons.push(`Primary committee role: ${input.primaryRole.replace(/_/g, " ")}`)
  }

  for (const missing of input.coverage.missing_roles) {
    warnings.push(`Missing ${missing.replace(/_/g, " ")} coverage`)
  }

  if (input.coverage.missing_roles.includes("economic_buyer") && input.primaryRole === "operational_buyer") {
    reasons.push("Economic buyer missing — start with operational buyer and expand committee")
  }

  if (input.coverage.coverage_tier === "insufficient" || input.coverage.coverage_tier === "weak") {
    warnings.push("Buying committee coverage is limited — validate additional stakeholders")
  }

  return {
    reasons: [...new Set(reasons)],
    warnings: [...new Set(warnings)],
  }
}

export function buildBuyingCommitteeStrategy(input: {
  primaryRole?: BuyingCommitteeRole
  coverage: BuyingCommitteeCoverage
  useCase: BuyingCommitteeTargetUseCase
}): string {
  if (!input.primaryRole) {
    return "Insufficient committee intelligence — enrich contacts before outreach"
  }

  if (input.coverage.coverage_tier === "strong") {
    return `Lead with ${input.primaryRole.replace(/_/g, " ")} and sequence secondary committee members by role priority`
  }

  if (input.coverage.missing_roles.length > 0) {
    return `Start with ${input.primaryRole.replace(/_/g, " ")}, then expand into missing roles: ${input.coverage.missing_roles.join(", ").replace(/_/g, " ")}`
  }

  return `Prioritize ${input.primaryRole.replace(/_/g, " ")} for ${input.useCase.replace(/_/g, " ")} outreach`
}

export type BuyingCommitteeIntelligenceDependencies = ContactRecommendationDependencies & {
  recommendContacts?: typeof recommendContacts
}

export async function analyzeBuyingCommittee(
  input: BuyingCommitteeIntelligenceInput,
  dependencies: BuyingCommitteeIntelligenceDependencies = {},
): Promise<BuyingCommitteeIntelligenceResult> {
  const useCase = normalizeUseCase(input.targetUseCase)
  const warnings: string[] = []

  const recommend = dependencies.recommendContacts ?? recommendContacts
  const contactRecommendations = await recommend(
    {
      companyName: input.companyName,
      domain: input.domain,
      industry: input.industry,
      contacts: input.contacts,
      historicalLearning: input.historicalLearning,
      companyPatternEvidence: input.companyPatternEvidence ?? null,
      relationshipSignals: input.relationshipSignals,
    },
    dependencies,
  )

  const classifications = new Map<string, ClassifiedCommitteeContact>()
  for (const recommendation of contactRecommendations.recommended) {
    const candidate = findMatchingCandidate(recommendation, input.contacts)
    classifications.set(
      recommendation.contact.display_name,
      classifyBuyingCommitteeRoles({ contact: candidate, recommendation }),
    )
  }

  const roles = buildRoleClusters({
    recommendations: contactRecommendations.recommended,
    classifications,
    useCase,
  })

  const coveredRoles = new Set<BuyingCommitteeRole>(
    BUYING_COMMITTEE_ROLES.filter((role) => roles[role].coverage === "covered"),
  )
  const coverage = computeBuyingCommitteeCoverage({ useCase, coveredRoles })

  const primaryCandidates = contactRecommendations.recommended.map((recommendation) => {
    const classification = classifications.get(recommendation.contact.display_name)
    const primaryRole = classification?.primary_role ?? "unknown"
    const roleConfidence =
      classification?.roles.find((row) => row.role === primaryRole)?.confidence ?? 0.35
    return {
      recommendation,
      primaryRole,
      roleConfidence,
      outreachScore: computePrimaryOutreachScore({
        recommendation,
        primaryRole,
        roleConfidence,
        useCase,
      }),
    }
  })

  primaryCandidates.sort(
    (a, b) =>
      b.outreachScore - a.outreachScore ||
      b.recommendation.scores.authority - a.recommendation.scores.authority ||
      b.recommendation.scores.deliverability - a.recommendation.scores.deliverability ||
      a.recommendation.contact.display_name.localeCompare(b.recommendation.contact.display_name),
  )

  const primary = primaryCandidates[0]
  const backup_contacts = primaryCandidates.slice(1, 4).map((row) => row.recommendation)
  const strategy = buildBuyingCommitteeStrategy({
    primaryRole: primary?.primaryRole,
    coverage,
    useCase,
  })
  const explanation = buildBuyingCommitteeRecommendationExplanation({
    primaryContact: primary?.recommendation,
    primaryRole: primary?.primaryRole,
    coverage,
    useCase,
    strategy,
  })

  const classified_contacts = [...classifications.values()].filter(
    (row) => row.primary_role !== "unknown",
  ).length

  if (input.contacts.length === 0) warnings.push("no_contacts_provided")
  warnings.push(...explanation.warnings)

  const summaryRecommendation = primary
    ? `Primary recommendation: ${primary.recommendation.contact.display_name} as ${primary.primaryRole.replace(/_/g, " ")} — ${coverage.coverage_tier} committee coverage`
    : "No primary committee contact identified"

  return {
    qa_marker: GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
    companyName: input.companyName,
    domain: input.domain ?? contactRecommendations.domain,
    roles,
    coverage,
    recommendation: {
      primary_contact: primary?.recommendation,
      primary_role: primary?.primaryRole,
      backup_contacts,
      recommended_strategy: strategy,
      reasons: explanation.reasons,
      warnings: explanation.warnings,
    },
    summary: {
      total_contacts: input.contacts.length,
      classified_contacts,
      committee_strength: roundScore(coverage.coverage_score * 100),
      top_role: primary?.primaryRole,
      primary_contact: primary?.recommendation.contact.display_name,
      recommendation: summaryRecommendation,
    },
    warnings: [...new Set(warnings)],
  }
}
