/**
 * GE-AIOS-FIRST-CUSTOMER-SALES-READINESS-1A — Seller readiness certification (client-safe).
 */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { buildOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import { SUPPORTED_SERVICE_VERTICALS_REGISTRY } from "@/lib/growth/business-profile/supported-service-verticals"
import {
  auditSellerKnowledgeCompleteness,
  type SellerKnowledgeCompletenessAudit,
} from "@/lib/growth/training/canonical-seller-knowledge-audit-1a"
import { isCanonicalSellerKnowledgeEnriched } from "@/lib/growth/training/canonical-seller-knowledge-onboarding-1a"

export type SellerReadinessCheckResult = {
  id: string
  question: string
  passed: boolean
  score: number
  deficiency?: string
}

export type SellerReadinessBlocker = {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  description: string
  remediation: string
}

export type SellerReadinessCertification = {
  organizationId: string
  certifiedAt: string
  readinessScore: number
  supervisedSellingAllowed: boolean
  checks: SellerReadinessCheckResult[]
  deficiencies: string[]
  blockers: SellerReadinessBlocker[]
  knowledgeAudit: SellerKnowledgeCompletenessAudit
}

function check(
  id: string,
  question: string,
  passed: boolean,
  deficiency?: string,
): SellerReadinessCheckResult {
  return { id, question, passed, score: passed ? 1 : 0, deficiency: passed ? undefined : deficiency }
}

export function certifySellerReadiness(input: {
  organizationId: string
  profile: BusinessProfileDraftContent | null | undefined
  profileId?: string | null
  certifiedAt?: string
}): SellerReadinessCertification {
  const profile = input.profile
  const canonical = profile?.canonicalSellerKnowledge
  const sellerTruth = buildOutreachSellerTruth({
    profile: profile ?? null,
    profileId: input.profileId ?? null,
    sellerCompanyName: profile?.company.companyName ?? null,
  })
  const strategyCompleteness = evaluateBusinessStrategyCompleteness(profile?.businessStrategy)
  const knowledgeAudit = auditSellerKnowledgeCompleteness({
    organizationId: input.organizationId,
    profile,
    auditedAt: input.certifiedAt,
  })

  const verticalCount = profile?.idealCustomers.supportedServiceVerticals?.length ?? 0
  const currentModules =
    canonical?.products.modules.filter((m) => m.availability === "current").length ?? 0

  const checks: SellerReadinessCheckResult[] = [
    check(
      "knows_products",
      "Does Ava know what the organization sells?",
      sellerTruth.productsServices.length >= 3 && Boolean(sellerTruth.primaryValueProposition),
      "Missing products/services or primary value proposition in approved profile",
    ),
    check(
      "knows_verticals",
      "Does Ava know every supported service vertical?",
      verticalCount >= SUPPORTED_SERVICE_VERTICALS_REGISTRY.length,
      `Only ${verticalCount}/${SUPPORTED_SERVICE_VERTICALS_REGISTRY.length} service verticals in profile`,
    ),
    check(
      "explains_products",
      "Can Ava explain each product/capability?",
      currentModules >= 5,
      `Only ${currentModules} current capabilities documented`,
    ),
    check(
      "explains_why_buy",
      "Can Ava explain why someone should buy?",
      Boolean(sellerTruth.elevatorPitch) && sellerTruth.differentiators.length >= 2,
      "Missing elevator pitch or differentiators",
    ),
    check(
      "handles_objections",
      "Can Ava answer common objections?",
      sellerTruth.objections.length >= 2,
      "Insufficient objection handling in business strategy or personas",
    ),
    check(
      "pricing_philosophy",
      "Can Ava explain pricing philosophy?",
      (sellerTruth.commercialGuidance?.length ?? 0) >= 1 ||
        Boolean(profile?.businessStrategy?.positioning.pricingPhilosophy),
      "Missing pricing/commercial guidance",
    ),
    check(
      "identifies_icp",
      "Can Ava identify the ideal customer?",
      Boolean(canonical?.company.targetCustomer) && (profile?.idealCustomers.buyerPersonas.length ?? 0) >= 3,
      "Missing target customer definition or buyer personas",
    ),
    check(
      "identifies_disqualifiers",
      "Can Ava explain why someone is not a fit?",
      sellerTruth.disqualifiers.length >= 3 || (canonical?.company.whenNotToRecommend.length ?? 0) >= 3,
      "Insufficient disqualification rules",
    ),
    check(
      "competitive_positioning",
      "Can Ava explain competitive positioning?",
      (canonical?.competitors.length ?? 0) >= 2 && sellerTruth.differentiators.length >= 2,
      "Missing competitive intelligence or differentiators",
    ),
    check(
      "recommends_tier",
      "Can Ava recommend the proper product tier?",
      Boolean(canonical?.commercial.packagingPhilosophy) &&
        Boolean(profile?.salesAndMarketing.averageDealSize?.trim() || canonical?.commercial.budgetConversation),
      "Missing packaging philosophy or deal-size guidance",
    ),
    check(
      "canonical_knowledge",
      "Is canonical seller knowledge enriched?",
      isCanonicalSellerKnowledgeEnriched(profile),
      "Profile missing canonical seller knowledge enrichment",
    ),
    check(
      "business_strategy",
      "Is business strategy sufficiently complete?",
      strategyCompleteness.hasContent &&
        strategyCompleteness.filledSectionCount >= strategyCompleteness.totalSectionCount,
      `Strategy missing areas: ${strategyCompleteness.missingAreas.join(", ")}`,
    ),
    check(
      "no_hallucination_guardrails",
      "Are anti-hallucination guardrails present?",
      (sellerTruth.neverSay.length ?? 0) >= 1 &&
        (sellerTruth.whenNotToRecommend?.length ?? 0) >= 3 &&
        (sellerTruth.limitations?.length ?? 0) >= 2,
      "Missing never-say rules, limitations, or when-not-to-recommend guidance",
    ),
  ]

  const readinessScore = checks.reduce((sum, row) => sum + row.score, 0) / checks.length

  const deficiencies = checks.filter((row) => !row.passed).map((row) => row.deficiency!).filter(Boolean)

  const blockers: SellerReadinessBlocker[] = []

  if (!isCanonicalSellerKnowledgeEnriched(profile)) {
    blockers.push({
      id: "missing_canonical_knowledge",
      severity: "critical",
      description: "Approved Business Profile lacks canonical seller knowledge enrichment",
      remediation: "Run canonical seller knowledge onboarding for the organization",
    })
  }

  if (!profile || sellerTruth.source !== "approved_business_profile") {
    blockers.push({
      id: "missing_approved_profile",
      severity: "critical",
      description: "No approved Business Profile — Ava cannot sell from verified seller truth",
      remediation: "Approve Business Profile in Training → Company Profile",
    })
  }

  if (verticalCount < SUPPORTED_SERVICE_VERTICALS_REGISTRY.length) {
    blockers.push({
      id: "incomplete_verticals",
      severity: "high",
      description: `Supported service verticals incomplete (${verticalCount}/${SUPPORTED_SERVICE_VERTICALS_REGISTRY.length})`,
      remediation: "Project all supported service verticals into approved profile",
    })
  }

  if (knowledgeAudit.missingCount > 0) {
    blockers.push({
      id: "knowledge_gaps",
      severity: "medium",
      description: `${knowledgeAudit.missingCount} seller knowledge domains missing entirely`,
      remediation: "Complete missing domains via Training workspace or knowledge ingestion",
    })
  }

  if ((canonical?.proof.length ?? 0) === 0) {
    blockers.push({
      id: "missing_proof",
      severity: "medium",
      description: "No case studies or proof points in canonical seller knowledge",
      remediation: "Add proof library entries via master knowledge seed or Knowledge Center",
    })
  }

  if (!profile?.businessStrategy?.objections.items.length) {
    blockers.push({
      id: "missing_objections",
      severity: "low",
      description: "Business Strategy lacks explicit objection/response pairs",
      remediation: "Teach objections in Training → Business Strategy",
    })
  }

  const criticalBlockers = blockers.filter((row) => row.severity === "critical")

  return {
    organizationId: input.organizationId,
    certifiedAt: input.certifiedAt ?? new Date().toISOString(),
    readinessScore,
    supervisedSellingAllowed: criticalBlockers.length === 0 && readinessScore >= 0.75,
    checks,
    deficiencies,
    blockers,
    knowledgeAudit,
  }
}
