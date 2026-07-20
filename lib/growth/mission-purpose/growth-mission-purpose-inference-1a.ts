/** GE-AIOS-LIVE-1A / LIVE-1B — Legacy mission purpose inference (migration helper only). */

import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthLead } from "@/lib/growth/types"
import {
  GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
  type GrowthCertificationFixturePolicy,
  type GrowthMissionPurpose,
  type GrowthMissionPurposeResolution,
  type GrowthMissionPurposeResolutionContext,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"

function buildDefaultCertificationFixturePolicy(): GrowthCertificationFixturePolicy {
  return {
    metadataMissionPurposeKey: "mission_purpose",
    companyNamePatterns: [...DEFAULT_CERTIFICATION_COMPANY_NAME_PATTERNS],
    metadataKeyPrefixes: [...DEFAULT_CERTIFICATION_METADATA_PREFIXES],
    metadataKeySuffixes: [...DEFAULT_CERTIFICATION_METADATA_SUFFIXES],
  }
}

const DEFAULT_CERTIFICATION_COMPANY_NAME_PATTERNS = [
  "\\(Transport Fidelity Cert\\)",
  "\\(Supervised Sales Cert\\)",
  "\\(Certification Fixture\\)",
  "\\(Cert Fixture\\)",
] as const

const DEFAULT_CERTIFICATION_METADATA_PREFIXES = ["ge_aios_", "growth_"] as const
const DEFAULT_CERTIFICATION_METADATA_SUFFIXES = ["_cert", "_certification"] as const

const TERMINAL_CERTIFICATION_DRAFT_FACTORY_STATES = new Set([
  "waiting_for_approval",
  "waiting_for_generation",
  "draft_ready",
])

function asMetadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {}
}

export function normalizeGrowthMissionPurpose(value: unknown): GrowthMissionPurpose | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  if (
    normalized === "production" ||
    normalized === "certification" ||
    normalized === "training" ||
    normalized === "demo"
  ) {
    return normalized
  }
  return null
}

function resolveFixtureTypePurpose(metadata: Record<string, unknown>): GrowthMissionPurpose | null {
  const fixtureType = metadata.fixture_type
  if (fixtureType === "golden" || fixtureType === "certification") return "certification"
  return null
}

function metadataKeyMatchesCertificationPattern(
  key: string,
  policy: GrowthCertificationFixturePolicy | null,
): boolean {
  const prefixes = policy?.metadataKeyPrefixes ?? [...DEFAULT_CERTIFICATION_METADATA_PREFIXES]
  const suffixes = policy?.metadataKeySuffixes ?? [...DEFAULT_CERTIFICATION_METADATA_SUFFIXES]
  const lower = key.toLowerCase()
  return (
    prefixes.some((prefix) => lower.startsWith(prefix.toLowerCase())) &&
    suffixes.some((suffix) => lower.endsWith(suffix.toLowerCase()))
  )
}

function resolveCertificationMetadataKeyPurpose(
  metadata: Record<string, unknown>,
  policy: GrowthCertificationFixturePolicy | null,
): GrowthMissionPurpose | null {
  if (metadata.certification_fixture === true) return "certification"
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== true && value !== "true") continue
    if (metadataKeyMatchesCertificationPattern(key, policy)) return "certification"
  }
  return null
}

function compileCompanyNamePatterns(policy: GrowthCertificationFixturePolicy | null): RegExp[] {
  const configured = policy?.companyNamePatterns ?? []
  const combined = [...DEFAULT_CERTIFICATION_COMPANY_NAME_PATTERNS, ...configured]
  return combined
    .map((pattern) => {
      try {
        return new RegExp(pattern, "i")
      } catch {
        return null
      }
    })
    .filter((pattern): pattern is RegExp => Boolean(pattern))
}

function resolveCompanyNamePatternPurpose(
  companyName: string | null | undefined,
  policy: GrowthCertificationFixturePolicy | null,
): GrowthMissionPurpose | null {
  const name = companyName?.trim()
  if (!name) return null
  return compileCompanyNamePatterns(policy).some((pattern) => pattern.test(name))
    ? "certification"
    : null
}

function resolveLegacyPreProductionFixturePurpose(input: {
  lead: Pick<GrowthLead, "createdAt" | "metadata">
  context: GrowthMissionPurposeResolutionContext
  draftFactoryState: string | null
  hasPendingApprovalPackage: boolean
}): GrowthMissionPurpose | null {
  const activatedAt = input.context.productionMissionActivatedAt
  const createdAt = input.lead.createdAt
  if (!activatedAt || !createdAt || createdAt >= activatedAt) return null

  const draftState = input.draftFactoryState?.trim().toLowerCase() ?? ""
  if (TERMINAL_CERTIFICATION_DRAFT_FACTORY_STATES.has(draftState)) return "certification"
  if (input.hasPendingApprovalPackage) return "certification"
  return null
}

/** Infer mission purpose from legacy signals — migration compatibility only. */
export function inferLeadMissionPurposeFromLegacy(input: {
  lead: Pick<GrowthLead, "id" | "companyName" | "createdAt" | "metadata">
  context: GrowthMissionPurposeResolutionContext
}): GrowthMissionPurposeResolution {
  const metadata = asMetadataRecord(input.lead.metadata)
  const policy = input.context.certificationFixturePolicy ?? buildDefaultCertificationFixturePolicy()
  const draftFactoryState = input.context.draftFactoryStateByLeadId?.get(input.lead.id) ?? null
  const hasPendingApprovalPackage = input.context.pendingApprovalLeadIds?.has(input.lead.id) === true

  const fixtureType = resolveFixtureTypePurpose(metadata)
  if (fixtureType) {
    return {
      qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
      purpose: fixtureType,
      source: "fixture_type",
      reason: `metadata.fixture_type=${String(metadata.fixture_type)}`,
    }
  }

  const certificationKey = resolveCertificationMetadataKeyPurpose(metadata, policy)
  if (certificationKey) {
    return {
      qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
      purpose: certificationKey,
      source: metadata.certification_fixture === true ? "certification_fixture_flag" : "certification_metadata_key",
      reason: "certification metadata marker",
    }
  }

  const companyPattern = resolveCompanyNamePatternPurpose(input.lead.companyName, policy)
  if (companyPattern) {
    return {
      qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
      purpose: companyPattern,
      source: "company_name_pattern",
      reason: "company name certification pattern",
    }
  }

  const legacy = resolveLegacyPreProductionFixturePurpose({
    lead: input.lead,
    context: input.context,
    draftFactoryState,
    hasPendingApprovalPackage,
  })
  if (legacy) {
    return {
      qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
      purpose: legacy,
      source: "legacy_pre_production_fixture",
      reason: "pre-production certification fixture",
    }
  }

  return {
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    purpose: "production",
    source: "default_production",
    reason: null,
  }
}

export function inferObjectiveMissionPurposeFromLegacy(objective: GrowthObjective): GrowthMissionPurposeResolution {
  const stages = objective.executionContext?.stages ?? {}
  const artifacts = Object.values(stages).flatMap((stage) => stage?.artifacts ?? [])
  const certArtifacts = artifacts.filter((artifact) => artifact.metadata?.certificationMode === true)
  if (artifacts.length > 0 && certArtifacts.length === artifacts.length) {
    return {
      qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
      purpose: "certification",
      source: "objective_certification_mode",
      reason: "objective materialization ran in certification mode",
    }
  }

  if (objective.executionHistory.some((entry) => entry.detail === "certification_start")) {
    return {
      qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
      purpose: "certification",
      source: "objective_certification_mode",
      reason: "objective runtime certification_start",
    }
  }

  return {
    qaMarker: GROWTH_MISSION_PURPOSE_1A_QA_MARKER,
    purpose: "production",
    source: "default_production",
    reason: null,
  }
}
