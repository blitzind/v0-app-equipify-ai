/** GE-AIOS-LIVE-1A — Canonical mission purpose for production vs certification operations (client-safe). */

export const GROWTH_MISSION_PURPOSE_1A_QA_MARKER = "ge-aios-live-1a-mission-purpose-v1" as const

export const GROWTH_MISSION_PURPOSE_1A_PHASE = "GE-AIOS-LIVE-1A" as const

/** GE-AIOS-LIVE-1B — Canonical persisted missionPurpose authority. */
export const GROWTH_MISSION_PURPOSE_1B_QA_MARKER = "ge-aios-live-1b-mission-purpose-authority-v1" as const

export const GROWTH_MISSION_PURPOSE_1B_PHASE = "GE-AIOS-LIVE-1B" as const

export const GROWTH_MISSION_PURPOSE_METADATA_KEY = "mission_purpose" as const

export const GROWTH_MISSION_PURPOSE_MIGRATED_AT_METADATA_KEY = "mission_purpose_migrated_at" as const

export const GROWTH_MISSION_PURPOSE_MIGRATION_MARKER_METADATA_KEY = "mission_purpose_migration_marker" as const

export const GROWTH_MISSION_PURPOSES = [
  "production",
  "certification",
  "training",
  "demo",
] as const

export type GrowthMissionPurpose = (typeof GROWTH_MISSION_PURPOSES)[number]

export type GrowthMissionPurposeScope = "operations" | "diagnostics" | "all"

export type GrowthCertificationFixturePolicy = {
  metadataMissionPurposeKey?: string
  companyNamePatterns?: string[]
  metadataKeyPrefixes?: string[]
  metadataKeySuffixes?: string[]
}

export type GrowthMissionPurposeResolutionContext = {
  qaMarker: typeof GROWTH_MISSION_PURPOSE_1A_QA_MARKER
  organizationId: string
  productionMissionActivatedAt: string | null
  certificationFixturePolicy: GrowthCertificationFixturePolicy | null
  draftFactoryStateByLeadId?: ReadonlyMap<string, string | null>
  pendingApprovalLeadIds?: ReadonlySet<string>
}

export type GrowthMissionPurposeResolution = {
  qaMarker: typeof GROWTH_MISSION_PURPOSE_1A_QA_MARKER
  purpose: GrowthMissionPurpose
  source:
    | "canonical_persisted"
    | "explicit_metadata"
    | "fixture_type"
    | "certification_fixture_flag"
    | "certification_metadata_key"
    | "company_name_pattern"
    | "legacy_pre_production_fixture"
    | "objective_certification_mode"
    | "package_certification_signal"
    | "default_production"
  reason: string | null
}

export type GrowthProductionMissionAuthority = {
  qaMarker: typeof GROWTH_MISSION_PURPOSE_1A_QA_MARKER
  title: string
  objectiveStatement: string
  portfolioBelowTarget: boolean
  discoveryActive: boolean
  operatorSummaryLines: string[]
  primaryFocus:
    | "discovery"
    | "research"
    | "admission"
    | "approvals"
    | "portfolio_health"
    | "maintain_capacity"
}
