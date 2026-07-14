/**
 * GE-AIOS-DECISION-ENGINE-1D — Growth 5F package gate for direct callers (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { resolveGrowthCanonicalDecisionForLeadCached } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import { evaluateGrowth5fPackagePreparation } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import type { GrowthCanonicalPackagePreparationEnforcement } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthAutonomousOutreachPreparationWakeCondition } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-types"

export class Growth5fPackagePreparationBlockedError extends Error {
  readonly outcome: string
  readonly enforcement: GrowthCanonicalPackagePreparationEnforcement

  constructor(enforcement: GrowthCanonicalPackagePreparationEnforcement) {
    super(enforcement.reason)
    this.name = "Growth5fPackagePreparationBlockedError"
    this.outcome = enforcement.outcome
    this.enforcement = enforcement
  }
}

export async function assertGrowth5fPackagePreparationAllowed(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    generatedAt: string
    proposedPurpose?: string | null
    wakeCondition?: GrowthAutonomousOutreachPreparationWakeCondition
    previousPackage?: GrowthAutonomousOutreachApprovalPackage | null
    isOperatorRebuild?: boolean
    isMaterialRefresh?: boolean
    cacheScope?: string
  },
): Promise<GrowthCanonicalPackagePreparationEnforcement> {
  const resolution = await resolveGrowthCanonicalDecisionForLeadCached(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    packageSnapshot: input.previousPackage ?? undefined,
    cacheScope: input.cacheScope ?? "growth5f:direct-caller",
  }).catch(() => null)

  const enforcement = evaluateGrowth5fPackagePreparation(resolution, {
    proposedPurpose: input.proposedPurpose ?? input.previousPackage?.expectedOutcome ?? null,
    wakeCondition: input.wakeCondition,
    isOperatorRebuild: input.isOperatorRebuild,
    isMaterialRefresh: input.isMaterialRefresh,
  })

  if (!enforcement.allowed) {
    logGrowthEngine("growth_5f_direct_caller_blocked_by_canonical_decision", {
      qa_marker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      outcome: enforcement.outcome,
      reason: enforcement.reason,
      enforcement_fingerprint: enforcement.enforcementFingerprint,
    })
    throw new Growth5fPackagePreparationBlockedError(enforcement)
  }

  return enforcement
}
