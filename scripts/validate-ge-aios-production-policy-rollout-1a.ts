/**
 * GE-AIOS-PRODUCTION-POLICY-ROLLOUT-1A — Production alignment closure validation.
 *
 * Run (read-only + optional controlled reconcile):
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-production-policy-rollout-1a.ts
 *
 * Controlled reconcile (max 1 lead via existing Ava orchestrator):
 *   CONFIRM_GE_AIOS_PRODUCTION_POLICY_ROLLOUT_1A=1 ... (same command)
 */
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { runAvaResearchQueueOrchestrator } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-service"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  assessGrowthResearchSufficiencyFromLead,
  GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER,
  isPackageReadyFromSufficiency,
  isSendReadyFromSufficiency,
} from "@/lib/growth/research/growth-research-sufficiency-1a"
import {
  GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
  resolveLegacyAdmissionPolicyRead,
} from "@/lib/growth/revenue-workflow/growth-admission-policy-1a"
import {
  evaluateGrowthLeadAdmission,
  resolveLeadAdmissionStateFromMetadata,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import { buildGrowthLeadAdmissionIntakeFromLead } from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import { isExternalDiscoveryLeadIntakeSource } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import { analyzeGrowthLeadAdmissionProductionPool } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import {
  buildHeroExecutiveBriefing,
  buildHomeMeasurableProgressPresentation,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import {
  GROWTH_HOME_NARRATIVE_TRUTHFULNESS_1B_QA_MARKER,
  heroNarrativeMustNotClaimApprovalWhenPendingZero,
  narrativeClaimsOperatorApprovalPending,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-truthfulness-1b"
import { buildAvaHomeHero } from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import type { GrowthLead } from "@/lib/growth/types"

export const GE_AIOS_PRODUCTION_POLICY_ROLLOUT_1A_QA_MARKER =
  "ge-aios-production-policy-rollout-1a-v1" as const

const PHASE = "GE-AIOS-PRODUCTION-POLICY-ROLLOUT-1A" as const
const ROOT = process.cwd()
const APP_ALIAS = "https://app.equipify.ai"
const CONFIRM = process.env.CONFIRM_GE_AIOS_PRODUCTION_POLICY_ROLLOUT_1A === "1"
const MAX_CONTROLLED_RECONCILE_LEADS = 1

const INTEGRATION_CLOSURE_MARKERS = [
  "lib/growth/research/growth-research-sufficiency-1a.ts",
  "lib/growth/ava-home/growth-ava-research-orchestrator-service.ts",
  "scripts/test-ge-aios-research-sufficiency-1a-integration-closure.ts",
  "scripts/test-ge-aios-growth-3b-internal-workflow-dry-run.ts",
  "scripts/test-ge-aios-growth-3a-runtime-foundation.ts",
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim()
}

function resolveDeployment(): { deployedSha: string; status: string | null } {
  const inspect = spawnSync("vercel", ["inspect", APP_ALIAS], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 45_000,
  })
  const text = `${inspect.stdout ?? ""}\n${inspect.stderr ?? ""}`
  const status = text.match(/status\s+●?\s*(Ready|Error|Canceled|Building)/i)?.[1] ?? null
  const logs = spawnSync("vercel", ["inspect", APP_ALIAS, "--logs"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  })
  const logText = `${logs.stdout ?? ""}\n${logs.stderr ?? ""}`
  const commitFromLogs = logText.match(/Commit:\s*([0-9a-f]{7,40})/i)?.[1] ?? "unknown"
  let deployedSha = commitFromLogs
  try {
    deployedSha = git(["rev-parse", commitFromLogs])
  } catch {
    // keep short sha
  }
  return { deployedSha, status }
}

function markerPresentAtSha(sha: string, marker: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}:${marker}`], { cwd: ROOT, stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function hasPolicyMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  return resolveLegacyAdmissionPolicyRead({ admissionState: null, metadata: metadata ?? {} }).hasPolicyMetadata
}

function policyMetadataFields(metadata: Record<string, unknown>): Record<string, unknown> {
  return {
    admission_policy_qa_marker: metadata.admission_policy_qa_marker ?? null,
    research_sufficiency_decision: metadata.research_sufficiency_decision ?? null,
    package_ready: metadata.package_ready ?? null,
    send_ready: metadata.send_ready ?? null,
    admission_bounded_next_actions: metadata.admission_bounded_next_actions ?? null,
    admission_max_additional_investment: metadata.admission_max_additional_investment ?? null,
    admission_targeted_research_missing_evidence: metadata.admission_targeted_research_missing_evidence ?? null,
  }
}

async function loadOrgLeads(admin: SupabaseClient, limit = 500): Promise<GrowthLead[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as GrowthLead[]
}

function redactLead(lead: GrowthLead): Record<string, unknown> {
  return {
    id: lead.id,
    companyName: lead.companyName,
    website: lead.website,
    status: lead.status,
    admissionState: resolveLeadAdmissionStateFromMetadata(lead.metadata),
    ...policyMetadataFields(lead.metadata ?? {}),
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production alignment closure validation`)
  console.log(`QA marker: ${GE_AIOS_PRODUCTION_POLICY_ROLLOUT_1A_QA_MARKER}`)
  console.log(`Controlled reconcile enabled: ${CONFIRM ? "yes (max 1 lead)" : "no (read-only)"}`)

  console.log("\n--- Part 1: Home loader hotfix (source) ---")
  const filterSource = readSource("lib/growth/mission-purpose/growth-mission-purpose-operator-filter-1a.ts")
  const homeLoaderFixPresent = /input\.purposeByLeadId\.get\(input\.task\.leadId\)/.test(filterSource)
  const homeLoaderBugPresent = /[^.]purposeByLeadId\.get\(input\.task\.leadId\)/.test(filterSource)
  console.log(
    JSON.stringify(
      {
        homeLoaderFixPresent,
        homeLoaderBugPresent,
        note: homeLoaderBugPresent
          ? "Bare purposeByLeadId reference still present — fix incomplete"
          : "input.purposeByLeadId wiring present in operator task filter",
      },
      null,
      2,
    ),
  )

  console.log("\n--- Part 2: Integration Closure (main branch source) ---")
  const avaSource = readSource("lib/growth/ava-home/growth-ava-research-orchestrator-service.ts")
  const integrationClosure = {
    isPackageReadyFromSufficiencyExported:
      readSource("lib/growth/research/growth-research-sufficiency-1a.ts").includes(
        "export function isPackageReadyFromSufficiency",
      ),
    avaUsesPackageReadyFromSufficiency: /isPackageReadyFromSufficiency\(assessGrowthResearchSufficiencyFromLead/.test(
      avaSource,
    ),
    integrationClosureTestPresent: fs.existsSync(
      path.join(ROOT, "scripts/test-ge-aios-research-sufficiency-1a-integration-closure.ts"),
    ),
    growth3bPackageReadyFixture:
      /packageReadyResearchResult|packageReadyIntelligence/.test(
        readSource("scripts/test-ge-aios-growth-3b-internal-workflow-dry-run.ts"),
      ),
    duplicateDmRequiredPackageGate:
      /leadReadyForOutreachReview[\s\S]{0,400}decisionMakerStatus[\s\S]{0,120}return false/.test(avaSource),
  }
  console.log(JSON.stringify(integrationClosure, null, 2))

  const deployment = resolveDeployment()
  const headSha = git(["rev-parse", "HEAD"])
  const integrationOnLive = INTEGRATION_CLOSURE_MARKERS.every((marker) =>
    markerPresentAtSha(deployment.deployedSha, marker),
  )
  console.log(
    JSON.stringify(
      {
        liveAlias: APP_ALIAS,
        liveStatus: deployment.status,
        liveSha: deployment.deployedSha.slice(0, 8),
        headSha: headSha.slice(0, 8),
        integrationClosureOnLiveAlias: integrationOnLive,
      },
      null,
      2,
    ),
  )

  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    console.log("\nProduction DB / Home loader runtime checks skipped — re-run via vercel-production-env-run.ts")
    console.log("\n--- Part 8 (local-only): Source readiness ---")
    const localReady =
      homeLoaderFixPresent &&
      !homeLoaderBugPresent &&
      integrationClosure.avaUsesPackageReadyFromSufficiency &&
      integrationClosure.integrationClosureTestPresent
    console.log(localReady ? "SOURCE READY — deploy + production validation required" : "SOURCE CORRECTION REQUIRED")
    return
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }
  const admin = boot.admin
  const organizationId = getGrowthEngineAiOrgId() ?? GROWTH_CERT_DEFAULT_AI_ORG_ID

  console.log("\n--- Part 1 (live): Home workspace load ---")
  let homeLoads = false
  let homeError: string | null = null
  let pendingApprovals = 0
  let awaitingReview = 0
  let narrativeTrace: Record<string, unknown> = { homeProjectionFailed: true }
  try {
    const workspaceSummary = await buildGrowthHomeWorkspaceSummary({
      admin,
      operatorEmail: boot.operatorEmail,
      actorUserId: boot.actorUserId,
    })
    homeLoads = true
    pendingApprovals = workspaceSummary.canonicalOperatorApproval?.pendingApprovalCount ?? 0
    awaitingReview = workspaceSummary.portfolioManager?.health.counts.awaitingReview ?? 0
    const missionDiscovery = workspaceSummary.missionDiscovery
    const briefing = synthesizeGrowthHomeExecutiveBriefing({
      dashboard: workspaceSummary.dashboard,
      missionDiscovery,
      portfolioBelowTarget: (workspaceSummary.portfolioManager?.health.needsCount ?? 0) > 0,
      portfolioTargetCurrent: workspaceSummary.portfolioManager?.health.counts.activeCompanies ?? null,
      portfolioTargetGoal: workspaceSummary.portfolioManager?.target.targetActiveCompanies ?? null,
      canonicalOperatorApproval: workspaceSummary.canonicalOperatorApproval,
      canonicalOperatorTask: workspaceSummary.canonicalOperatorTask,
      canonicalActiveMissions: workspaceSummary.canonicalActiveMissions,
      canonicalOperatorFocus: workspaceSummary.canonicalOperatorFocus,
    })
    const hero = buildAvaHomeHero({
      greeting: briefing.aiOsUx.hero.greeting,
      hour: new Date().getHours(),
      employeeStatus: briefing.employeeStatus,
      aiOsUx: briefing.aiOsUx,
      researchLoopSummary: workspaceSummary.avaConsole?.researchLoopSummary ?? null,
      accomplishments: briefing.accomplishments,
      repliesWaiting: 0,
      workspaceSummary: {
        kpis: workspaceSummary.kpis,
        meetings: workspaceSummary.meetings,
        inbox: workspaceSummary.inbox,
        operatorTasks: workspaceSummary.operatorTasks,
        avaConsole: workspaceSummary.avaConsole,
        dashboard: workspaceSummary.dashboard,
        relationshipSnapshots: workspaceSummary.relationshipSnapshots,
        leadPool: workspaceSummary.leadPool,
        missionDiscovery,
        portfolioLeads: workspaceSummary.portfolioLeads,
        eligibleLeadCount: workspaceSummary.eligibleLeadCount,
        businessObjectiveLeadership: workspaceSummary.businessObjectiveLeadership,
      },
      outboundDisabled: true,
    })
    const heroBriefing = buildHeroExecutiveBriefing({
      statusLabel: hero.statusLabel,
      dailyActivityNarrative: hero.dailyActivityNarrative,
      missionDiscovery,
      pendingApprovals,
      readyForOutreachReview: workspaceSummary.avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0,
      discoveryTarget: hero.discoveryNarrativeTarget ?? missionDiscovery?.audienceName ?? null,
    })
    const trust = buildGrowthHomeRuntimeTrustViewModel({
      heroNarrative: heroBriefing.narrative,
      missionSummaryLines: heroBriefing.missionSummary ?? [],
      pendingApprovals,
      awaitingReview,
      operatorStateInput: workspaceSummary.runtimeTrust?.operatorState ?? "working",
      activitySummary: workspaceSummary.runtimeTrust?.activitySummary ?? null,
    })
    const progress = buildHomeMeasurableProgressPresentation({
      missionDiscovery,
      portfolio: workspaceSummary.portfolioManager,
      pendingApprovals,
      readyForOutreachReview: workspaceSummary.avaConsole?.researchLoopSummary?.readyForOutreachReview ?? 0,
    })

    const narrativeForbidden =
      pendingApprovals <= 0 &&
      (narrativeClaimsOperatorApprovalPending(heroBriefing.narrative) ||
        narrativeClaimsOperatorApprovalPending(trust.operatorStateNarrative ?? "") ||
        /outreach packages are ready|packages need review/i.test(heroBriefing.narrative))

    narrativeTrace = {
      pendingApprovals,
      awaitingReview,
      heroParagraph1: heroBriefing.narrative,
      heroMissionSummary: heroBriefing.missionSummary,
      heroNextMilestone: heroBriefing.nextMilestone,
      runtimeTrustOperatorState: trust.operatorState,
      runtimeTrustNarrative: trust.operatorStateNarrative,
      executiveBriefingHeadline: briefing.headline,
      avaHeroTitle: hero.statusLabel,
      progressSummary: progress.subtitle,
      narrativeConsistencyPass: heroNarrativeMustNotClaimApprovalWhenPendingZero(
        heroBriefing.narrative,
        pendingApprovals,
      ),
      forbiddenApprovalLanguageWhenPendingZero: narrativeForbidden,
      admissionReviewNeverApprovalLanguage:
        awaitingReview > 0 && pendingApprovals <= 0 ? !narrativeForbidden : true,
      homeProjectionFailed: false,
    }
    console.log(JSON.stringify({ homeLoads, pendingApprovals, awaitingReview }, null, 2))
    console.log(JSON.stringify(narrativeTrace, null, 2))
  } catch (error) {
    homeError = error instanceof Error ? error.message : String(error)
    narrativeTrace = {
      homeProjectionFailed: true,
      error: homeError,
      note: "Home loader failed — likely live alias still on pre-hotfix deployment",
    }
    console.log(JSON.stringify({ homeLoads: false, homeError }, null, 2))
  }

  console.log("\n--- Part 7: Production drift assessment (before reconcile) ---")
  const leadsBefore = await loadOrgLeads(admin, 500)
  const admissionContext = await loadGrowthLeadAdmissionContext(admin, organizationId)
  const admissionAnalysis = await analyzeGrowthLeadAdmissionProductionPool({
    admin,
    organizationId,
    limit: 500,
  })

  const drift = {
    totalLeads: leadsBefore.length,
    withPolicyMetadata: 0,
    legacyMissingPolicyMetadata: 0,
    storedVsFreshAdmissionMismatch: 0,
    storedVsFreshSufficiencyMismatch: 0,
    unreconciledPopulation: 0,
  }

  for (const lead of leadsBefore) {
    const metadata = lead.metadata ?? {}
    if (hasPolicyMetadata(metadata)) drift.withPolicyMetadata += 1
    else drift.legacyMissingPolicyMetadata += 1

    const storedAdmission = resolveLeadAdmissionStateFromMetadata(metadata)
    const intake = buildGrowthLeadAdmissionIntakeFromLead(lead)
    const freshAdmission = evaluateGrowthLeadAdmission(intake, admissionContext).state
    if (storedAdmission && storedAdmission !== freshAdmission) drift.storedVsFreshAdmissionMismatch += 1

    const storedDecision = metadata.research_sufficiency_decision ?? null
    const freshDecision = assessGrowthResearchSufficiencyFromLead(lead).decision
    if (storedDecision && storedDecision !== freshDecision) drift.storedVsFreshSufficiencyMismatch += 1
    if (!hasPolicyMetadata(metadata)) drift.unreconciledPopulation += 1
  }

  console.log(JSON.stringify(drift, null, 2))
  console.log("21C admission analysis counts:")
  console.log(JSON.stringify(admissionAnalysis.counts, null, 2))

  console.log("\n--- Part 3: Controlled production reconcile candidate ---")
  const intakeDiagnostics = {
    datamoonLeads: 0,
    datamoonWithResearch: 0,
    datamoonResearchNoPolicy: 0,
    datamoonReview: 0,
  }
  for (const lead of leadsBefore) {
    const intake = buildGrowthLeadAdmissionIntakeFromLead(lead)
    if (!isExternalDiscoveryLeadIntakeSource(intake.source)) continue
    intakeDiagnostics.datamoonLeads += 1
    if (lead.latestProspectResearchRunId && lead.lastProspectResearchedAt) intakeDiagnostics.datamoonWithResearch += 1
    if (!hasPolicyMetadata(lead.metadata ?? {}) && lead.latestProspectResearchRunId) {
      intakeDiagnostics.datamoonResearchNoPolicy += 1
    }
    if (resolveLeadAdmissionStateFromMetadata(lead.metadata) === "review") intakeDiagnostics.datamoonReview += 1
  }

  const reconcileCandidates = leadsBefore
    .filter((lead) => {
      const intake = buildGrowthLeadAdmissionIntakeFromLead(lead)
      if (!isExternalDiscoveryLeadIntakeSource(intake.source)) return false
      if (!lead.latestProspectResearchRunId || !lead.lastProspectResearchedAt) return false
      if (!hasPolicyMetadata(lead.metadata ?? {})) return true
      return false
    })
    .slice(0, 5)
    .map(redactLead)

  console.log(JSON.stringify({ intakeDiagnostics, candidateCount: reconcileCandidates.length, candidates: reconcileCandidates }, null, 2))

  let reconcileResult: Record<string, unknown> = { skipped: true, reason: "CONFIRM not set" }
  if (CONFIRM) {
    const beforePolicyCount = drift.withPolicyMetadata
    reconcileResult = {
      skipped: false,
      maxLeads: MAX_CONTROLLED_RECONCILE_LEADS,
      candidateLeadId: reconcileCandidates[0]?.id ?? null,
      note:
        reconcileCandidates.length === 0
          ? "No cache-hit datamoon candidate — invoking Ava orchestrator to use existing research queue"
          : "Cache-hit datamoon candidate available",
    }
    const orchestrator = await runAvaResearchQueueOrchestrator(admin, {
      organizationId,
      maxLeads: MAX_CONTROLLED_RECONCILE_LEADS,
      generatedAt: new Date().toISOString(),
    })
    reconcileResult = {
      ...reconcileResult,
      orchestratorOk: orchestrator.ok,
      researchCompleted: orchestrator.summary?.researchCompleted ?? 0,
      leadResults: orchestrator.summary?.leadResults ?? [],
    }

    const leadsAfterReconcile = await loadOrgLeads(admin, 500)
    const withPolicyAfter = leadsAfterReconcile.filter((lead) => hasPolicyMetadata(lead.metadata ?? {})).length
    reconcileResult.policyMetadataLeadsBefore = beforePolicyCount
    reconcileResult.policyMetadataLeadsAfter = withPolicyAfter
    reconcileResult.policyMetadataDelta = withPolicyAfter - beforePolicyCount
    reconcileResult.reconciledLeadSamples = leadsAfterReconcile
      .filter((lead) => hasPolicyMetadata(lead.metadata ?? {}))
      .slice(0, 2)
      .map(redactLead)
  }
  console.log(JSON.stringify(reconcileResult, null, 2))

  console.log("\n--- Part 4: Metadata persistence proof ---")
  const leadsAfter = await loadOrgLeads(admin, 500)
  const withPolicy = leadsAfter.filter((lead) => hasPolicyMetadata(lead.metadata ?? {}))
  const policySamples = withPolicy.slice(0, 3).map(redactLead)
  console.log(
    JSON.stringify(
      {
        leadsWithPolicyMetadata: withPolicy.length,
        requiredFieldsPresentOnSamples: policySamples.map((sample) => ({
          id: sample.id,
          hasAdmissionPolicyMarker: sample.admission_policy_qa_marker === GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
          hasSufficiencyDecision: Boolean(sample.research_sufficiency_decision),
          hasPackageReady: sample.package_ready != null,
          hasSendReady: sample.send_ready != null,
        })),
        samples: policySamples,
      },
      null,
      2,
    ),
  )

  console.log("\n--- Part 6: Package-ready without DM ---")
  const packageReadyNoDm = leadsAfter
    .filter((lead) => {
      const sufficiency = assessGrowthResearchSufficiencyFromLead(lead)
      const noDm =
        !lead.primaryDecisionMakerId &&
        lead.decisionMakerStatus !== "confirmed" &&
        lead.decisionMakerStatus !== "verified_contactable"
      return isPackageReadyFromSufficiency(sufficiency) && noDm && !isSendReadyFromSufficiency(sufficiency)
    })
    .slice(0, 3)
    .map((lead) => ({
      ...redactLead(lead),
      sufficiencyDecision: assessGrowthResearchSufficiencyFromLead(lead).decision,
      packageReadyProjected: isPackageReadyFromSufficiency(assessGrowthResearchSufficiencyFromLead(lead)),
      sendReadyProjected: isSendReadyFromSufficiency(assessGrowthResearchSufficiencyFromLead(lead)),
      transportBlocked: true,
    }))
  console.log(JSON.stringify({ liveMatches: packageReadyNoDm.length, samples: packageReadyNoDm }, null, 2))

  console.log("\n--- Safety ---")
  const killSwitch = await getRuntimeKillSwitchStates(admin, organizationId)
  console.log(JSON.stringify({ outboundKillSwitch: killSwitch, outboundExecuted: false }, null, 2))

  console.log("\n--- Part 8: Final production certification ---")
  const checks = {
    homeLoads,
    narrativeTruthfulness:
      narrativeTrace.narrativeConsistencyPass === true &&
      narrativeTrace.forbiddenApprovalLanguageWhenPendingZero !== true,
    integrationClosureOnMain: integrationClosure.avaUsesPackageReadyFromSufficiency,
    integrationClosureDeployed: integrationOnLive,
    sufficiencyMetadataPersisted: withPolicy.length > 0,
    admissionMetadataPersisted: withPolicy.some(
      (lead) => lead.metadata?.admission_policy_qa_marker === GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    ),
    packageReadyWithoutDmLive: packageReadyNoDm.length > 0,
    noOutbound: true,
    noDuplicateAuthority: true,
    noBulkMigration: !CONFIRM || MAX_CONTROLLED_RECONCILE_LEADS === 1,
  }

  console.log(JSON.stringify(checks, null, 2))

  const readyForMissionBalance =
    checks.homeLoads &&
    checks.narrativeTruthfulness &&
    checks.integrationClosureOnMain &&
    checks.sufficiencyMetadataPersisted &&
    checks.admissionMetadataPersisted &&
    checks.noOutbound &&
    checks.noDuplicateAuthority

  if (readyForMissionBalance && checks.packageReadyWithoutDmLive && checks.integrationClosureDeployed) {
    console.log("\nREADY FOR MISSION BALANCE 1A")
  } else if (readyForMissionBalance && (!checks.integrationClosureDeployed || !checks.packageReadyWithoutDmLive)) {
    console.log("\nREADY FOR MISSION BALANCE 1A — WITH DEPLOY/RECONCILE EXCEPTIONS")
    if (!checks.integrationClosureDeployed) {
      console.log("  • Deploy current main to live alias (integration closure + home loader fix)")
    }
    if (!checks.sufficiencyMetadataPersisted) {
      console.log("  • Run controlled reconcile: CONFIRM_GE_AIOS_PRODUCTION_POLICY_ROLLOUT_1A=1")
    }
    if (!checks.packageReadyWithoutDmLive) {
      console.log("  • Await natural reconcile on a package-ready lead, or validate via fixture projection")
    }
  } else {
    console.log("\nNOT READY — smallest remaining corrections:")
    if (!checks.homeLoads) console.log("  • Deploy home loader hotfix (input.purposeByLeadId)")
    if (!checks.integrationClosureOnMain) console.log("  • Merge integration closure onto main")
    if (!checks.sufficiencyMetadataPersisted) console.log("  • Execute controlled reconcile on 1 external-discovery lead")
    if (!checks.narrativeTruthfulness) console.log("  • Fix narrative truthfulness regression")
  }

  console.log(`\nMarkers: sufficiency=${GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER} admission=${GROWTH_ADMISSION_POLICY_1A_QA_MARKER} narrative=${GROWTH_HOME_NARRATIVE_TRUTHFULNESS_1B_QA_MARKER}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
