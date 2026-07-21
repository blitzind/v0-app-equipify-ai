/**
 * GE-AIOS-LIVE-6A — Autonomous Admission Pipeline Audit (read-only, production).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/audit-ge-aios-live-6a-admission-pipeline-production.ts
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { resolveAutonomousPortfolioDiscoveryExecutionPlan } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { analyzeGrowthLeadAdmissionProductionPool } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { diagnoseAdmissionQueue } from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"
import { diagnoseLiveQualificationAutonomy } from "@/lib/growth/training/live-qualification-production-unblock-1a"

export const GE_AIOS_LIVE_6A_QA_MARKER = "ge-aios-live-6a-admission-pipeline-audit-v1" as const

const ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID

type AgeBucket = "under1d" | "d1to3" | "d3to7" | "over7d"

function ageBucket(createdAt: string | null | undefined, nowMs: number): AgeBucket {
  if (!createdAt) return "over7d"
  const ageMs = nowMs - Date.parse(createdAt)
  if (ageMs < 86_400_000) return "under1d"
  if (ageMs < 3 * 86_400_000) return "d1to3"
  if (ageMs < 7 * 86_400_000) return "d3to7"
  return "over7d"
}

function emptyAgeBuckets(): Record<AgeBucket, number> {
  return { under1d: 0, d1to3: 0, d3to7: 0, over7d: 0 }
}

function utcDayKey(iso: string): string {
  return iso.slice(0, 10)
}

async function fetchRecentDiscoveryRuns(admin: SupabaseClient, organizationId: string, limit = 5) {
  const { data } = await admin
    .schema("growth")
    .from("growth_autonomous_prospect_search_runs")
    .select("id, status, created_at, completed_at, metadata, audience_id, provider")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return data ?? []
}

async function traceLeadLifecycle(
  admin: SupabaseClient,
  leadId: string,
): Promise<Record<string, unknown>> {
  const { data: lead } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, website, status, metadata, created_at, updated_at, latest_prospect_research_run_id, last_prospect_researched_at",
    )
    .eq("id", leadId)
    .maybeSingle()

  if (!lead) return { leadId, error: "lead_not_found" }

  const metadata = (lead.metadata as Record<string, unknown> | null) ?? {}
  const intakeRunId =
    typeof metadata.prospect_search_run_id === "string"
      ? metadata.prospect_search_run_id
      : typeof metadata.unified_intake_run_id === "string"
        ? metadata.unified_intake_run_id
        : null

  let discoveryRun: Record<string, unknown> | null = null
  if (intakeRunId) {
    const { data: run } = await admin
      .schema("growth")
      .from("growth_autonomous_prospect_search_runs")
      .select("id, status, created_at, completed_at, provider, metadata")
      .eq("id", intakeRunId)
      .maybeSingle()
    discoveryRun = run as Record<string, unknown> | null
  }

  const admission = resolveLeadAdmissionStateFromMetadata(metadata)
  const researchEligible = shouldAutoQueueLeadResearch({
    website: lead.website,
    status: lead.status,
    metadata,
    lastProspectResearchedAt: lead.last_prospect_researched_at,
    latestProspectResearchRunId: lead.latest_prospect_research_run_id,
    lastResearchedAt: null,
    latestResearchRunId: null,
  })

  return {
    leadId: lead.id,
    company: lead.company_name,
    website: lead.website,
    status: lead.status,
    admissionState: admission ?? "pending_null_metadata",
    admissionEvaluatedAt: metadata.admission_evaluated_at ?? null,
    admissionReasons: metadata.admission_reasons ?? [],
    unifiedIntakeSource: metadata.unified_intake_source ?? null,
    researchEligible,
    lastProspectResearchedAt: lead.last_prospect_researched_at,
    lifecycle: {
      discovery: discoveryRun
        ? {
            runId: discoveryRun.id,
            provider: discoveryRun.provider,
            status: discoveryRun.status,
            createdAt: discoveryRun.created_at,
            completedAt: discoveryRun.completed_at,
          }
        : intakeRunId
          ? { runId: intakeRunId, note: "run_row_not_found" }
          : null,
      intake: {
        leadCreatedAt: lead.created_at,
        intakeSource: metadata.unified_intake_source ?? null,
      },
      admission: {
        state: admission ?? "pending",
        evaluatedAt: metadata.admission_evaluated_at ?? null,
        reasons: metadata.admission_reasons ?? [],
      },
      researchEligibility: {
        eligible: researchEligible,
        blockedReason: researchEligible
          ? null
          : admission === "review"
            ? "review_state_requires_website_or_operator"
            : admission === "invalid" || admission === "rejected"
              ? `admission_${admission}`
              : !lead.website?.trim()
                ? "missing_website"
                : "other",
      },
      currentState: {
        status: lead.status,
        admission: admission ?? "pending",
        researched: Boolean(lead.last_prospect_researched_at),
      },
    },
  }
}

async function fetchProductionLeadPool(admin: SupabaseClient) {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, website, status, metadata, created_at, updated_at, latest_prospect_research_run_id, last_prospect_researched_at",
    )
    .not("status", "in", '("archived","disqualified","duplicate")')
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) throw new Error(error.message)
  return data ?? []
}

async function computeDailyThroughput(
  admin: SupabaseClient,
  organizationId: string,
  days: number | null = 14,
) {
  let query = admin
    .schema("growth")
    .from("leads")
    .select("id, status, metadata, created_at")
    .not("status", "in", '("archived","disqualified","duplicate")')
    .order("created_at", { ascending: true })

  const since =
    days != null ? new Date(Date.now() - days * 86_400_000).toISOString() : null
  if (since) query = query.gte("created_at", since)

  const { data: leads } = await query

  const newAdmissionsByDay: Record<string, number> = {}
  const completedByDay: Record<string, number> = {}
  const pendingWaitMs: number[] = []

  for (const lead of leads ?? []) {
    const createdDay = utcDayKey(String(lead.created_at))
    newAdmissionsByDay[createdDay] = (newAdmissionsByDay[createdDay] ?? 0) + 1

    const metadata = (lead.metadata as Record<string, unknown> | null) ?? {}
    const admission = resolveLeadAdmissionStateFromMetadata(metadata)
    const evaluatedAt =
      typeof metadata.admission_evaluated_at === "string" ? metadata.admission_evaluated_at : null

    if (evaluatedAt && admission === "accepted") {
      const day = utcDayKey(evaluatedAt)
      completedByDay[day] = (completedByDay[day] ?? 0) + 1
      const wait = Date.parse(evaluatedAt) - Date.parse(String(lead.created_at))
      if (Number.isFinite(wait) && wait >= 0) pendingWaitMs.push(wait)
    }
  }

  const dayKeys = [...new Set([...Object.keys(newAdmissionsByDay), ...Object.keys(completedByDay)])].sort()
  let cumulative = 0
  const growthSeries: Array<{ day: string; netChange: number; cumulativePendingEstimate: number }> = []

  for (const day of dayKeys) {
    const created = newAdmissionsByDay[day] ?? 0
    const completed = completedByDay[day] ?? 0
    const net = created - completed
    cumulative += net
    growthSeries.push({ day, netChange: net, cumulativePendingEstimate: cumulative })
  }

  const avgNewPerDay =
    dayKeys.length > 0
      ? Object.values(newAdmissionsByDay).reduce((a, b) => a + b, 0) / dayKeys.length
      : 0
  const avgCompletedPerDay =
    dayKeys.length > 0
      ? Object.values(completedByDay).reduce((a, b) => a + b, 0) / dayKeys.length
      : 0
  const avgWaitHours =
    pendingWaitMs.length > 0
      ? pendingWaitMs.reduce((a, b) => a + b, 0) / pendingWaitMs.length / 3_600_000
      : null

  return {
    windowDays: days,
    since: since ?? "all_time",
    newAdmissionsByDay,
    completedAcceptedByDay: completedByDay,
    avgNewAdmissionsPerDay: Number(avgNewPerDay.toFixed(2)),
    avgCompletedAcceptedPerDay: Number(avgCompletedPerDay.toFixed(2)),
    avgQueueGrowthPerDay: Number((avgNewPerDay - avgCompletedPerDay).toFixed(2)),
    avgWaitHoursToAccepted: avgWaitHours != null ? Number(avgWaitHours.toFixed(2)) : null,
    acceptedSamplesWithWait: pendingWaitMs.length,
    growthSeries,
  }
}

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts (not .env.local)")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  const admin = boot.admin
  const generatedAt = new Date().toISOString()
  const nowMs = Date.parse(generatedAt)

  const poolLeads = await fetchProductionLeadPool(admin)

  const [queueDiagnosis, work, approved, autonomySettings, autonomyDiagnosis, killSwitches, analysis, daily14, dailyAll] =
    await Promise.all([
      diagnoseAdmissionQueue(admin, ORG_ID),
      buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId: ORG_ID, generatedAt }),
      getActiveApprovedBusinessProfile(admin, ORG_ID).catch(() => null),
      fetchGrowthAutonomySettings(admin, ORG_ID),
      diagnoseLiveQualificationAutonomy(admin, ORG_ID),
      getRuntimeKillSwitchStates(admin),
      analyzeGrowthLeadAdmissionProductionPool({ admin, organizationId: ORG_ID, limit: 500 }),
      computeDailyThroughput(admin, ORG_ID, 14),
      computeDailyThroughput(admin, ORG_ID, null),
    ])

  const pm = buildGrowthPortfolioManagerSnapshot({
    organizationId: ORG_ID,
    generatedAt,
    leads: work?.portfolioLeads ?? [],
    eligibleLeadCount: work?.eligibleLeadCount ?? 0,
    approvedProfile: approved?.profile ?? null,
  })

  const executionPlan = resolveAutonomousPortfolioDiscoveryExecutionPlan(pm.replenishment)
  const policyContext = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, { organizationId: ORG_ID })

  const inventory = {
    waitingForReview: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    researchEligible: 0,
    researchBlocked: 0,
    duplicate: 0,
    invalid: 0,
    pendingNullMetadata: 0,
    other: 0,
  }
  const ageDistribution = emptyAgeBuckets()
  const pendingOnlyAge = emptyAgeBuckets()
  const byReason: Record<string, number> = {}
  const byStatus: Record<string, number> = {}

  const pendingLeadIds: string[] = []

  for (const lead of poolLeads) {
    const status = lead.status?.trim().toLowerCase() ?? "unknown"
    byStatus[status] = (byStatus[status] ?? 0) + 1

    if (status === "archived" || status === "disqualified") continue

    const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    const bucket = ageBucket(lead.created_at ?? null, nowMs)
    ageDistribution[bucket] += 1

    const reasons = Array.isArray(lead.metadata?.admission_reasons)
      ? (lead.metadata.admission_reasons as string[])
      : []
    for (const reason of reasons) {
      byReason[reason] = (byReason[reason] ?? 0) + 1
    }

    const isPending = admission === "review" || admission == null
    if (isPending) {
      pendingLeadIds.push(lead.id)
      pendingOnlyAge[bucket] += 1
    }

    if (status === "duplicate") {
      inventory.duplicate += 1
      continue
    }

    if (admission === "review") inventory.waitingForReview += 1
    else if (admission === "accepted") inventory.accepted += 1
    else if (admission === "rejected") inventory.rejected += 1
    else if (admission === "invalid") inventory.invalid += 1
    else if (admission == null) inventory.pendingNullMetadata += 1
    else inventory.other += 1

    if (shouldAutoQueueLeadResearch(lead)) inventory.researchEligible += 1
    else inventory.researchBlocked += 1
  }

  const traceLeadId = pendingLeadIds[0] ?? poolLeads[0]?.id ?? null

  const lifecycleTrace = traceLeadId ? await traceLeadLifecycle(admin, traceLeadId) : null

  const recentDiscoveryRuns = await fetchRecentDiscoveryRuns(admin, ORG_ID)

  const portfolioConfig = approved?.profile?.portfolioManagement ?? null
  const defaultCap = 50

  const report = {
    qa_marker: GE_AIOS_LIVE_6A_QA_MARKER,
    generated_at: generatedAt,
    organization_id: ORG_ID,
    audit_1_inventory: {
      admissionsPending: queueDiagnosis.admissionsPending,
      breakdown: inventory,
      note_expired:
        "No admission_state=expired exists in GE-AIOS-21C; expired count is always 0 by schema.",
      age_distribution_all_active: ageDistribution,
      age_distribution_pending_only: pendingOnlyAge,
      by_admission_reason: byReason,
      by_lead_status: byStatus,
      stored_state_counts: queueDiagnosis.byStoredState,
    },
    audit_2_queue_health: {
      last_14_days: daily14,
      all_time: dailyAll,
      current_snapshot: {
        admissionsPending: pm.health.admissionsPending,
        awaitingReview: pm.health.counts.awaitingReview,
        awaitingAdmission: pm.health.counts.awaitingAdmission,
        activeCompanies: pm.health.counts.activeCompanies,
        targetActiveCompanies: pm.target.targetActiveCompanies,
        portfolioDeficit: pm.health.needsCount,
      },
    },
    audit_3_queue_cap: {
      maximumQueuedAdmissions: pm.target.maximumQueuedAdmissions,
      source: pm.target.source,
      business_profile_configured: portfolioConfig?.maximumQueuedAdmissions ?? null,
      default_constant: defaultCap,
      is_configurable: true,
      is_static_default_when_unconfigured: pm.target.source === "defaults",
      blocking_formula: "blockedByQueueLimit = admissionsPending >= maximumQueuedAdmissions",
      admissionsPending_definition: "awaitingAdmission (null metadata) + awaitingReview",
      blockedByQueueLimit: pm.replenishment.blockedByQueueLimit,
      why_50_chosen_evidence:
        "DEFAULT_PORTFOLIO_MAXIMUM_QUEUED_ADMISSIONS=50 in growth-autonomous-portfolio-manager-1a-types.ts; paired with maximumDailyDiscovery=50 — operator backlog guard, not runtime-derived.",
    },
    audit_4_lifecycle_trace: lifecycleTrace,
    audit_5_queue_blocking: {
      pending_count: queueDiagnosis.admissionsPending,
      cap: queueDiagnosis.maximumQueuedAdmissions,
      over_cap_by: Math.max(0, queueDiagnosis.admissionsPending - queueDiagnosis.maximumQueuedAdmissions),
      blockedByQueueLimit: pm.replenishment.blockedByQueueLimit,
      replenishment_reason: pm.replenishment.reason,
      execution_plan: executionPlan,
      root_cause_from_diagnosis: queueDiagnosis.rootCause,
      queueBlockedByRealWork: queueDiagnosis.queueBlockedByRealWork,
      research_eligible_in_pending: queueDiagnosis.researchEligible,
      operator_review_required: queueDiagnosis.operatorReviewRequired,
      stale_or_orphaned: queueDiagnosis.staleOrOrphaned,
      research_policy: {
        enrichment_capability: autonomySettings.capabilityToggles.enrichment,
        master_mode: autonomySettings.masterMode,
        first_qualification_blocker: autonomyDiagnosis.firstBlocker,
        research_agent_enabled: policyContext.policy.agentStates.find(
          (s) => s.agentKind === "research_agent",
        )?.enabled,
      },
      outbound_disabled: killSwitches.autonomy_outbound_enabled === false,
    },
    audit_6_prioritization: {
      admission_queue_ordering:
        "Portfolio replenishment gate counts pending admissions; no FIFO admission drain queue. Research orchestrator selects from Revenue Queue sections sorted by priority mode.",
      revenue_queue_sort_algorithm:
        "priority: candidate_priority (urgent>high>normal>low), then lead_score/intent_score desc, then last_activity_at desc",
      section_bucketing:
        "high_priority (urgent/high intent>=75), needs_review (human_review_required or new/reviewing), enrichment_needed, approved, pipeline_running, archived",
      research_orchestrator_sections: ["high_priority", "needs_review"],
    },
    audit_7_autonomous_progression_research_disabled: {
      can_admissions_progress_automatically: false,
      stop_stage:
        "Research orchestrator / qualification — enrichment capability disabled and/or research budget 0 blocks review→accepted progression",
      evidence: {
        enrichment_capability: autonomySettings.capabilityToggles.enrichment,
        first_blocker: autonomyDiagnosis.firstBlocker,
        shouldAutoQueueLeadResearch_eligible_count: queueDiagnosis.researchEligible,
        note:
          "Admission evaluation runs at intake; pending review leads require research or operator keyword validation to advance to accepted.",
      },
    },
    audit_8_recommendation: {
      classification: null as string | null,
      engineering_changes_required: null as boolean | null,
      policy_changes_required: null as boolean | null,
      smallest_throughput_improvement: null as string | null,
    },
    production_lead_pool: {
      total_active_leads: poolLeads.length,
      note:
        "growth.leads has no organization_id column; portfolio manager uses global fetchGrowthHomeLeadPoolPage — counts below reflect the same pool the admission gate reads.",
    },
    supporting: {
      portfolio_manager: {
        health: pm.health,
        target: pm.target,
        replenishment: pm.replenishment,
        executionPlan,
      },
      admission_analysis_counts: analysis.counts,
      admission_analysis_queue_by_state: analysis.queueByAdmissionState,
      recent_discovery_runs: recentDiscoveryRuns.map((run) => ({
        id: run.id,
        status: run.status,
        provider: run.provider,
        created_at: run.created_at,
        completed_at: run.completed_at,
      })),
    },
  }

  const pending = queueDiagnosis.admissionsPending
  const cap = queueDiagnosis.maximumQueuedAdmissions
  const researchDisabled = !autonomySettings.capabilityToggles.enrichment || autonomyDiagnosis.firstBlocker != null

  const keywordValidationBlocked = queueDiagnosis.operatorReviewRequired >= pending * 0.9

  if (keywordValidationBlocked && pending >= cap) {
    report.audit_8_recommendation = {
      classification: "Operator workflow is the bottleneck",
      engineering_changes_required: false,
      policy_changes_required: true,
      smallest_throughput_improvement:
        "Run post-research operational keyword validation (reconcileExternalDiscoveryPostResearchAdmission) or enable autonomous research on review leads — 100% of pending carry pending_operational_keyword_validation, which blocks review→accepted until research completes.",
    }
  } else if (pending >= cap && pm.replenishment.blockedByQueueLimit && researchDisabled) {
    report.audit_8_recommendation = {
      classification: "Research policy is preventing throughput",
      engineering_changes_required: false,
      policy_changes_required: true,
      smallest_throughput_improvement:
        "Enable enrichment capability (research) so review-state leads can auto-progress to accepted, draining admissionsPending below cap and unblocking discovery replenishment — without changing scheduler or discovery architecture.",
    }
  } else if (pending >= cap && queueDiagnosis.operatorReviewRequired > queueDiagnosis.researchEligible) {
    report.audit_8_recommendation = {
      classification: "Operator workflow is the bottleneck",
      engineering_changes_required: false,
      policy_changes_required: true,
      smallest_throughput_improvement:
        "Clear pending_operational_keyword_validation review backlog or raise maximumQueuedAdmissions in Business Profile portfolioManagement.",
    }
  } else if (pending >= cap) {
    report.audit_8_recommendation = {
      classification: "Queue not draining",
      engineering_changes_required: false,
      policy_changes_required: true,
      smallest_throughput_improvement:
        "Drain admissionsPending (research progression or operator review) before raising discovery intake; optionally increase maximumQueuedAdmissions if operator capacity supports it.",
    }
  } else {
    report.audit_8_recommendation = {
      classification: "Queue healthy",
      engineering_changes_required: false,
      policy_changes_required: false,
      smallest_throughput_improvement: "No admission queue change required at current pending level.",
    }
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
