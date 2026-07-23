/** AVA-GROWTH-HOTFIX-1F-1D — Single read authority for organization training + activation readiness. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
  type GrowthAvaActivationState,
} from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import { evaluateGrowthAvaActivationReadiness } from "@/lib/growth/ava-activation/growth-ava-activation-readiness-1c"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import type { BusinessProfileRecord } from "@/lib/growth/business-profile/business-profile-types"
import {
  getActiveApprovedBusinessProfile,
  getLatestDraftBusinessProfile,
} from "@/lib/growth/business-profile/business-profile-repository"
import { areStartupAutonomyGuardrailsConfigured } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import { filterValidatedInstitutionalLearnings } from "@/lib/growth/memory/institutional-learning/growth-institutional-learning-truthfulness-1a"
import type { GrowthHomeOrganizationalKnowledgePayload } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import { buildConnectedMailboxesDashboard } from "@/lib/growth/mailboxes/connected-mailboxes-dashboard"
import { buildGrowthOperatorSetupHealth } from "@/lib/growth/operational/ge-v1-2-operator-setup-health-service"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import {
  getAiTeammateOnboardingCompletedForUser,
  getOrganizationAiTeammateAutonomousActivation,
} from "@/lib/growth/settings/growth-ai-teammate-identity-repository"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import {
  GROWTH_CANONICAL_ORGANIZATION_TRAINING_PROJECTION_1D_QA_MARKER,
  type GrowthCanonicalOrganizationTrainingDiagnostic,
  type GrowthCanonicalOrganizationTrainingProjection,
  type GrowthCanonicalOrganizationTrainingProfileState,
  type GrowthCanonicalOrganizationTrainingRunbookState,
  type GrowthCanonicalOrganizationTrainingStrategyState,
} from "@/lib/growth/training/growth-canonical-organization-training-projection-types"
import { synthesizeGrowthHomeLaunchMissionSetup } from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

function resolveProfileState(input: {
  activeApproved: BusinessProfileRecord | null
  latestDraft: BusinessProfileRecord | null
}): GrowthCanonicalOrganizationTrainingProfileState {
  if (input.activeApproved) return "approved"
  if (input.latestDraft) return "draft_only"
  return "missing"
}

function resolveStrategyState(input: {
  activeApproved: BusinessProfileRecord | null
  latestDraft: BusinessProfileRecord | null
}): GrowthCanonicalOrganizationTrainingStrategyState {
  const approvedCompleteness = input.activeApproved
    ? evaluateBusinessStrategyCompleteness(input.activeApproved.profile.businessStrategy)
    : null
  if (approvedCompleteness?.hasContent) {
    return approvedCompleteness.missingAreas.length > 0 ? "partial" : "complete"
  }

  const draftCompleteness = input.latestDraft
    ? evaluateBusinessStrategyCompleteness(input.latestDraft.profile.businessStrategy)
    : null
  if (draftCompleteness?.hasContent) return "partial"
  return "missing"
}

function resolveRunbookState(
  launchSetup: GrowthCanonicalOrganizationTrainingProjection["launchSetup"],
): GrowthCanonicalOrganizationTrainingRunbookState {
  if (!launchSetup) return "missing"
  if (launchSetup.setupComplete) return "complete"
  if (launchSetup.completedStepCount > 0) return "partial"
  return "missing"
}

export function buildGrowthCanonicalOrganizationTrainingDiagnostic(input: {
  organizationId: string
  activeApproved: BusinessProfileRecord | null
  latestDraft: BusinessProfileRecord | null
  launchSetup: GrowthCanonicalOrganizationTrainingProjection["launchSetup"]
  organizationalKnowledge: GrowthHomeOrganizationalKnowledgePayload | null
  activationReadiness: GrowthCanonicalOrganizationTrainingProjection["activationReadiness"]
  activationRecordPresent: boolean
  autonomousActivatedAt: string | null
}): GrowthCanonicalOrganizationTrainingDiagnostic {
  const validatedLearningCount = filterValidatedInstitutionalLearnings(
    input.organizationalKnowledge?.store.items ?? [],
  ).length

  return {
    organizationId: input.organizationId,
    companyProfileState: resolveProfileState(input),
    businessStrategyState: resolveStrategyState(input),
    runbookState: resolveRunbookState(input.launchSetup),
    validatedLearningCount,
    activationReadinessReady: input.activationReadiness.ready,
    activationBlockingReasons: input.activationReadiness.blockers.map((blocker) => blocker.summary),
    setupIncomplete: !input.activationReadiness.ready,
    avaPreviouslyActivated: input.activationRecordPresent,
    sourceRecords: {
      approvedProfileId: input.activeApproved?.id ?? null,
      latestDraftId: input.latestDraft?.id ?? null,
      activationRecordPresent: input.activationRecordPresent,
      autonomousActivatedAt: input.autonomousActivatedAt,
      organizationalKnowledgeSource: input.organizationalKnowledge?.source ?? null,
    },
  }
}

export function buildGrowthAvaActivationFallbackFromTrainingProjection(input: {
  projection: GrowthCanonicalOrganizationTrainingProjection
  autonomyEnabled: boolean
  objectiveModeEnabled: boolean
}): GrowthAvaActivationState {
  const persistedActivationAt =
    input.projection.diagnostic.sourceRecords.autonomousActivatedAt ?? null
  const activatedAt =
    persistedActivationAt ??
    (input.autonomyEnabled && input.objectiveModeEnabled
      ? input.projection.activeApproved?.approvedAt ?? null
      : null)
  const activated =
    persistedActivationAt != null && input.autonomyEnabled && input.objectiveModeEnabled

  return {
    qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
    activated,
    activatedAt,
    autonomyEnabled: input.autonomyEnabled,
    objectiveModeEnabled: input.objectiveModeEnabled,
    readiness: input.projection.activationReadiness,
    employment: null,
  }
}

export async function loadGrowthCanonicalOrganizationTrainingProjection(input: {
  admin: SupabaseClient
  organizationId: string
  actorUserId: string | null
  generatedAt: string
  preloaded?: {
    activeApproved?: BusinessProfileRecord | null
    latestDraft?: BusinessProfileRecord | null
    organizationalKnowledge?: GrowthHomeOrganizationalKnowledgePayload | null
    objectives?: GrowthObjective[]
  }
}): Promise<GrowthCanonicalOrganizationTrainingProjection> {
  const actorUserId = input.actorUserId?.trim() ?? ""
  const hasActor = Boolean(actorUserId && actorUserId !== "undefined")

  const [
    activeApproved,
    latestDraft,
    objectives,
    activationRecord,
    onboardingCompleted,
    mailboxesDashboard,
    setupHealth,
    autonomySettings,
  ] = await Promise.all([
    input.preloaded?.activeApproved !== undefined
      ? Promise.resolve(input.preloaded.activeApproved)
      : getActiveApprovedBusinessProfile(input.admin, input.organizationId),
    input.preloaded?.latestDraft !== undefined
      ? Promise.resolve(input.preloaded.latestDraft)
      : getLatestDraftBusinessProfile(input.admin, input.organizationId),
    input.preloaded?.objectives !== undefined
      ? Promise.resolve(input.preloaded.objectives)
      : listGrowthObjectives(input.admin, input.organizationId),
    getOrganizationAiTeammateAutonomousActivation(input.admin, input.organizationId),
    hasActor
      ? getAiTeammateOnboardingCompletedForUser(input.admin, actorUserId)
      : Promise.resolve(false),
    buildConnectedMailboxesDashboard(input.admin),
    hasActor
      ? buildGrowthOperatorSetupHealth(input.admin, {
          organizationId: input.organizationId,
          userId: actorUserId,
        })
      : Promise.resolve(null),
    fetchGrowthAutonomySettings(input.admin, input.organizationId),
  ])

  const connectedMailboxes = mailboxesDashboard.summary.connectedMailboxes
  const expiredMailboxes = mailboxesDashboard.summary.disconnectedMailboxes
  const mailboxWarnings = setupHealth?.warningCount ?? 0

  const launchSetup = synthesizeGrowthHomeLaunchMissionSetup({
    businessProfileApproved: Boolean(activeApproved),
    hasBusinessProfileDraft: Boolean(latestDraft),
    objectives,
    mailboxWarnings,
    expiredMailboxes,
    connectedMailboxes,
    aiTeammateOnboardingCompleted: onboardingCompleted,
    autonomyGuardrailsConfigured: areStartupAutonomyGuardrailsConfigured({
      approvalPolicies: autonomySettings.approvalPolicies,
    }),
  })

  const activationReadiness = evaluateGrowthAvaActivationReadiness({
    businessProfileApproved: Boolean(activeApproved),
    objectives,
    mailboxWarnings,
    expiredMailboxes,
    connectedMailboxes,
    aiTeammateOnboardingCompleted: onboardingCompleted,
    approvalPolicies: autonomySettings.approvalPolicies,
  })

  const organizationalKnowledge = input.preloaded?.organizationalKnowledge ?? null

  const diagnostic = buildGrowthCanonicalOrganizationTrainingDiagnostic({
    organizationId: input.organizationId,
    activeApproved,
    latestDraft,
    launchSetup,
    organizationalKnowledge,
    activationReadiness,
    activationRecordPresent: Boolean(activationRecord?.autonomousActivatedAt),
    autonomousActivatedAt: activationRecord?.autonomousActivatedAt ?? null,
  })

  return {
    qaMarker: GROWTH_CANONICAL_ORGANIZATION_TRAINING_PROJECTION_1D_QA_MARKER,
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    activeApproved,
    latestDraft,
    launchSetup,
    organizationalKnowledge,
    activationReadiness,
    setupIncomplete: diagnostic.setupIncomplete,
    diagnostic,
  }
}

export async function loadGrowthAvaActivationStateCore(input: {
  admin: SupabaseClient
  organizationId: string
  actorUserId: string
  generatedAt: string
  preloadedProjection?: GrowthCanonicalOrganizationTrainingProjection | null
}): Promise<Omit<GrowthAvaActivationState, "employment">> {
  const actorUserId = input.actorUserId.trim()
  if (!actorUserId || actorUserId === "undefined") {
    throw new Error("actorUserId is required for Ava activation state.")
  }

  const projection =
    input.preloadedProjection ??
    (await loadGrowthCanonicalOrganizationTrainingProjection({
      admin: input.admin,
      organizationId: input.organizationId,
      actorUserId,
      generatedAt: input.generatedAt,
    }))

  const [killSwitches, activationRecord] = await Promise.all([
    getRuntimeKillSwitchStates(input.admin),
    getOrganizationAiTeammateAutonomousActivation(input.admin, input.organizationId),
  ])

  const autonomyEnabled = killSwitches.autonomy_enabled === true
  const objectiveModeEnabled = killSwitches.autonomy_objective_mode_enabled === true
  const persistedActivationAt = activationRecord?.autonomousActivatedAt ?? null
  const activatedAt =
    persistedActivationAt ??
    (autonomyEnabled && objectiveModeEnabled ? projection.activeApproved?.approvedAt ?? null : null)
  const activated = persistedActivationAt != null && autonomyEnabled && objectiveModeEnabled

  return {
    qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
    activated,
    activatedAt,
    autonomyEnabled,
    objectiveModeEnabled,
    readiness: projection.activationReadiness,
  }
}
