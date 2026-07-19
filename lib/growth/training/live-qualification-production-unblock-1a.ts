/**
 * GE-AIOS-LIVE-QUALIFICATION-1A — Production qualification progression unblock.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAvaResearchQueueOrchestrator } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-service"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  evaluateQualificationPilotAutonomyPolicyGate,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { upsertGrowthAutonomySettings, fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import type { GrowthAutonomyMasterMode } from "@/lib/growth/autonomy/growth-autonomy-types"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { isDatamoonProviderEnabled } from "@/lib/growth/providers/datamoon/datamoon-config"
import { evaluateAutonomousProspectDiscoveryProviderPolicy } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { diagnoseAdmissionQueue } from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"

export const GROWTH_AIOS_LIVE_QUALIFICATION_1A_QA_MARKER =
  "ge-aios-live-qualification-1a-v1" as const

export const CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR =
  "CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR" as const

export type LiveQualificationAutonomyDiagnosis = {
  masterMode: GrowthAutonomyMasterMode
  enrichmentCapabilityEnabled: boolean
  qualificationAutonomyEnabled: boolean
  qualificationPolicyGate: ReturnType<typeof evaluateQualificationPilotAutonomyPolicyGate>
  firstBlocker: string | null
}

export type LiveQualificationRepairPlan = {
  applyMasterModeObjective: boolean
  applyEnrichmentCapability: boolean
  before: LiveQualificationAutonomyDiagnosis
  after: LiveQualificationAutonomyDiagnosis | null
}

export type LiveQualificationValidationReport = {
  qaMarker: typeof GROWTH_AIOS_LIVE_QUALIFICATION_1A_QA_MARKER
  organizationId: string
  deployedSha: string | null
  queueBefore: Awaited<ReturnType<typeof diagnoseAdmissionQueue>>
  queueAfter: Awaited<ReturnType<typeof diagnoseAdmissionQueue>>
  datamoon: {
    providerEnabledInProcessEnv: boolean
    discoveryStopReason: string | null
    datamoonEligibleForAutonomousDiscovery: boolean
  }
  autonomyBefore: LiveQualificationAutonomyDiagnosis
  autonomyAfter: LiveQualificationAutonomyDiagnosis | null
  repairApplied: boolean
  researchOrchestratorRunId: string | null
  researchCompleted: number
  qualificationCompleted: number
  qualificationBlocked: number
  readyForOutreachReview: number
  sampleLeadIds: string[]
  operatorPackageCount: number
  executiveVerdict: "PASS" | "PASS WITH LIMITATIONS" | "FAIL"
  verdictReasons: string[]
  firstRemainingBlocker: string | null
  recommendedNextAction: string
}

export async function diagnoseLiveQualificationAutonomy(
  admin: SupabaseClient,
  organizationId: string,
): Promise<LiveQualificationAutonomyDiagnosis> {
  const settings = await fetchGrowthAutonomySettings(admin, organizationId)
  const evaluationContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, { organizationId })
  const qualificationPolicyGate = evaluateQualificationPilotAutonomyPolicyGate(evaluationContext)
  const qualificationAgent = evaluationContext.policy.agentStates.find(
    (state) => state.agentKind === "qualification_agent",
  )

  let firstBlocker: string | null = null
  if (settings.masterMode === "manual") {
    firstBlocker = "manual_master_mode_blocks_qualification_agent"
  } else if (!settings.capabilityToggles.enrichment) {
    firstBlocker = "enrichment_capability_disabled"
  } else if (!evaluationContext.policy.qualificationAutonomyEnabled) {
    firstBlocker = qualificationAgent?.policyEvaluation ?? "qualification_agent_disabled"
  } else if (!qualificationPolicyGate.allowed) {
    firstBlocker = qualificationPolicyGate.policyKey ?? "qualification_policy_gate_blocked"
  }

  return {
    masterMode: settings.masterMode,
    enrichmentCapabilityEnabled: settings.capabilityToggles.enrichment,
    qualificationAutonomyEnabled: evaluationContext.policy.qualificationAutonomyEnabled,
    qualificationPolicyGate,
    firstBlocker,
  }
}

export async function planLiveQualificationAutonomyRepair(
  admin: SupabaseClient,
  organizationId: string,
): Promise<LiveQualificationRepairPlan> {
  const before = await diagnoseLiveQualificationAutonomy(admin, organizationId)
  return {
    applyMasterModeObjective: before.masterMode !== "objective",
    applyEnrichmentCapability: !before.enrichmentCapabilityEnabled,
    before,
    after: null,
  }
}

export async function applyLiveQualificationAutonomyRepair(
  admin: SupabaseClient,
  organizationId: string,
): Promise<LiveQualificationRepairPlan> {
  const plan = await planLiveQualificationAutonomyRepair(admin, organizationId)
  const current = await fetchGrowthAutonomySettings(admin, organizationId)

  if (!plan.applyMasterModeObjective && !plan.applyEnrichmentCapability) {
    return { ...plan, after: plan.before }
  }

  await upsertGrowthAutonomySettings(admin, organizationId, {
    masterMode: plan.applyMasterModeObjective ? "objective" : current.masterMode,
    capabilityToggles: {
      ...current.capabilityToggles,
      enrichment: plan.applyEnrichmentCapability ? true : current.capabilityToggles.enrichment,
    },
  })

  const after = await diagnoseLiveQualificationAutonomy(admin, organizationId)
  return { ...plan, after }
}

async function countOperatorPackages(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { count } = await admin
    .schema("growth")
    .from("growth_autonomous_outreach_approval_packages")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
  return count ?? 0
}

export async function runLiveQualificationProductionValidation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    deployedSha?: string | null
    applyRepair?: boolean
    maxResearchLeads?: number
  },
): Promise<LiveQualificationValidationReport> {
  const queueBefore = await diagnoseAdmissionQueue(admin, input.organizationId)
  const autonomyBefore = await diagnoseLiveQualificationAutonomy(admin, input.organizationId)
  const discoveryPolicy = evaluateAutonomousProspectDiscoveryProviderPolicy({
    authority: "autonomous_portfolio",
  })

  let repairApplied = false
  let autonomyAfter: LiveQualificationAutonomyDiagnosis | null = null
  if (input.applyRepair) {
    const repair = await applyLiveQualificationAutonomyRepair(admin, input.organizationId)
    repairApplied = repair.applyEnrichmentCapability || repair.applyMasterModeObjective
    autonomyAfter = repair.after
  }

  const research = await runAvaResearchQueueOrchestrator(admin, {
    organizationId: input.organizationId,
    maxLeads: input.maxResearchLeads ?? 3,
  })

  const queueAfter = await diagnoseAdmissionQueue(admin, input.organizationId)
  const operatorPackageCount = await countOperatorPackages(admin, input.organizationId)
  const autonomyCurrent = autonomyAfter ?? (await diagnoseLiveQualificationAutonomy(admin, input.organizationId))

  const qualificationCompleted = research.summary?.qualificationCompleted ?? 0
  const qualificationBlocked =
    (research.summary?.qualificationSkipped ?? 0) + (research.summary?.qualificationFailed ?? 0)
  const researchCompleted = research.summary?.researchCompleted ?? 0
  const readyForOutreachReview = research.summary?.readyForOutreachReview ?? 0
  const sampleLeadIds = (research.summary?.leadResults ?? []).slice(0, 5).map((row) => row.leadId)

  const verdictReasons: string[] = []
  if (queueBefore.blockedByQueueLimit) {
    verdictReasons.push("Admission queue still blocked after accounting fix")
  }
  if (!discoveryPolicy.datamoonEnabled && isDatamoonProviderEnabled()) {
    verdictReasons.push("DataMoon provider flag off in process env")
  }
  if (researchCompleted < 1) {
    verdictReasons.push("No research completed in validation orchestrator run")
  }
  if (qualificationCompleted < 1 && !autonomyCurrent.qualificationPolicyGate.allowed) {
    verdictReasons.push(
      autonomyCurrent.qualificationPolicyGate.blockReason ??
        "Qualification policy gate still closed after repair attempt",
    )
  }

  let executiveVerdict: LiveQualificationValidationReport["executiveVerdict"] = "PASS"
  if (queueBefore.blockedByQueueLimit || researchCompleted < 1) {
    executiveVerdict = "FAIL"
  } else if (qualificationCompleted < 1) {
    executiveVerdict = "PASS WITH LIMITATIONS"
  }

  const firstRemainingBlocker =
    autonomyCurrent.firstBlocker ??
    (qualificationCompleted < 1 ? autonomyCurrent.qualificationPolicyGate.policyKey : null) ??
    (queueBefore.blockedByQueueLimit ? "admission_queue_full" : null) ??
    (discoveryPolicy.stopReason != null ? discoveryPolicy.stopReason : null)

  return {
    qaMarker: GROWTH_AIOS_LIVE_QUALIFICATION_1A_QA_MARKER,
    organizationId: input.organizationId,
    deployedSha: input.deployedSha ?? null,
    queueBefore,
    queueAfter,
    datamoon: {
      providerEnabledInProcessEnv: isDatamoonProviderEnabled(),
      discoveryStopReason: discoveryPolicy.stopReason,
      datamoonEligibleForAutonomousDiscovery: discoveryPolicy.eligible,
    },
    autonomyBefore,
    autonomyAfter,
    repairApplied,
    researchOrchestratorRunId: research.summary?.runId ?? null,
    researchCompleted,
    qualificationCompleted,
    qualificationBlocked,
    readyForOutreachReview,
    sampleLeadIds,
    operatorPackageCount,
    executiveVerdict,
    verdictReasons,
    firstRemainingBlocker,
    recommendedNextAction:
      qualificationCompleted > 0
        ? "Qualification gate opened — proceed to operator package generation validation."
        : firstRemainingBlocker === "datamoon_disabled"
          ? "Confirm deployed Vercel Production DATAMOON_PROVIDER_ENABLED; local vercel env run may not inject encrypted provider vars."
          : "Enable objective-mode enrichment autonomy for qualification_agent, then rerun orchestrator.",
  }
}

export async function summarizePortfolioReplenishment(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  shouldReplenish: boolean
  replenishmentReason: string | null
  blockedByQueueLimit: boolean
}> {
  const generatedAt = new Date().toISOString()
  const work = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId, generatedAt })
  const approved = await getActiveApprovedBusinessProfile(admin, organizationId).catch(() => null)
  const pm = buildGrowthPortfolioManagerSnapshot({
    organizationId,
    generatedAt,
    leads: work?.portfolioLeads ?? [],
    eligibleLeadCount: work?.eligibleLeadCount ?? 0,
    approvedProfile: approved?.profile ?? null,
  })
  return {
    shouldReplenish: pm.replenishment.shouldReplenish,
    replenishmentReason: pm.replenishment.reason,
    blockedByQueueLimit: pm.replenishment.blockedByQueueLimit,
  }
}

export async function readOutboundSafety(admin: SupabaseClient): Promise<{
  outboundEnabled: boolean
  autonomyEnabled: boolean
}> {
  const kill = await getRuntimeKillSwitchStates(admin)
  return {
    outboundEnabled: kill.autonomy_outbound_enabled,
    autonomyEnabled: kill.autonomy_enabled,
  }
}
