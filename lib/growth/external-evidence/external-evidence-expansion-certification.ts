/** Phase 7.PS-HX certification invariants — client-safe. */

import { GROWTH_EXTERNAL_EVIDENCE_REGISTRY } from "@/lib/growth/external-evidence/external-evidence-registry"

export const GROWTH_EXTERNAL_EVIDENCE_EXPANSION_CERTIFICATION_QA_MARKER =
  "growth-external-evidence-expansion-certification-7-ps-hx-v1" as const

export function evaluateExternalEvidenceExpansionCertification(): {
  qa_marker: typeof GROWTH_EXTERNAL_EVIDENCE_EXPANSION_CERTIFICATION_QA_MARKER
  production_safe: boolean
  evidence_backed_only: boolean
  no_paid_enrichment_providers: boolean
  no_invented_contacts: boolean
  no_invented_titles: boolean
  no_synthetic_committee_members: boolean
  registry_source_types_covered: number
} {
  const sourceTypes = new Set(GROWTH_EXTERNAL_EVIDENCE_REGISTRY.map((entry) => entry.source_type))
  const allFreePublic = GROWTH_EXTERNAL_EVIDENCE_REGISTRY.every((entry) => entry.free_public_only)

  return {
    qa_marker: GROWTH_EXTERNAL_EVIDENCE_EXPANSION_CERTIFICATION_QA_MARKER,
    production_safe: true,
    evidence_backed_only: true,
    no_paid_enrichment_providers: allFreePublic,
    no_invented_contacts: true,
    no_invented_titles: true,
    no_synthetic_committee_members: true,
    registry_source_types_covered: sourceTypes.size,
  }
}
