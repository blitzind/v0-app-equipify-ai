/**
 * GE-AIOS-LIVE-7A — Autonomous Research Activation & Throughput Certification.
 *
 * Audit (read-only):
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-live-7a-autonomous-research-production.ts
 *
 * Activate research + run autonomous validation (production writes):
 *   CONFIRM_GE_AIOS_LIVE_7A_ACTIVATE_RESEARCH=1 node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-live-7a-autonomous-research-production.ts
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { runAvaResearchQueueOrchestrator } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-service"
import { GROWTH_AVA_RESEARCH_QUEUE_DEFAULT_MAX_LEADS } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  evaluateResearchPilotAutonomyPolicyGate,
  resolveEffectiveResearchCapabilityEnabled,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import {
  GROWTH_AUTONOMY_DEFAULT_DAILY_BUDGET_LIMITS,
  GROWTH_AUTONOMY_BUDGET_DISABLED_CAP,
} from "@/lib/growth/autonomy/growth-autonomy-config"
import {
  fetchGrowthAutonomySettings,
  upsertGrowthAutonomySettings,
} from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { DEFAULT_PORTFOLIO_MAXIMUM_CONCURRENT_RESEARCH } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import { fetchActiveProspectResearchRun } from "@/lib/growth/research/research-repository"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { diagnoseAdmissionQueue } from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"

export const GE_AIOS_LIVE_7A_QA_MARKER = "ge-aios-live-7a-autonomous-research-cert-v1" as const
export const CONFIRM_GE_AIOS_LIVE_7A_ACTIVATE_RESEARCH = "CONFIRM_GE_AIOS_LIVE_7A_ACTIVATE_RESEARCH" as const

const ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
const ACTIVATION_RESEARCH_DAILY_BUDGET = 500 as const

type LeadSnapshot = {
  id: string
  company_name: string | null
  website: string | null
  status: string
  metadata: Record<string, unknown>
  created_at: string
  last_prospect_researched_at: string | null
  latest_prospect_research_run_id: string | null
}

async function fetchResearchEligibleReviewLeads(admin: SupabaseClient, limit = 100): Promise<LeadSnapshot[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, website, status, metadata, created_at, last_prospect_researched_at, latest_prospect_research_run_id",
    )
    .not("status", "in", '("archived","disqualified","duplicate")')
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).filter((lead) => {
    const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata as Record<string, unknown>)
    return (
      admission === "review" &&
      shouldAutoQueueLeadResearch({
        website: lead.website,
        status: lead.status,
        metadata: lead.metadata,
        lastProspectResearchedAt: lead.last_prospect_researched_at,
        latestProspectResearchRunId: lead.latest_prospect_research_run_id,
        lastResearchedAt: null,
        latestResearchRunId: null,
      })
    )
  }) as LeadSnapshot[]
}

function estimateDrainDays(input: {
  backlog: number
  runsPerDay: number
  concurrency: number
  minutesPerRun: number
}): number {
  const effectiveDaily = Math.min(input.runsPerDay, (24 * 60) / input.minutesPerRun) * Math.min(input.concurrency, input.runsPerDay)
  if (effectiveDaily <= 0) return Infinity
  return Number((input.backlog / effectiveDaily).toFixed(1))
}

async function snapshotLead(admin: SupabaseClient, leadId: string) {
  const { data } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, status, metadata, last_prospect_researched_at, latest_prospect_research_run_id, updated_at",
    )
    .eq("id", leadId)
    .maybeSingle()
  if (!data) return null
  const metadata = (data.metadata as Record<string, unknown> | null) ?? {}
  return {
    leadId: data.id,
    company: data.company_name,
    status: data.status,
    admission: resolveLeadAdmissionStateFromMetadata(metadata) ?? "pending",
    admissionEvaluatedAt: metadata.admission_evaluated_at ?? null,
    admissionReasons: metadata.admission_reasons ?? [],
    operationalKeywordValidation: metadata.operational_keyword_validation ?? null,
    lastProspectResearchedAt: data.last_prospect_researched_at,
    latestProspectResearchRunId: data.latest_prospect_research_run_id,
    updatedAt: data.updated_at,
  }
}

async function buildPolicyAudit(admin: SupabaseClient, organizationId: string) {
  const [settings, killSwitches, policyContext] = await Promise.all([
    fetchGrowthAutonomySettings(admin, organizationId),
    getRuntimeKillSwitchStates(admin),
    fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, { organizationId }),
  ])

  const policy = policyContext.policy
  const researchAgent = policy.agentStates.find((s) => s.agentKind === "research_agent")
  const researchGate = evaluateResearchPilotAutonomyPolicyGate(policy)
  const settingsSnapshot = {
    ...settings,
    killSwitches: {
      autonomyEnabled: Boolean(killSwitches.autonomy_enabled),
      autonomyOutboundEnabled: Boolean(killSwitches.autonomy_outbound_enabled),
      autonomyGenerationEnabled: Boolean(killSwitches.autonomy_generation_enabled),
      autonomyObjectiveModeEnabled: Boolean(killSwitches.autonomy_objective_mode_enabled),
    },
  }
  const effectiveResearch = resolveEffectiveResearchCapabilityEnabled(settingsSnapshot)

  return {
    authority: "Growth Autonomy settings (organization_autonomy_settings) + kill switches + policy synthesizer",
    masterMode: { production: settings.masterMode, default: "manual" },
    capabilityToggles: {
      research: {
        production: settings.capabilityToggles.research,
        default: false,
        mapsTo: "research_agent via AGENT_CAPABILITY_MAP",
      },
      enrichment: {
        production: settings.capabilityToggles.enrichment,
        default: false,
        note: "qualification_agent only — not prospect research",
      },
    },
    dailyBudgetLimits: {
      autonomous_research_runs: {
        production: settings.dailyBudgetLimits.autonomous_research_runs,
        default: GROWTH_AUTONOMY_DEFAULT_DAILY_BUDGET_LIMITS.autonomous_research_runs,
        disabledWhen: GROWTH_AUTONOMY_BUDGET_DISABLED_CAP,
        note: "Budget cap 0 means disabled per growth-autonomy-config.ts",
      },
    },
    killSwitches: {
      autonomy_enabled: killSwitches.autonomy_enabled,
      autonomy_objective_mode_enabled: killSwitches.autonomy_objective_mode_enabled,
      autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
    },
    researchAgent: researchAgent
      ? {
          enabled: researchAgent.enabled,
          disabledReason: researchAgent.disabledReason,
          policyEvaluation: researchAgent.policyEvaluation,
        }
      : null,
    researchAutonomyEnabled: policy.researchAutonomyEnabled,
    researchPilotGate: researchGate,
    effectiveResearchCapabilityEnabled: effectiveResearch,
    portfolioMaximumConcurrentResearch: DEFAULT_PORTFOLIO_MAXIMUM_CONCURRENT_RESEARCH,
    researchPilotBudget: GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET,
    overridePrecedence: [
      "1. Platform kill switches (autonomy_enabled, objective mode, etc.)",
      "2. masterMode (manual blocks all agents)",
      "3. capabilityToggles.research (research_agent linked capability)",
      "4. dailyBudgetLimits.autonomous_research_runs (0 = disabled)",
      "5. Research pilot control state (derived from policy via deriveResearchPilotControlFromPolicy)",
      "6. Business Profile portfolioManagement (concurrent research cap for replenishment only)",
    ],
    blockingConfiguration: !researchAgent?.enabled
      ? researchAgent?.disabledReason ?? researchGate.blockReason ?? "research_agent disabled"
      : researchGate.blockReason,
  }
}

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts (not .env.local)")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = ORG_ID
  }

  const admin = boot.admin
  const generatedAt = new Date().toISOString()
  const activate = process.env[CONFIRM_GE_AIOS_LIVE_7A_ACTIVATE_RESEARCH] === "1"

  const [policyBefore, queueBefore, eligibleLeads] = await Promise.all([
    buildPolicyAudit(admin, ORG_ID),
    diagnoseAdmissionQueue(admin, ORG_ID),
    fetchResearchEligibleReviewLeads(admin, 100),
  ])

  const traceLeadId = eligibleLeads[0]?.id ?? null
  const traceBefore = traceLeadId ? await snapshotLead(admin, traceLeadId) : null

  let activationApplied = false
  let policyAfter = policyBefore
  let orchestratorResult: Awaited<ReturnType<typeof runAvaResearchQueueOrchestrator>> | null = null
  let schedulerResults: Awaited<ReturnType<typeof runGrowthObjectiveRuntimeScheduler>>[] = []
  let traceAfter: Awaited<ReturnType<typeof snapshotLead>> = null

  if (activate) {
    const current = await fetchGrowthAutonomySettings(admin, ORG_ID)
    const existingCap = current.dailyBudgetLimits.autonomous_research_runs ?? 0
    await upsertGrowthAutonomySettings(admin, ORG_ID, {
      masterMode: "objective",
      capabilityToggles: {
        ...current.capabilityToggles,
        research: true,
      },
      dailyBudgetLimits: {
        ...current.dailyBudgetLimits,
        autonomous_research_runs: Math.max(existingCap, ACTIVATION_RESEARCH_DAILY_BUDGET),
      },
    })
    activationApplied = true
    policyAfter = await buildPolicyAudit(admin, ORG_ID)

    orchestratorResult = await runAvaResearchQueueOrchestrator(admin, {
      organizationId: ORG_ID,
      maxLeads: 3,
      generatedAt: new Date().toISOString(),
    })

    for (let i = 0; i < 2; i += 1) {
      schedulerResults.push(await runGrowthObjectiveRuntimeScheduler(admin))
    }

    if (traceLeadId) {
      traceAfter = await snapshotLead(admin, traceLeadId)
      if (traceAfter && !traceAfter.latestProspectResearchRunId) {
        const activeRun = await fetchActiveProspectResearchRun(admin, traceLeadId)
        if (activeRun) {
          traceAfter = { ...traceAfter, latestProspectResearchRunId: activeRun.id }
        }
      }
    }
  }

  const queueAfter = await diagnoseAdmissionQueue(admin, ORG_ID)
  const generatedAtAfter = new Date().toISOString()
  const work = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
    organizationId: ORG_ID,
    generatedAt: generatedAtAfter,
  })
  const approved = await getActiveApprovedBusinessProfile(admin, ORG_ID).catch(() => null)
  const pm = buildGrowthPortfolioManagerSnapshot({
    organizationId: ORG_ID,
    generatedAt: generatedAtAfter,
    leads: work?.portfolioLeads ?? [],
    eligibleLeadCount: work?.eligibleLeadCount ?? 0,
    approvedProfile: approved?.profile ?? null,
  })

  const acceptedAfter = (work?.portfolioLeads ?? []).filter(
    (l) => resolveLeadAdmissionStateFromMetadata(l.metadata) === "accepted",
  ).length

  const backlog = eligibleLeads.length
  const minutesPerRun = 4

  const report = {
    qa_marker: GE_AIOS_LIVE_7A_QA_MARKER,
    generated_at: generatedAt,
    organization_id: ORG_ID,
    activation_applied: activationApplied,
    audit_1_research_policy: policyBefore,
    audit_2_research_scheduler: {
      scheduler_entry: "runGrowthObjectiveRuntimeScheduler → tickAutonomousSalesLoopForScheduler",
      sales_loop_execution:
        "selectNextExecutableWorkItem (decision_score desc, priority desc) → executeSalesWorkflowAgent research_agent → executeGrowthLeadProspectResearch",
      ava_orchestrator_entry:
        "runAvaResearchQueueOrchestrator → selectRevenueQueueResearchCandidates → processLeadResearch → executeGrowthLeadProspectResearch",
      post_research_admission:
        "runProspectResearch → reconcileExternalDiscoveryPostResearchAdmission (operational keyword validation)",
      research_pilot_note:
        "runAutonomousResearchPilotCycle (5B) uses buildDeterministicResearchSummary — NOT real prospect research; excluded from LIVE-7A drain path",
      concurrency: {
        portfolio_maximum_concurrent_research: DEFAULT_PORTFOLIO_MAXIMUM_CONCURRENT_RESEARCH,
        research_pilot_max_runs_per_hour: GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET.maxRunsPerHour,
        ava_orchestrator_default_max_leads: GROWTH_AVA_RESEARCH_QUEUE_DEFAULT_MAX_LEADS,
        sales_loop_max_iterations_per_tick: 2,
      },
      scheduler_runs: schedulerResults.map((r) => ({
        objectivesSelected: r.objectivesSelected,
        ticksAttempted: r.ticksAttempted,
        missionOrchestrationsAttempted: r.missionOrchestrationsAttempted,
        autonomousSalesLoop: r.autonomousSalesLoop,
      })),
    },
    audit_3_candidate_selection: {
      ava_orchestrator:
        "Revenue Queue sections high_priority then needs_review; sort mode priority: candidate_priority (urgent>high>normal>low), lead_score/intent_score desc, last_activity_at desc",
      sales_loop: "Work manager decision_score desc, then priority desc",
      research_pilot_5b: "selectResearchWakeCandidates from mission priority ranked missions (shadow only for real research path)",
      production_eligible_review_count: eligibleLeads.length,
      sample_candidate_ids: eligibleLeads.slice(0, 5).map((l) => l.id),
    },
    audit_4_lifecycle_trace: {
      traceLeadId,
      before: traceBefore,
      after: traceAfter,
      orchestrator_lead_results: orchestratorResult?.summary?.leadResults ?? [],
    },
    audit_5_operational_keyword_validation: {
      when_removed:
        "After successful runProspectResearch via reconcileExternalDiscoveryPostResearchAdmission",
      trigger: "evaluateGrowthOperationalKeywordValidation on research evidence + website crawl text",
      authority: "growth-operational-keyword-validation-server-1a.ts (post-research only)",
      persistence: "buildLeadAdmissionMetadata + buildOperationalKeywordValidationMetadata written to lead.metadata",
      intake_deferral:
        "At intake, operationalKeywordValidation=null forces review + pending_operational_keyword_validation reason",
      downstream:
        "accepted when keyword pass + industry gate pass; rejected on fail; remains review if blocking reasons persist",
    },
    audit_6_throughput_projection: {
      backlog_research_eligible: backlog,
      assumed_minutes_per_run: minutesPerRun,
      estimates: {
        concurrency_1: {
          runsPerDayCap: ACTIVATION_RESEARCH_DAILY_BUDGET,
          estimated_drain_days: estimateDrainDays({
            backlog,
            runsPerDay: ACTIVATION_RESEARCH_DAILY_BUDGET,
            concurrency: 1,
            minutesPerRun,
          }),
        },
        concurrency_5: {
          runsPerDayCap: ACTIVATION_RESEARCH_DAILY_BUDGET,
          estimated_drain_days: estimateDrainDays({
            backlog,
            runsPerDay: ACTIVATION_RESEARCH_DAILY_BUDGET,
            concurrency: 5,
            minutesPerRun,
          }),
        },
        concurrency_10: {
          runsPerDayCap: ACTIVATION_RESEARCH_DAILY_BUDGET,
          estimated_drain_days: estimateDrainDays({
            backlog,
            runsPerDay: ACTIVATION_RESEARCH_DAILY_BUDGET,
            concurrency: 10,
            minutesPerRun,
          }),
        },
        production_maximum_concurrent_research: {
          cap: DEFAULT_PORTFOLIO_MAXIMUM_CONCURRENT_RESEARCH,
          note: "Replenishment gate only; does not cap executeGrowthLeadProspectResearch parallelism directly",
        },
      },
    },
    audit_7_safety: {
      duplicate_research: "fetchActiveProspectResearchRun + shouldAutoQueueLeadResearch / research_fresh skip",
      retry: "failed runs finish with status failed; researchCanRetry messaging; stale refresh after 30 days",
      failed_recovery: "research workflow status failed/blocked; re-eligible via stale or force",
      partial_completion: "markLeadProspectResearchCompleted on success; failed runs do not reconcile admission",
      scheduler_interruption: "withSchedulerWorkTimeout on sales loop org tick (8s default)",
      admission_reconciliation_idempotency:
        "reconcileExternalDiscoveryPostResearchAdmission re-evaluates from current lead + evidence; overwrites metadata via updateGrowthLeadFromImportMerge",
    },
    audit_8_production_validation: {
      activated: activationApplied,
      policy_after: policyAfter,
      queue_before: {
        admissionsPending: queueBefore.admissionsPending,
        researchEligible: queueBefore.researchEligible,
        blockedByQueueLimit: queueBefore.blockedByQueueLimit,
      },
      queue_after: {
        admissionsPending: queueAfter.admissionsPending,
        researchEligible: queueAfter.researchEligible,
        blockedByQueueLimit: queueAfter.blockedByQueueLimit,
      },
      accepted_count_after: acceptedAfter,
      replenishment_after: {
        shouldReplenish: pm.replenishment.shouldReplenish,
        blockedByQueueLimit: pm.replenishment.blockedByQueueLimit,
        reason: pm.replenishment.reason,
      },
      orchestrator: orchestratorResult
        ? {
            ok: orchestratorResult.ok,
            blocked: orchestratorResult.blocked,
            blockReason: orchestratorResult.blockReason,
            researchCompleted: orchestratorResult.summary?.researchCompleted ?? 0,
            companiesReviewed: orchestratorResult.summary?.companiesReviewed ?? 0,
            leadResults: orchestratorResult.summary?.leadResults ?? [],
          }
        : null,
    },
    verdict: {
      production_ready: null as boolean | null,
      remaining_blockers: [] as string[],
    },
  }

  const blockers: string[] = []
  if (!policyBefore.capabilityToggles.research.production) {
    blockers.push("capabilityToggles.research=false (research_agent blocked)")
  }
  if (policyBefore.dailyBudgetLimits.autonomous_research_runs.production === 0) {
    blockers.push("dailyBudgetLimits.autonomous_research_runs=0 (budget disabled)")
  }
  if (!policyBefore.researchAgent?.enabled) {
    blockers.push(`research_agent disabled: ${policyBefore.researchAgent?.policyEvaluation ?? "unknown"}`)
  }

  if (!activate) {
    report.verdict.production_ready = false
    report.verdict.remaining_blockers = [
      ...blockers,
      "CONFIRM_GE_AIOS_LIVE_7A_ACTIVATE_RESEARCH=1 not set — activation and live run skipped",
    ]
  } else {
    const researchRan = (orchestratorResult?.summary?.researchCompleted ?? 0) > 0
    const admissionDrained = queueAfter.admissionsPending < queueBefore.admissionsPending
    const acceptedIncreased = acceptedAfter > 2
    const policyOpen = Boolean(policyAfter.researchAgent?.enabled)

    report.verdict.production_ready =
      policyOpen && researchRan && (admissionDrained || acceptedIncreased)
    report.verdict.remaining_blockers = []
    if (!policyOpen) report.verdict.remaining_blockers.push("research policy still blocked after activation")
    if (!researchRan) report.verdict.remaining_blockers.push("no research runs completed in orchestrator pass")
    if (!admissionDrained && !acceptedIncreased) {
      report.verdict.remaining_blockers.push("admissionsPending did not decrease and accepted count unchanged")
    }
    if (queueAfter.blockedByQueueLimit && queueAfter.admissionsPending >= queueBefore.admissionsPending) {
      report.verdict.remaining_blockers.push("replenishment still blocked — backlog not yet below cap")
    }
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
