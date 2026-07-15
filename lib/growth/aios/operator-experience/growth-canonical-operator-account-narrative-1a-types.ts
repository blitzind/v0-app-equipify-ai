/**
 * GE-AIOS-OPERATOR-STORY-IMPLEMENTATION-1A — Single authoritative account narrative (client-safe).
 */

import type { GrowthCanonicalDisplayIdentity } from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b-types"
import { GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"

export type GrowthCanonicalOperatorAccountNarrative = {
  qaMarker: typeof GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER
  leadId: string
  companyDisplayName: string
  /** Single authoritative "what happened" line — all surfaces reference this. */
  whatHappened: string
  currentFocus: string
  nextStep: string
  evidence: string[]
  decisionFingerprint: string | null
  identity: GrowthCanonicalDisplayIdentity | null
}
