/** AVA-GROWTH-HOTFIX-1F-1D — Canonical organization training projection (client-safe). */

import type { BusinessProfileRecord } from "@/lib/growth/business-profile/business-profile-types"
import type { GrowthAvaActivationReadiness } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import type { GrowthHomeOrganizationalKnowledgePayload } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { GrowthHomeLaunchMissionSetupViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"

export const GROWTH_CANONICAL_ORGANIZATION_TRAINING_PROJECTION_1D_QA_MARKER =
  "ava-growth-hotfix-1f-1d-canonical-organization-training-projection-v1" as const

export type GrowthCanonicalOrganizationTrainingProfileState =
  | "approved"
  | "draft_only"
  | "missing"

export type GrowthCanonicalOrganizationTrainingStrategyState =
  | "complete"
  | "partial"
  | "missing"

export type GrowthCanonicalOrganizationTrainingRunbookState =
  | "complete"
  | "partial"
  | "missing"

export type GrowthCanonicalOrganizationTrainingDiagnostic = {
  organizationId: string
  companyProfileState: GrowthCanonicalOrganizationTrainingProfileState
  businessStrategyState: GrowthCanonicalOrganizationTrainingStrategyState
  runbookState: GrowthCanonicalOrganizationTrainingRunbookState
  validatedLearningCount: number
  activationReadinessReady: boolean
  activationBlockingReasons: string[]
  setupIncomplete: boolean
  avaPreviouslyActivated: boolean
  sourceRecords: {
    approvedProfileId: string | null
    latestDraftId: string | null
    activationRecordPresent: boolean
    autonomousActivatedAt: string | null
    organizationalKnowledgeSource: GrowthHomeOrganizationalKnowledgePayload["source"] | null
  }
}

export type GrowthCanonicalOrganizationTrainingProjection = {
  qaMarker: typeof GROWTH_CANONICAL_ORGANIZATION_TRAINING_PROJECTION_1D_QA_MARKER
  organizationId: string
  generatedAt: string
  activeApproved: BusinessProfileRecord | null
  latestDraft: BusinessProfileRecord | null
  launchSetup: GrowthHomeLaunchMissionSetupViewModel | null
  organizationalKnowledge: GrowthHomeOrganizationalKnowledgePayload | null
  activationReadiness: GrowthAvaActivationReadiness
  setupIncomplete: boolean
  diagnostic: GrowthCanonicalOrganizationTrainingDiagnostic
}
