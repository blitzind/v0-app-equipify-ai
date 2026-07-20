/**
 * GE-AIOS-FIRST-CUSTOMER-SALES-READINESS-1A — Equipify seed provider (first customer).
 * Org-specific seed data only — onboarding pipeline remains organization-agnostic.
 */

import {
  EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE,
  buildEquipifyCanonicalSellerKnowledge,
} from "@/lib/growth/business-profile/equipify-master-knowledge-canonical"
import {
  EQUIPIFY_MASTER_CONTEXT_SOURCE_DOCUMENT_ID,
  EQUIPIFY_MASTER_KNOWLEDGE_VERSION,
  normalizeEquipifyCanonicalSellerKnowledge,
} from "@/lib/growth/business-profile/equipify-master-knowledge-types"
import type { CanonicalSellerKnowledgeSeedProvider } from "@/lib/growth/business-profile/canonical-seller-knowledge-types"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

export const EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE_SEED_PROVIDER: CanonicalSellerKnowledgeSeedProvider =
  {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    seedVersion: EQUIPIFY_MASTER_KNOWLEDGE_VERSION,
    buildSeed: () => normalizeEquipifyCanonicalSellerKnowledge(buildEquipifyCanonicalSellerKnowledge()),
  }

export function resolveCanonicalSellerKnowledgeSeedForOrganization(organizationId: string) {
  if (organizationId === EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE_SEED_PROVIDER.organizationId) {
    return EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE_SEED_PROVIDER
  }
  return null
}

export function buildEquipifyOnboardingSources() {
  return [
    {
      source: "master_knowledge_seed" as const,
      sourceDocumentId: EQUIPIFY_MASTER_CONTEXT_SOURCE_DOCUMENT_ID,
      canonicalSeed: normalizeEquipifyCanonicalSellerKnowledge(EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE),
      mergedSections: [
        "canonical_seller_knowledge",
        "business_strategy",
        "supported_service_vertical_registry",
      ],
    },
    {
      source: "supported_service_vertical_registry" as const,
      mergedSections: ["idealCustomers.supportedServiceVerticals"],
    },
    {
      source: "approved_business_profile" as const,
      mergedSections: ["company", "idealCustomers", "problemsAndTriggers"],
    },
  ]
}

/** Future customer verticals validated by the same onboarding pipeline. */
export const FUTURE_CUSTOMER_VERTICAL_SMOKE_TESTS = [
  "hvac_r",
  "medical_equipment",
  "fire_security",
  "locksmith",
  "property_management",
  "commercial_kitchen",
  "calibration_inspection",
  "garage_door",
  "appliance_repair",
] as const
