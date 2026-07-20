/**
 * GE-AIOS-FIRST-CUSTOMER-SALES-READINESS-1A — Knowledge completeness audit (client-safe).
 * Maps every seller knowledge domain to its canonical storage location.
 */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { SUPPORTED_SERVICE_VERTICALS_REGISTRY } from "@/lib/growth/business-profile/supported-service-verticals"

export const GROWTH_AIOS_FIRST_CUSTOMER_SALES_READINESS_1A_QA_MARKER =
  "ge-aios-first-customer-sales-readiness-1a-v1" as const

export type SellerKnowledgeDomainStatus = "present" | "partial" | "missing"

export type SellerKnowledgeDomainAudit = {
  domain: string
  status: SellerKnowledgeDomainStatus
  locations: string[]
  notes?: string
}

export type SellerKnowledgeCompletenessAudit = {
  organizationId: string
  auditedAt: string
  domains: SellerKnowledgeDomainAudit[]
  presentCount: number
  partialCount: number
  missingCount: number
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function hasList(values: string[] | null | undefined, min = 1): boolean {
  return (values?.filter((entry) => entry.trim()).length ?? 0) >= min
}

function domain(
  name: string,
  status: SellerKnowledgeDomainStatus,
  locations: string[],
  notes?: string,
): SellerKnowledgeDomainAudit {
  return { domain: name, status, locations, notes }
}

export function auditSellerKnowledgeCompleteness(input: {
  organizationId: string
  profile: BusinessProfileDraftContent | null | undefined
  auditedAt?: string
}): SellerKnowledgeCompletenessAudit {
  const profile = input.profile
  const canonical = profile?.canonicalSellerKnowledge
  const strategy = profile?.businessStrategy
  const domains: SellerKnowledgeDomainAudit[] = []

  domains.push(
    domain(
      "company identity",
      hasText(profile?.company.companyName) && hasText(profile?.company.shortDescription)
        ? "present"
        : hasText(profile?.company.companyName)
          ? "partial"
          : "missing",
      [
        "growth.organization_business_profiles.profile_json.company",
        "profile_json.canonicalSellerKnowledge.company",
        "profile_json.businessStrategy.companyWide",
      ],
    ),
  )

  domains.push(
    domain(
      "products",
      hasList(profile?.company.productsServices, 2)
        ? canonical?.products.modules.length
          ? "present"
          : "partial"
        : "missing",
      [
        "profile_json.company.productsServices",
        "profile_json.canonicalSellerKnowledge.products.modules",
        "lib/plans.ts (platform tier matrix — Equipify SaaS only)",
      ],
    ),
  )

  domains.push(
    domain(
      "capabilities / feature matrix",
      (canonical?.products.modules.filter((m) => m.availability === "current").length ?? 0) >= 5
        ? "present"
        : (canonical?.products.modules.length ?? 0) > 0
          ? "partial"
          : "missing",
      [
        "profile_json.canonicalSellerKnowledge.products.modules",
        "lib/billing/blitzpay-feature-catalog.ts (BlitzPay commercial lane)",
      ],
    ),
  )

  domains.push(
    domain(
      "supported industries",
      hasList(profile?.idealCustomers.targetIndustries, 3) ? "present" : "partial",
      [
        "profile_json.idealCustomers.targetIndustries",
        "profile_json.canonicalSellerKnowledge.industries",
        "lib/growth/playbooks/industry-playbook-registry.ts",
      ],
    ),
  )

  const verticalCount = profile?.idealCustomers.supportedServiceVerticals?.length ?? 0
  domains.push(
    domain(
      "supported service verticals",
      verticalCount >= SUPPORTED_SERVICE_VERTICALS_REGISTRY.length
        ? "present"
        : verticalCount > 0
          ? "partial"
          : "missing",
      [
        "profile_json.idealCustomers.supportedServiceVerticals",
        "lib/growth/business-profile/supported-service-verticals.ts",
      ],
      `${verticalCount}/${SUPPORTED_SERVICE_VERTICALS_REGISTRY.length} verticals in profile`,
    ),
  )

  domains.push(
    domain(
      "ICP",
      hasList(profile?.idealCustomers.buyerPersonas, 2) &&
        hasText(canonical?.company.targetCustomer)
        ? "present"
        : hasText(canonical?.company.targetCustomer) || hasList(profile?.idealCustomers.buyerPersonas)
          ? "partial"
          : "missing",
      [
        "profile_json.idealCustomers",
        "profile_json.canonicalSellerKnowledge.company.targetCustomer",
        "lib/growth/prospect-search/map-business-profile-to-prospect-search-icp.ts",
      ],
    ),
  )

  domains.push(
    domain(
      "buyer personas",
      (canonical?.personas.length ?? 0) >= 4
        ? "present"
        : hasList(profile?.idealCustomers.buyerPersonas, 2)
          ? "partial"
          : "missing",
      [
        "profile_json.idealCustomers.buyerPersonas (labels)",
        "profile_json.canonicalSellerKnowledge.personas (structured)",
        "lib/growth/playbooks/industry-playbook-types.ts",
      ],
    ),
  )

  domains.push(
    domain(
      "qualification criteria",
      hasList(profile?.salesAndMarketing.qualificationCriteria, 2) ||
        hasList(strategy?.salesPhilosophy.qualificationStandards, 2)
        ? "present"
        : "partial",
      [
        "profile_json.salesAndMarketing.qualificationCriteria",
        "profile_json.businessStrategy.salesPhilosophy.qualificationStandards",
      ],
    ),
  )

  domains.push(
    domain(
      "disqualification rules",
      hasList(profile?.idealCustomers.disqualifiers, 3) ||
        hasList(canonical?.company.whenNotToRecommend, 3)
        ? "present"
        : "partial",
      [
        "profile_json.idealCustomers.disqualifiers",
        "profile_json.canonicalSellerKnowledge.company.whenNotToRecommend",
        "lib/growth/revenue-workflow/evaluate-growth-lead-admission.ts",
      ],
    ),
  )

  domains.push(
    domain(
      "pricing philosophy",
      hasText(canonical?.commercial.pricingPhilosophy) ||
        hasText(strategy?.positioning.pricingPhilosophy)
        ? "present"
        : hasText(profile?.salesAndMarketing.averageDealSize)
          ? "partial"
          : "missing",
      [
        "profile_json.salesAndMarketing.averageDealSize (free-text only)",
        "profile_json.canonicalSellerKnowledge.commercial",
        "profile_json.businessStrategy.positioning.pricingPhilosophy",
      ],
      "No structured pricing tiers in Business Profile schema",
    ),
  )

  domains.push(
    domain(
      "competitive differentiators",
      hasList(canonical?.company.differentiators, 2) ||
        hasList(strategy?.positioning.competitiveAdvantages, 1)
        ? "present"
        : "partial",
      [
        "profile_json.canonicalSellerKnowledge.company.differentiators",
        "profile_json.businessStrategy.positioning.competitiveAdvantages",
        "profile_json.problemsAndTriggers.competitorsAlternatives",
      ],
    ),
  )

  domains.push(
    domain(
      "positioning",
      hasText(strategy?.messaging.elevatorPitch) && hasList(canonical?.company.differentiators, 1)
        ? "present"
        : hasText(strategy?.messaging.elevatorPitch)
          ? "partial"
          : "missing",
      [
        "profile_json.businessStrategy.positioning",
        "profile_json.businessStrategy.messaging",
        "profile_json.canonicalSellerKnowledge.company",
      ],
    ),
  )

  domains.push(
    domain(
      "objection handling",
      (strategy?.objections.items.length ?? 0) >= 2 ||
        (canonical?.personas.some((p) => p.objections.length > 0) ?? false)
        ? "present"
        : (strategy?.objections.items.length ?? 0) >= 1
          ? "partial"
          : "missing",
      [
        "profile_json.businessStrategy.objections",
        "profile_json.canonicalSellerKnowledge.personas[].objections",
        "lib/growth/conversational-playbooks/",
      ],
    ),
  )

  domains.push(
    domain(
      "messaging",
      hasList(profile?.salesAndMarketing.messagingAngles, 2) &&
        hasText(strategy?.messaging.tone)
        ? "present"
        : hasList(profile?.salesAndMarketing.messagingAngles, 1)
          ? "partial"
          : "missing",
      [
        "profile_json.salesAndMarketing.messagingAngles",
        "profile_json.businessStrategy.messaging",
        "lib/growth/aios/growth/growth-outreach-seller-truth.ts",
      ],
    ),
  )

  domains.push(
    domain(
      "brand voice",
      hasText(strategy?.messaging.tone) &&
        (hasList(strategy?.messaging.wordsToAvoid, 1) || hasList(strategy?.messaging.neverSay, 1))
        ? "present"
        : hasText(strategy?.messaging.tone)
          ? "partial"
          : "missing",
      [
        "profile_json.businessStrategy.messaging.tone",
        "profile_json.businessStrategy.messaging.wordsToAvoid",
        "profile_json.businessStrategy.messaging.neverSay",
        "profile_json.businessStrategy.companyWide.brandPersonality",
      ],
    ),
  )

  domains.push(
    domain(
      "case studies / proof",
      (canonical?.proof.length ?? 0) >= 1 ? "present" : "missing",
      [
        "profile_json.canonicalSellerKnowledge.proof",
        "growth.signal_events (Knowledge Center category: case_study)",
      ],
    ),
  )

  domains.push(
    domain(
      "implementation process",
      hasText(canonical?.commercial.implementationExpectations) &&
        hasText(canonical?.company.implementationPhilosophy)
        ? "present"
        : hasText(canonical?.company.implementationPhilosophy)
          ? "partial"
          : "missing",
      ["profile_json.canonicalSellerKnowledge.commercial", "profile_json.canonicalSellerKnowledge.company"],
    ),
  )

  domains.push(
    domain(
      "onboarding",
      hasText(canonical?.commercial.onboardingApproach) ? "present" : "partial",
      [
        "profile_json.canonicalSellerKnowledge.commercial.onboardingApproach",
        "growth.customer_onboarding_tasks (post-close customer lifecycle — separate domain)",
      ],
    ),
  )

  domains.push(
    domain(
      "integrations",
      canonical?.products.modules.some((m) => /quickbooks|integration|api/i.test(m.feature))
        ? "present"
        : "partial",
      ["profile_json.canonicalSellerKnowledge.products.modules"],
    ),
  )

  domains.push(
    domain(
      "FAQs",
      "partial",
      ["growth.signal_events (Knowledge Center category: faq)", "lib/growth/demo-assistant/equipify-demo-knowledge-bundle-v1.ts"],
      "No dedicated FAQ schema in Business Profile",
    ),
  )

  domains.push(
    domain(
      "terminology / glossary",
      (canonical?.industries.some((i) => i.operationalTerminology.length > 0) ?? false)
        ? "present"
        : "partial",
      [
        "profile_json.canonicalSellerKnowledge.industries[].operationalTerminology",
        "lib/growth/playbooks/industry-playbook-registry.ts",
      ],
    ),
  )

  domains.push(
    domain(
      "operational workflows",
      hasList(profile?.problemsAndTriggers.painPoints, 3) &&
        (canonical?.discovery.principles.length ?? 0) >= 3
        ? "present"
        : "partial",
      [
        "profile_json.problemsAndTriggers",
        "profile_json.canonicalSellerKnowledge.discovery",
        "profile_json.businessStrategy.salesPhilosophy.discoveryQuestions",
      ],
    ),
  )

  domains.push(
    domain(
      "sales playbooks",
      hasList(strategy?.salesPhilosophy.discoveryQuestions, 3) &&
        (canonical?.salesPhilosophyPrinciples.length ?? canonical?.company.salesPhilosophy.length ?? 0) >= 5
        ? "present"
        : "partial",
      [
        "profile_json.businessStrategy",
        "profile_json.canonicalSellerKnowledge",
        "lib/growth/conversational-playbooks/",
        "lib/growth/playbooks/industry-playbook-registry.ts",
      ],
    ),
  )

  const presentCount = domains.filter((d) => d.status === "present").length
  const partialCount = domains.filter((d) => d.status === "partial").length
  const missingCount = domains.filter((d) => d.status === "missing").length

  return {
    organizationId: input.organizationId,
    auditedAt: input.auditedAt ?? new Date().toISOString(),
    domains,
    presentCount,
    partialCount,
    missingCount,
  }
}
