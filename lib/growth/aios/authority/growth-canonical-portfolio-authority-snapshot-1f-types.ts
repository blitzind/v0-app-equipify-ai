/** AVA-GROWTH-OPERATOR-1F — Portfolio authority snapshot for Home read model (client-safe). */

import type { GrowthCanonicalOpportunityAuthorityMap } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"
import type { GrowthEscalationAgreementSnapshot } from "@/lib/growth/aios/authority/growth-canonical-escalation-authority-1c"

export const GROWTH_CANONICAL_PORTFOLIO_AUTHORITY_SNAPSHOT_1F_QA_MARKER =
  "ava-growth-operator-1f-portfolio-authority-snapshot-v1" as const

export type GrowthCanonicalPortfolioAuthoritySnapshot = {
  qaMarker: typeof GROWTH_CANONICAL_PORTFOLIO_AUTHORITY_SNAPSHOT_1F_QA_MARKER
  generatedAt: string
  authorityByLeadId: GrowthCanonicalOpportunityAuthorityMap
  escalationTelemetry: GrowthEscalationAgreementSnapshot
  hydratedLeadCount: number
}
