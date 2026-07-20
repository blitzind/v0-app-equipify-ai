/** GE-AIOS-LIVE-1A / LIVE-1B — Mission purpose resolver facade (client-safe). */

import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthLead } from "@/lib/growth/types"
import {
  isOperationalMissionPurpose,
  isProductionMissionPurpose,
  readCanonicalLeadMissionPurpose,
  readCanonicalObjectiveMissionPurpose,
  resolveLeadMissionPurposeForOperations,
  resolveObjectiveMissionPurposeForOperations,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-canonical-1b"
import {
  inferLeadMissionPurposeFromLegacy,
  inferObjectiveMissionPurposeFromLegacy,
  normalizeGrowthMissionPurpose,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-inference-1a"
import {
  GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
  type GrowthCertificationFixturePolicy,
  type GrowthMissionPurpose,
  type GrowthMissionPurposeResolution,
  type GrowthMissionPurposeResolutionContext,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"

const DEFAULT_CERTIFICATION_COMPANY_NAME_PATTERNS = [
  "\\(Transport Fidelity Cert\\)",
  "\\(Supervised Sales Cert\\)",
  "\\(Certification Fixture\\)",
  "\\(Cert Fixture\\)",
] as const

const DEFAULT_CERTIFICATION_METADATA_PREFIXES = ["ge_aios_", "growth_"] as const
const DEFAULT_CERTIFICATION_METADATA_SUFFIXES = ["_cert", "_certification"] as const

export function buildDefaultCertificationFixturePolicy(): GrowthCertificationFixturePolicy {
  return {
    metadataMissionPurposeKey: "mission_purpose",
    companyNamePatterns: [...DEFAULT_CERTIFICATION_COMPANY_NAME_PATTERNS],
    metadataKeyPrefixes: [...DEFAULT_CERTIFICATION_METADATA_PREFIXES],
    metadataKeySuffixes: [...DEFAULT_CERTIFICATION_METADATA_SUFFIXES],
  }
}

export function buildMissionPurposeResolutionContext(input: {
  organizationId: string
  productionMissionActivatedAt?: string | null
  certificationFixturePolicy?: GrowthCertificationFixturePolicy | null
  draftFactoryStateByLeadId?: ReadonlyMap<string, string | null>
  pendingApprovalLeadIds?: ReadonlySet<string>
}): GrowthMissionPurposeResolutionContext {
  return {
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    organizationId: input.organizationId,
    productionMissionActivatedAt: input.productionMissionActivatedAt ?? null,
    certificationFixturePolicy: input.certificationFixturePolicy ?? buildDefaultCertificationFixturePolicy(),
    draftFactoryStateByLeadId: input.draftFactoryStateByLeadId,
    pendingApprovalLeadIds: input.pendingApprovalLeadIds,
  }
}

/** Operational runtime — canonical missionPurpose only (LIVE-1B). */
export function resolveLeadMissionPurpose(input: {
  lead: Pick<GrowthLead, "id" | "companyName" | "createdAt" | "metadata">
  context?: GrowthMissionPurposeResolutionContext
}): GrowthMissionPurposeResolution {
  void input.context
  return resolveLeadMissionPurposeForOperations({ lead: input.lead })
}

/** Operational runtime — canonical missionPurpose only (LIVE-1B). */
export function resolveObjectiveMissionPurpose(objective: GrowthObjective): GrowthMissionPurposeResolution {
  return resolveObjectiveMissionPurposeForOperations(objective)
}

/** Migration helper — infer legacy signals once before persistence. */
export function inferLeadMissionPurposeForMigration(input: {
  lead: Pick<GrowthLead, "id" | "companyName" | "createdAt" | "metadata">
  context: GrowthMissionPurposeResolutionContext
}): GrowthMissionPurposeResolution {
  const canonical = readCanonicalLeadMissionPurpose(input.lead.metadata)
  if (canonical) {
    return {
      qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
      purpose: canonical,
      source: "canonical_persisted",
      reason: `mission_purpose=${canonical}`,
    }
  }
  return inferLeadMissionPurposeFromLegacy(input)
}

/** Migration helper — infer legacy objective signals once before persistence. */
export function inferObjectiveMissionPurposeForMigration(objective: GrowthObjective): GrowthMissionPurposeResolution {
  const canonical = readCanonicalObjectiveMissionPurpose(objective.executionContext)
  if (canonical) {
    return {
      qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
      purpose: canonical,
      source: "canonical_persisted",
      reason: "executionContext.missionPurpose",
    }
  }
  return inferObjectiveMissionPurposeFromLegacy(objective)
}

export function resolvePackageMissionPurpose(input: {
  pkg: Pick<
    GrowthAutonomousOutreachApprovalPackage,
    "leadId" | "companyName" | "expectedOutcome" | "complianceNotes"
  >
  leadPurpose?: GrowthMissionPurpose | null
}): GrowthMissionPurposeResolution {
  const leadPurpose = input.leadPurpose ?? "production"
  return {
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    purpose: leadPurpose,
    source: "canonical_persisted",
    reason: "package inherits lead missionPurpose",
  }
}

export { isProductionMissionPurpose, isOperationalMissionPurpose, normalizeGrowthMissionPurpose }

export function buildLeadMissionPurposeIndex(input: {
  leads: Array<Pick<GrowthLead, "id" | "companyName" | "createdAt" | "metadata">>
  context?: GrowthMissionPurposeResolutionContext
}): Map<string, GrowthMissionPurposeResolution> {
  void input.context
  const index = new Map<string, GrowthMissionPurposeResolution>()
  for (const lead of input.leads) {
    index.set(lead.id, resolveLeadMissionPurposeForOperations({ lead }))
  }
  return index
}

export function filterLeadsForMissionPurposeScope<T extends Pick<GrowthLead, "id">>(
  leads: T[],
  purposeByLeadId: ReadonlyMap<string, GrowthMissionPurposeResolution>,
  scope: "operations" | "diagnostics" | "all" = "operations",
): T[] {
  if (scope !== "operations") return leads
  return leads.filter((lead) => {
    const purpose = purposeByLeadId.get(lead.id)?.purpose ?? "production"
    return isOperationalMissionPurpose(purpose, scope)
  })
}

export function filterObjectivesForMissionPurposeScope(
  objectives: GrowthObjective[],
  scope: "operations" | "diagnostics" | "all" = "operations",
): GrowthObjective[] {
  if (scope !== "operations") return objectives
  return objectives.filter((objective) =>
    isOperationalMissionPurpose(resolveObjectiveMissionPurposeForOperations(objective).purpose, scope),
  )
}

export const GE_AIOS_LIVE_1A_MISSION_PURPOSE_QA_MARKER = GROWTH_MISSION_PURPOSE_1A_QA_MARKER
