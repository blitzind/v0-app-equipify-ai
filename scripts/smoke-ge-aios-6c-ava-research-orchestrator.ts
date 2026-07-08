/**
 * GE-AIOS-6C — Controlled Ava Research Orchestrator smoke test (production DB, local code).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/smoke-ge-aios-6c-ava-research-orchestrator.ts
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  fetchLatestAvaResearchLoopSummary,
  runAvaResearchQueueOrchestrator,
  selectRevenueQueueResearchCandidates,
} from "@/lib/growth/ava-home/growth-ava-research-orchestrator-service"
import {
  GROWTH_AVA_RESEARCH_LOOP_COMPLETED_EVENT,
  GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
} from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import { queryAiOsEvents } from "@/lib/growth/aios/ai-event-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { listGrowthLeads } from "@/lib/growth/lead-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { buildRevenueQueueCardProjectionFromLead } from "@/lib/growth/revenue-queue/revenue-queue-card-projection"
import { resolveRevenueQueueSectionFromCard } from "@/lib/growth/revenue-queue/revenue-queue-section-projection"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"

const ACTOR_USER_ID = "00000000-0000-0000-0000-000000000001"

function isTestLikeLead(input: {
  companyName: string
  contactEmail: string | null
  externalRef: string | null
  metadata: Record<string, unknown>
}): boolean {
  const haystack = [
    input.companyName,
    input.contactEmail ?? "",
    input.externalRef ?? "",
    JSON.stringify(input.metadata ?? {}),
  ]
    .join(" ")
    .toLowerCase()

  return (
    haystack.includes("equipify") ||
    haystack.includes("test lead") ||
    haystack.includes("qa_") ||
    haystack.includes("smoke") ||
    haystack.includes("@example.com")
  )
}

async function main(): Promise<void> {
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "bootstrap_failed" }, null, 2))
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    console.error(JSON.stringify({ ok: false, error: "missing_growth_engine_ai_org_id" }, null, 2))
    process.exit(1)
  }

  const leads = await listGrowthLeads(boot.admin, { limit: 100, includeArchived: false })
  const candidates = selectRevenueQueueResearchCandidates(leads, 5)

  const candidateDetails = candidates.map((card) => {
    const lead = leads.find((row) => row.id === card.id) ?? null
    return {
      leadId: card.id,
      companyName: card.company_name,
      section: resolveRevenueQueueSectionFromCard(card),
      candidatePriority: card.candidate_priority,
      intentScore: card.intent_score,
      status: card.status,
      website: lead?.website ?? null,
      isTestLike: lead
        ? isTestLikeLead({
            companyName: lead.companyName,
            contactEmail: lead.contactEmail,
            externalRef: lead.externalRef,
            metadata: lead.metadata,
          })
        : false,
    }
  })

  const selectedPreview = candidateDetails.find((row) => !row.isTestLike) ?? candidateDetails[0] ?? null

  console.log(
    JSON.stringify(
      {
        phase: "candidate_preview",
        qa_marker: GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
        organization_id: organizationId,
        revenue_queue_total: leads.length,
        orchestrator_top_candidates: candidateDetails,
        expected_first_selected: selectedPreview,
      },
      null,
      2,
    ),
  )

  const beforeCard = selectedPreview
    ? buildRevenueQueueCardProjectionFromLead(leads.find((row) => row.id === selectedPreview.leadId)!)
    : null

  const beforeResearch = selectedPreview
    ? await fetchLatestCompletedProspectResearchRun(boot.admin, selectedPreview.leadId).catch(() => null)
    : null

  const startedAt = Date.now()
  const result = await runAvaResearchQueueOrchestrator(boot.admin, {
    organizationId,
    actorUserId: ACTOR_USER_ID,
    maxLeads: 1,
  })
  const durationMs = Date.now() - startedAt

  const runId = result.summary?.runId ?? null
  const leadResult = result.summary?.leadResults[0] ?? null
  const leadId = leadResult?.leadId ?? selectedPreview?.leadId ?? null

  const afterLead = leadId ? leads.find((row) => row.id === leadId) : null
  const refreshedLead = leadId
    ? (await listGrowthLeads(boot.admin, { limit: 100, includeArchived: false })).find(
        (row) => row.id === leadId,
      ) ?? null
    : null

  const afterResearch = leadId
    ? await fetchLatestCompletedProspectResearchRun(boot.admin, leadId).catch(() => null)
    : null

  const workflowSnapshot = leadId
    ? await fetchLatestGrowthLeadResearchWorkflowSnapshot(boot.admin, {
        organizationId,
        leadId,
      })
    : null

  const loopEvents = await queryAiOsEvents(boot.admin, {
    organizationId,
    eventType: GROWTH_AVA_RESEARCH_LOOP_COMPLETED_EVENT,
    limit: 3,
  })

  const latestLoopEvent = loopEvents.find(
    (event) => event.correlationId === runId || event.payload?.run_id === runId,
  )

  const homeSummary = await buildGrowthHomeWorkspaceSummary({
    admin: boot.admin,
    operatorEmail: "cert@equipify.ai",
    actorUserId: ACTOR_USER_ID,
  })

  const latestLoopSummary = await fetchLatestAvaResearchLoopSummary(boot.admin, organizationId)

  const afterCard =
    refreshedLead != null ? buildRevenueQueueCardProjectionFromLead(refreshedLead) : null

  console.log(
    JSON.stringify(
      {
        phase: "orchestrator_result",
        qa_marker: GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
        duration_ms: durationMs,
        ok: result.ok,
        blocked: result.blocked ?? false,
        block_reason: result.blockReason ?? null,
        transport_blocked: result.transportBlocked,
        human_approval_required: result.humanApprovalRequired,
        outbound_occurred: result.outboundOccurred,
        summary: result.summary,
      },
      null,
      2,
    ),
  )

  console.log(
    JSON.stringify(
      {
        phase: "verification",
        selected_lead_id: leadId,
        research: {
          before_run_id: beforeResearch?.id ?? null,
          after_run_id: afterResearch?.id ?? null,
          research_changed: (beforeResearch?.id ?? null) !== (afterResearch?.id ?? null),
          after_status: afterResearch?.status ?? null,
          after_recommended_action: afterResearch?.recommendedNextAction ?? null,
        },
        qualification: {
          workflow_status: workflowSnapshot?.workflowStatus ?? null,
          qualification_fit_score: workflowSnapshot?.qualification?.fitScore ?? null,
          qualification_reason: workflowSnapshot?.qualification?.reason ?? null,
          lead_outcome: leadResult?.outcome ?? null,
          lead_skip_reason: leadResult?.skipReason ?? null,
        },
        ai_os_event: {
          event_type: GROWTH_AVA_RESEARCH_LOOP_COMPLETED_EVENT,
          event_found: Boolean(latestLoopEvent),
          event_id: latestLoopEvent?.id ?? null,
          correlation_id: latestLoopEvent?.correlationId ?? null,
        },
        ava_console: {
          research_loop_summary_present: homeSummary.avaConsole.researchLoopSummary != null,
          narrative: homeSummary.avaConsole.researchLoopSummary?.narrative ?? null,
          run_id: homeSummary.avaConsole.researchLoopSummary?.runId ?? null,
          matches_latest_fetch: latestLoopSummary?.runId === homeSummary.avaConsole.researchLoopSummary?.runId,
        },
        revenue_queue_card: {
          before: beforeCard
            ? {
                id: beforeCard.id,
                status: beforeCard.status,
                intent_score: beforeCard.intent_score,
                candidate_priority: beforeCard.candidate_priority,
              }
            : null,
          after: afterCard
            ? {
                id: afterCard.id,
                status: afterCard.status,
                intent_score: afterCard.intent_score,
                candidate_priority: afterCard.candidate_priority,
              }
            : null,
          lead_score_before: afterLead?.score ?? null,
          lead_score_after: refreshedLead?.score ?? null,
          next_best_action_after: refreshedLead?.nextBestAction ?? null,
          workflow_health_after: refreshedLead?.workflowHealth ?? null,
        },
        safety: {
          transport_blocked: result.transportBlocked === true,
          human_approval_required: result.humanApprovalRequired === true,
          outbound_occurred: result.outboundOccurred === false,
          summary_flags_match:
            result.summary?.transportBlocked === true &&
            result.summary?.humanApprovalRequired === true &&
            result.summary?.outboundOccurred === false,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
