/**
 * AVA-AUTONOMOUS-EXECUTION-RECOVERY-1A — Read-only production ASL executable-work probe.
 *
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/probe-ava-autonomous-execution-recovery-1a-production.ts
 */

import { createClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import {
  classifyStopInvestmentPause,
  diagnoseAutonomousSalesLoopWorkManager,
  loadDraftFactorySignalCounts,
} from "@/lib/growth/specialists/execution/autonomous-sales-loop-diagnosis-1a"
import {
  inspectAutonomousSalesLoopDryRun,
  tickAutonomousSalesLoopForScheduler,
} from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { listActiveRunningGrowthObjectiveOrganizationIds } from "@/lib/growth/objectives/growth-objective-repository"
import { fetchGrowthLeadById, fetchGrowthHomeLeadPoolPage } from "@/lib/growth/lead-repository"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { evaluateGrowthCanonicalStateConsistencyForLead } from "@/lib/growth/revenue-workflow/growth-canonical-state-consistency-1a"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"

const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3" as const
const PROBE_MARKER = "ava-autonomous-execution-recovery-1a-production-probe-v1" as const

async function main() {
  bootstrapGrowthOperatorNotificationsCertEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env")

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const generatedAt = new Date().toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const schedulerOrgIds = await listActiveRunningGrowthObjectiveOrganizationIds(admin)
  const draftFactorySignals = await loadDraftFactorySignalCounts(admin, orgId)

  const snapshot = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
    organizationId: orgId,
    generatedAt,
  })
  if (!snapshot) throw new Error("portfolio snapshot unavailable")

  const diagnosis = diagnoseAutonomousSalesLoopWorkManager({
    organizationId: orgId,
    generatedAt,
    workManagerInput: snapshot.workManagerInput,
    portfolioLeads: snapshot.portfolioLeads,
    salesOutcomes: snapshot.salesOutcomes.outcomes,
    organizationalKnowledge: snapshot.organizationalKnowledge.store.items,
    persistedMemoryStore: snapshot.organizationalMemory.store,
    draftFactorySignals,
  })

  const aslDryRun = await inspectAutonomousSalesLoopDryRun(admin, { organizationId: orgId, generatedAt })
  const schedulerTick = await tickAutonomousSalesLoopForScheduler(admin, {
    organizationIds: schedulerOrgIds.slice(0, 2),
    dryRun: true,
    maxOrganizations: 2,
  })

  const { data: dfRows } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, paused_reason, last_error_code, updated_at")
    .eq("organization_id", orgId)
    .eq("state", "paused")
    .eq("paused_reason", "stop_investment")
    .gte("updated_at", sevenDaysAgo)

  const stopInvestmentCategories: Record<string, number> = {}
  const stopInvestmentSamples: Array<{ leadId: string; company: string | null; category: string }> = []

  for (const row of dfRows ?? []) {
    const lead = await fetchGrowthLeadById(admin, row.lead_id).catch(() => null)
    const category = lead
      ? classifyStopInvestmentPause({
          lead,
          organizationId: orgId,
          draftFactoryState: row.state,
          pausedReason: row.paused_reason,
          lastErrorCode: row.last_error_code,
        })
      : "H_other"
    stopInvestmentCategories[category] = (stopInvestmentCategories[category] ?? 0) + 1
    if (stopInvestmentSamples.length < 8) {
      stopInvestmentSamples.push({
        leadId: row.lead_id,
        company: lead?.companyName ?? null,
        category,
      })
    }
  }

  const leadPool = await fetchGrowthHomeLeadPoolPage(admin, { cursor: null, limit: 100 })
  const viableCandidates: Array<{
    leadId: string
    company: string | null
    status: string | null
    admission: string | null
    researchReady: boolean
    eligibility: string | null
    inconsistencies: string[]
    draftFactoryState: string | null
    blockedReason: string
  }> = []

  const dfByLead = new Map<string, { state: string; paused_reason: string | null }>()
  const { data: allDf } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, paused_reason")
    .eq("organization_id", orgId)
  for (const row of allDf ?? []) {
    dfByLead.set(row.lead_id, { state: row.state, paused_reason: row.paused_reason })
  }

  for (const lead of leadPool.leads) {
    const createdAt = lead.createdAt ?? lead.metadata?.created_at
    if (typeof createdAt === "string" && createdAt < sevenDaysAgo) continue

    const eligibility = evaluateGrowthPortfolioLeadEligibility({ lead, organizationId: orgId })
    const researchReady = shouldAutoQueueLeadResearch(lead)
    const inconsistencies = evaluateGrowthCanonicalStateConsistencyForLead({
      lead,
      organizationId: orgId,
    }).map((row) => row.kind)

    const df = dfByLead.get(lead.id)
    const blockedReason =
      df?.state === "paused" && df.paused_reason === "stop_investment"
        ? "stop_investment"
        : !eligibility.eligible
          ? `eligibility:${eligibility.reasonCode}`
          : !researchReady
            ? "research_not_ready"
            : "executable_candidate"

    if (eligibility.eligible && (researchReady || df?.state === "waiting_for_generation")) {
      viableCandidates.push({
        leadId: lead.id,
        company: lead.companyName,
        status: lead.status,
        admission: String(lead.metadata?.admission_state ?? null),
        researchReady,
        eligibility: eligibility.reasonCode,
        inconsistencies,
        draftFactoryState: df?.state ?? null,
        blockedReason,
      })
    }
  }

  const blockImaging = await fetchGrowthLeadById(admin, BLOCK_IMAGING_LEAD_ID).catch(() => null)

  console.log(
    JSON.stringify(
      {
        qa_marker: PROBE_MARKER,
        generated_at: generatedAt,
        organization_id: orgId,
        canonical_org_id: getGrowthEngineAiOrgId(),
        scheduler_organization_ids: schedulerOrgIds,
        portfolio: {
          lead_count: snapshot.leadCount,
          eligible_lead_count: snapshot.eligibleLeadCount,
          mission_discovery_action: snapshot.workManagerInput.workspaceSummary.missionDiscovery?.discoveryAction ?? null,
        },
        draft_factory_signals: draftFactorySignals,
        asl_diagnosis: diagnosis,
        asl_dry_run: {
          executed: aslDryRun.executed,
          stop_reason: aslDryRun.stop_reason,
          non_execution_reason: aslDryRun.non_execution_reason,
          selected_work: aslDryRun.selected_work,
        },
        scheduler_tick_dry_run: schedulerTick,
        stop_investment: {
          recent_count: dfRows?.length ?? 0,
          by_category: stopInvestmentCategories,
          samples: stopInvestmentSamples,
        },
        viable_candidates_last_7d: viableCandidates.slice(0, 15),
        block_imaging: blockImaging
          ? {
              lead_id: blockImaging.id,
              company: blockImaging.companyName,
              status: blockImaging.status,
              draft_factory: dfByLead.get(blockImaging.id) ?? null,
            }
          : null,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
