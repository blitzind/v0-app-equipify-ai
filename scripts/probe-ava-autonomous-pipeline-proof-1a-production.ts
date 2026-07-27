/**
 * AVA-AUTONOMOUS-PIPELINE-PROOF-1A — Production pipeline proof (read-only by default).
 *
 *   pnpm probe:ava-autonomous-pipeline-proof-1a:production
 *
 * Bounded execution (repair + ASL ticks, no approval/send):
 *   AVA_AUTONOMOUS_PIPELINE_PROOF_1A_EXECUTE=true pnpm probe:ava-autonomous-pipeline-proof-1a:production
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { listGrowthAiCopilotGenerationsForLead } from "@/lib/growth/ai-copilot-repository"
import {
  hasValidMessageApprovalBindingForGeneration,
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import { containsProhibitedAvaOutboundStyleMarkers } from "@/lib/growth/ava-reasoning/ava-outbound-copy-quality-boundary-core"
import { isAvaSupervisedOutboundGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import {
  buildSupervisedAvaHomeOperatorAttention,
  loadSupervisedAvaGenerationsForHome,
} from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { loadCanonicalOperatorApprovalSnapshotForHome } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader"
import { buildLeadsByIdMap } from "@/lib/growth/home/growth-home-review-queue-1b"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { findLatestIntakePendingAutonomousProspectSearchDatamoonRun } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import {
  buildGrowthLeadAdmissionIntakeFromLead,
  resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import { reconcileExternalDiscoveryPostResearchAdmission } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a"
import { isExternalDiscoveryLeadIntakeSource } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import {
  buildGrowthAutonomousPortfolioWorkSnapshot,
} from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import {
  diagnoseAutonomousSalesLoopWorkManager,
  loadDraftFactorySignalCounts,
} from "@/lib/growth/specialists/execution/autonomous-sales-loop-diagnosis-1a"
import {
  inspectAutonomousSalesLoopDryRun,
  runAutonomousSalesLoop,
  tickAutonomousSalesLoopForScheduler,
} from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { buildGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { loadGrowthHomeMissionDiscoveryObjectives } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import { tickDraftFactoryDueStatesForScheduler } from "@/lib/growth/draft-factory/draft-factory-due-scheduler-tick"
import { listActiveRunningGrowthObjectiveOrganizationIds } from "@/lib/growth/objectives/growth-objective-repository"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

const CERT_ID = "ava-autonomous-pipeline-proof-1a-v1" as const

type FunnelCounts = Record<string, number>

function isExternalDiscoveryMetadata(metadata: Record<string, unknown>): boolean {
  const intake = resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata(metadata)
  return isExternalDiscoveryLeadIntakeSource(intake)
}

function admissionReasons(metadata: Record<string, unknown>): string[] {
  return Array.isArray(metadata.admission_reasons)
    ? metadata.admission_reasons.filter((value): value is string => typeof value === "string")
    : []
}

async function buildExtendedFunnel(admin: SupabaseClient, orgId: string): Promise<FunnelCounts> {
  const { data: leads } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, status, metadata, contact_email, contact_name, last_researched_at, latest_research_run_id, latest_prospect_research_run_id, last_prospect_researched_at, created_at",
    )
    .eq("promoted_organization_id", orgId)

  const { data: dfStates } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, paused_reason")
    .eq("organization_id", orgId)

  const { data: gens } = await admin
    .schema("growth")
    .from("ai_copilot_generations")
    .select("id, lead_id, status, sent_at, classification, created_at")
    .order("created_at", { ascending: false })
    .limit(500)

  const dfByLead = new Map((dfStates ?? []).map((row) => [row.lead_id, row]))
  const counts: FunnelCounts = {
    discovered: 0,
    intake: 0,
    researching: 0,
    researchCompleted: 0,
    accepted: 0,
    portfolioEligible: 0,
    contactReady: 0,
    generationReady: 0,
    awaitingReview: 0,
    approved: 0,
    sent: 0,
    rejectedOrDisqualified: 0,
  }

  for (const row of leads ?? []) {
    counts.discovered += 1
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    if (isExternalDiscoveryMetadata(metadata)) counts.intake += 1

    const admission = resolveLeadAdmissionStateFromMetadata(metadata)
    const hasProspectResearch = Boolean(row.latest_prospect_research_run_id)
    const hasLeadResearch = Boolean(row.latest_research_run_id)

    if (hasProspectResearch && !hasLeadResearch && admission === "review") counts.researching += 1
    if (hasProspectResearch) counts.researchCompleted += 1
    if (admission === "accepted") counts.accepted += 1
    if (admission === "rejected" || row.status === "disqualified") counts.rejectedOrDisqualified += 1

    const lead = await fetchGrowthLeadById(admin, row.id).catch(() => null)
    if (lead) {
      const eligibility = evaluateGrowthPortfolioLeadEligibility({ lead, organizationId: orgId })
      if (eligibility.eligible) counts.portfolioEligible += 1
    }

    if (row.contact_email?.trim()) counts.contactReady += 1

    const df = dfByLead.get(row.id)
    if (
      df?.state === "waiting_for_generation" ||
      df?.state === "research_complete" ||
      df?.state === "waiting_for_decision_maker"
    ) {
      counts.generationReady += 1
    }

    for (const gen of gens ?? []) {
      if (gen.lead_id !== row.id) continue
      const cls = gen.classification as Record<string, unknown> | null
      if (cls?.avaSupervisedOutbound === true && gen.status === "draft" && !gen.sent_at) {
        counts.awaitingReview += 1
      }
      if (gen.status === "approved" && !gen.sent_at) counts.approved += 1
      if (gen.sent_at) counts.sent += 1
    }
  }

  return counts
}

async function findStuckExternalDiscoveryLeads(admin: SupabaseClient, orgId: string) {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, status, metadata, latest_prospect_research_run_id, last_prospect_researched_at",
    )
    .eq("promoted_organization_id", orgId)
    .not("latest_prospect_research_run_id", "is", null)

  if (error) throw new Error(error.message)

  return (data ?? []).filter((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    if (!isExternalDiscoveryMetadata(metadata)) return false
    const admission = resolveLeadAdmissionStateFromMetadata(metadata)
    const reasons = admissionReasons(metadata)
    return (
      admission === "review" &&
      reasons.includes("pending_operational_keyword_validation") &&
      !reasons.includes("operational_keyword_validation_passed")
    )
  })
}

async function reconcileStuckLead(
  admin: SupabaseClient,
  orgId: string,
  leadId: string,
  generatedAt: string,
  admissionContext: Awaited<ReturnType<typeof loadGrowthLeadAdmissionContext>>,
) {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead?.latestProspectResearchRunId) {
    return { leadId, attempted: false, reason: "missing_prospect_research_run" }
  }

  const { data: runRow, error: runError } = await admin
    .schema("growth")
    .from("research_runs")
    .select(
      "id, status, research_summary, suggested_pitch_angle, suggested_sequence, suggested_call_opening, recommended_next_action, industry_guess, detected_technologies, signals",
    )
    .eq("id", lead.latestProspectResearchRunId)
    .maybeSingle()
  if (runError) throw new Error(runError.message)
  if (!runRow || runRow.status !== "completed") {
    return { leadId, attempted: false, reason: "prospect_research_incomplete" }
  }

  const beforeAdmission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
  const evidenceBundle =
    (runRow.signals?.companyEvidence_v22 as GrowthCompanyEvidenceBundle | undefined) ?? null

  const reconciliation = await reconcileExternalDiscoveryPostResearchAdmission({
    admin,
    lead,
    organizationId: orgId,
    admissionContext,
    evidenceBundle,
    generatedAt,
    researchRun: {
      id: runRow.id,
      status: runRow.status,
      researchSummary: runRow.research_summary,
      suggestedPitchAngle: runRow.suggested_pitch_angle,
      suggestedSequence: runRow.suggested_sequence,
      suggestedCallOpening: runRow.suggested_call_opening,
      recommendedNextAction: runRow.recommended_next_action,
      industryGuess: runRow.industry_guess,
      detectedTechnologies: runRow.detected_technologies,
      signals: runRow.signals,
    },
  })

  const afterLead = await fetchGrowthLeadById(admin, leadId)
  return {
    leadId,
    companyName: lead.companyName,
    attempted: true,
    beforeAdmission,
    afterAdmission: resolveLeadAdmissionStateFromMetadata(afterLead?.metadata),
    afterStatus: afterLead?.status ?? null,
    afterReasons: admissionReasons((afterLead?.metadata ?? {}) as Record<string, unknown>),
    reconciliation,
  }
}

async function loadDatamoonHealth(admin: SupabaseClient, orgId: string) {
  const pendingRun = await findLatestIntakePendingAutonomousProspectSearchDatamoonRun(admin, orgId).catch(
    () => null,
  )

  const { data: recentRuns } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("id, status, created_at, updated_at, completed_at, metadata, organization_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10)

  const { data: recentLeads } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, created_at, metadata")
    .eq("promoted_organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10)

  const { data: cronRuns } = await admin
    .schema("growth")
    .from("cron_execution_runs")
    .select("cron_route, started_at, ok, processed_count")
    .ilike("cron_route", "%growth-objective-runtime-scheduler%")
    .order("started_at", { ascending: false })
    .limit(5)

  return {
    pendingIntakeRun: pendingRun?.id ?? null,
    recentDatamoonRuns: (recentRuns ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    })),
    recentIntakeLeads: (recentLeads ?? [])
      .filter((row) => isExternalDiscoveryMetadata((row.metadata ?? {}) as Record<string, unknown>))
      .map((row) => ({
        id: row.id,
        company: row.company_name,
        createdAt: row.created_at,
        admission: resolveLeadAdmissionStateFromMetadata((row.metadata ?? {}) as Record<string, unknown>),
      })),
    recentSchedulerTicks: cronRuns ?? [],
  }
}

async function findFreshSupervisedPackages(admin: SupabaseClient, orgId: string, sinceIso: string) {
  const { data: gens } = await admin
    .schema("growth")
    .from("ai_copilot_generations")
    .select("id, lead_id, status, sent_at, classification, generated_subject, generated_content, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(50)

  const results = []
  for (const gen of gens ?? []) {
    const cls = gen.classification as Record<string, unknown> | null
    if (cls?.avaSupervisedOutbound !== true) continue
    const lead = await fetchGrowthLeadById(admin, gen.lead_id).catch(() => null)
    results.push({
      generationId: gen.id,
      leadId: gen.lead_id,
      companyName: lead?.companyName ?? null,
      status: gen.status,
      createdAt: gen.created_at,
      subject: gen.generated_subject,
      primary: cls.primary ?? null,
      emDash: containsProhibitedAvaOutboundStyleMarkers({
        subject: gen.generated_subject,
        body: gen.generated_content,
      }),
      hasBinding: hasValidMessageApprovalBindingForGeneration({
        id: gen.id,
        status: gen.status,
        classification: gen.classification,
        generatedSubject: gen.generated_subject,
        generatedContent: gen.generated_content,
      } as never),
      presentation: resolveAvaSupervisedOutboundApprovalPresentation({
        id: gen.id,
        status: gen.status,
        classification: gen.classification,
        generatedSubject: gen.generated_subject,
        generatedContent: gen.generated_content,
      } as never),
    })
  }
  return results
}

async function main() {
  console.log(`[${CERT_ID}] autonomous pipeline proof`)
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")

  const admin = cert.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const generatedAt = new Date().toISOString()
  const execute = process.env.AVA_AUTONOMOUS_PIPELINE_PROOF_1A_EXECUTE === "true"
  const proofStartedAt = generatedAt

  const funnelBefore = await buildExtendedFunnel(admin, orgId)
  const datamoonBefore = await loadDatamoonHealth(admin, orgId)
  const stuckBefore = await findStuckExternalDiscoveryLeads(admin, orgId)

  let repairResults: Awaited<ReturnType<typeof reconcileStuckLead>>[] = []
  if (execute && stuckBefore.length > 0) {
    const admissionContext = await loadGrowthLeadAdmissionContext(admin, orgId)
    for (const row of stuckBefore) {
      repairResults.push(await reconcileStuckLead(admin, orgId, row.id, generatedAt, admissionContext))
    }
  }

  const stuckAfter = await findStuckExternalDiscoveryLeads(admin, orgId)

  let aslExecutions: Awaited<ReturnType<typeof runAutonomousSalesLoop>>[] = []
  let schedulerRuns: Awaited<ReturnType<typeof runGrowthObjectiveRuntimeScheduler>>[] = []
  let draftFactoryTicks: Awaited<ReturnType<typeof tickDraftFactoryDueStatesForScheduler>>[] = []
  if (execute) {
    for (let tick = 0; tick < 2; tick += 1) {
      schedulerRuns.push(await runGrowthObjectiveRuntimeScheduler(admin))
      draftFactoryTicks.push(
        await tickDraftFactoryDueStatesForScheduler(admin, {
          organizationIds: [orgId],
        }),
      )
      aslExecutions.push(
        await runAutonomousSalesLoop({
          admin,
          organizationId: orgId,
          maxIterations: 5,
          dailyBudgetMinutes: 30,
          dryRun: false,
        }),
      )
    }
    const schedulerOrgIds = await listActiveRunningGrowthObjectiveOrganizationIds(admin)
    await tickAutonomousSalesLoopForScheduler(admin, {
      organizationIds: schedulerOrgIds.slice(0, 2),
      dryRun: false,
      maxOrganizations: 2,
    })
  }

  const snapshot = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
  })
  const objectives = await loadGrowthHomeMissionDiscoveryObjectives(admin, orgId)
  const missionDiscovery = buildGrowthHomeMissionDiscoverySnapshot({
    objectives,
    leadPool: snapshot?.workManagerInput.workspaceSummary.leadPool ?? null,
  })
  const { data: waitingGeneration } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, paused_reason, last_error_code, updated_at")
    .eq("organization_id", orgId)
    .eq("state", "waiting_for_generation")
    .limit(10)
  const waitingGenerationLeads = []
  for (const row of waitingGeneration ?? []) {
    const lead = await fetchGrowthLeadById(admin, row.lead_id).catch(() => null)
    waitingGenerationLeads.push({
      leadId: row.lead_id,
      companyName: lead?.companyName ?? null,
      admission: resolveLeadAdmissionStateFromMetadata((lead?.metadata ?? {}) as Record<string, unknown>),
      contactEmail: lead?.contactEmail ?? null,
      pausedReason: row.paused_reason,
      lastErrorCode: row.last_error_code,
    })
  }
  const draftFactorySignals = await loadDraftFactorySignalCounts(admin, orgId)
  const diagnosis = snapshot
    ? diagnoseAutonomousSalesLoopWorkManager({
        organizationId: orgId,
        generatedAt: new Date().toISOString(),
        workManagerInput: snapshot.workManagerInput,
        portfolioLeads: snapshot.portfolioLeads,
        salesOutcomes: snapshot.salesOutcomes.outcomes,
        organizationalKnowledge: snapshot.organizationalKnowledge.store.items,
        persistedMemoryStore: snapshot.organizationalMemory.store,
        draftFactorySignals,
      })
    : null
  const aslDryRun = await inspectAutonomousSalesLoopDryRun(admin, { organizationId: orgId })
  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const nextExecutable = snapshot?.workManagerInput.workManagerResult
    ? selectNextExecutableWorkItem(snapshot.workManagerInput.workManagerResult)
    : null

  const funnelAfter = await buildExtendedFunnel(admin, orgId)
  const datamoonAfter = await loadDatamoonHealth(admin, orgId)
  const freshPackages = await findFreshSupervisedPackages(admin, orgId, proofStartedAt)

  const supervisedGens = snapshot
    ? await loadSupervisedAvaGenerationsForHome(
        admin,
        snapshot.portfolioLeads.map((lead) => lead.id),
      )
    : []
  const leadsById = snapshot ? buildLeadsByIdMap(snapshot.portfolioLeads) : new Map()
  const homeAttention = buildSupervisedAvaHomeOperatorAttention({
    generations: supervisedGens,
    leadsById,
  })
  const approvalSnapshot = await loadCanonicalOperatorApprovalSnapshotForHome(admin, { organizationId: orgId })

  const acceptedLeads = []
  for (const lead of snapshot?.portfolioLeads ?? []) {
    const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    if (admission !== "accepted") continue
    acceptedLeads.push({
      id: lead.id,
      companyName: lead.companyName,
      status: lead.status,
      contactEmail: lead.contactEmail,
      portfolioEligible: evaluateGrowthPortfolioLeadEligibility({ lead, organizationId: orgId }).eligible,
      researchReady: shouldAutoQueueLeadResearch(lead),
      reasons: admissionReasons((lead.metadata ?? {}) as Record<string, unknown>),
    })
  }

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        generatedAt,
        organizationId: orgId,
        execute,
        deployReadiness: {
          intakeSourceFixPresent: true,
          intakeSourceQaMarker: "ava-crosswalk-e2e-autonomy-1a-admission-intake-source-v1",
          monitorAudienceObservationalFix: "discovery:monitor_audience uses wait kind when refresh not due",
        },
        stuckLeadRepair: {
          beforeCount: stuckBefore.length,
          afterCount: stuckAfter.length,
          candidatesBefore: stuckBefore.map((row) => ({
            id: row.id,
            company: row.company_name,
          })),
          repairResults,
        },
        datamoonHealth: {
          before: datamoonBefore,
          after: datamoonAfter,
        },
        missionDiscovery,
        draftFactorySignals,
        waitingGenerationLeads,
        funnelBefore,
        funnelAfter,
        acceptedLeads,
        monitorAudienceDiagnosis: {
          aslDryRunSelected: aslDryRun.selected_work,
          nextExecutable: nextExecutable
            ? {
                id: nextExecutable.id,
                title: nextExecutable.title,
                type: nextExecutable.type,
                canExecuteAutonomously: nextExecutable.can_execute_autonomously,
                leadId: extractLeadIdFromWorkItem(nextExecutable),
              }
            : null,
          diagnosisSummary: diagnosis
            ? {
                executableWorkItems: diagnosis.executable_work_items,
                selectedExecutable: diagnosis.selected_executable,
                nonExecutionReason: diagnosis.non_execution_reason,
                topBlockedReasons: diagnosis.top_blocked_reasons,
              }
            : null,
        },
        aslExecutions: execute
          ? aslExecutions.map((result) => ({
              executed: result.executed,
              outcomesCompleted: result.outcomes_completed,
              stopReason: result.stop_reason,
              nonExecutionReason: result.non_execution_reason,
              selectedWork: result.selected_work,
              iterationLog: result.iteration_log,
            }))
          : null,
        schedulerRuns: execute
          ? schedulerRuns.map((result) => ({
              draftFactoryAdvances: result.telemetry.draftFactoryAdvances,
              missionOrchestrationsAttempted: result.missionOrchestrationsAttempted,
              autonomousSalesLoop: result.autonomousSalesLoop,
            }))
          : null,
        draftFactoryTicks: execute ? draftFactoryTicks : null,
        freshSupervisedPackagesSinceProofStart: freshPackages,
        homeVerification: {
          readyForReview: homeAttention.readyForReview.map((row) => ({
            generationId: row.generationId,
            leadId: row.leadId,
            companyName: row.companyName,
          })),
          needsInformation: homeAttention.needsInformation.length,
          approvalSnapshotPending: approvalSnapshot.pendingApprovalCount,
        },
        killSwitches,
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
