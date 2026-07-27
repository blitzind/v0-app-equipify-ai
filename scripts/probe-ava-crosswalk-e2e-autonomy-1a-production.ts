/**
 * AVA-CROSSWALK-E2E-AUTONOMY-1A — Crosswalk Technologies production autonomy probe.
 *
 * Read-only by default. Set AVA_CROSSWALK_E2E_AUTONOMY_1A_EXECUTE=true for one bounded ASL tick.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { listGrowthAiCopilotGenerationsForLead } from "@/lib/growth/ai-copilot-repository"
import { buildGrowthHomeAvaRecommendationOutcomeProjection } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import { evaluateGrowthCanonicalStateConsistencyForLead } from "@/lib/growth/revenue-workflow/growth-canonical-state-consistency-1a"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import {
  buildGrowthLeadAdmissionIntakeFromLead,
  resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import { reconcileExternalDiscoveryPostResearchAdmission } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a"
import { isExternalDiscoveryLeadIntakeSource } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
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
} from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  hasValidMessageApprovalBindingForGeneration,
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import { containsProhibitedAvaOutboundStyleMarkers } from "@/lib/growth/ava-reasoning/ava-outbound-copy-quality-boundary-core"
import { isAvaSupervisedOutboundGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { loadCanonicalOperatorApprovalSnapshotForHome } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader"
import { buildLeadsByIdMap } from "@/lib/growth/home/growth-home-review-queue-1b"
import {
  buildSupervisedAvaHomeOperatorAttention,
  loadSupervisedAvaGenerationsForHome,
} from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"

const CERT_ID = "ava-crosswalk-e2e-autonomy-1a-v1" as const
const COMPANY_QUERY = process.env.AVA_CROSSWALK_COMPANY_QUERY?.trim() || "crosswalk"

async function findLead(admin: SupabaseClient, orgId: string) {
  const baseSelect =
    "id, company_name, website, status, metadata, created_at, updated_at, contact_email, contact_name, latest_research_run_id, last_researched_at, latest_prospect_research_run_id, last_prospect_researched_at, promoted_organization_id"

  const { data: orgScoped, error: orgError } = await admin
    .schema("growth")
    .from("leads")
    .select(baseSelect)
    .eq("promoted_organization_id", orgId)
    .ilike("company_name", `%${COMPANY_QUERY}%`)
    .order("updated_at", { ascending: false })
    .limit(5)
  if (orgError) throw new Error(orgError.message)
  if ((orgScoped ?? []).length > 0) return orgScoped ?? []

  const { data: globalScoped, error: globalError } = await admin
    .schema("growth")
    .from("leads")
    .select(baseSelect)
    .ilike("company_name", `%${COMPANY_QUERY}%`)
    .order("updated_at", { ascending: false })
    .limit(10)
  if (globalError) throw new Error(globalError.message)
  return globalScoped ?? []
}

async function loadDraftFactory(admin: SupabaseClient, orgId: string, leadId: string) {
  const { data } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("*")
    .eq("organization_id", orgId)
    .eq("lead_id", leadId)
    .maybeSingle()
  return data
}

async function loadResearchRuns(admin: SupabaseClient, leadId: string) {
  const { data } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, status, created_at, updated_at, run_kind, error_code, metadata")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(5)
  return data ?? []
}

async function loadProspectResearchRun(admin: SupabaseClient, runId: string) {
  const { data, error } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, status, company_name, created_at, completed_at, failed_reason, research_summary, recommended_next_action, signals, industry_guess, organization_id")
    .eq("id", runId)
    .maybeSingle()
  if (error) return { error: error.message, row: null }
  return { error: null, row: data }
}

async function loadLeadMetadataDeep(admin: SupabaseClient, leadId: string) {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null
  const md = (lead.metadata ?? {}) as Record<string, unknown>
  return {
    admission_state: md.admission_state,
    admission_reasons: md.admission_reasons,
    normalized_source: md.normalized_source,
    pipeline_entry: md.pipeline_entry,
    intakeSiteKey: md.intakeSiteKey,
    intake_site_key: md.intake_site_key,
    candidate_type: md.candidate_type,
    company_source: md.company_source,
    source_lineage: md.source_lineage,
    prospect_search: md.prospect_search,
    operational_keyword_validation: md.operational_keyword_validation,
    research_sufficiency: md.research_sufficiency,
    bounded_research: md.bounded_research,
    investment_propagation: md.investment_propagation_1b_qa_marker,
  }
}
async function loadCompanyIntelligence(admin: SupabaseClient, leadId: string) {
  const { data, error } = await admin
    .schema("growth")
    .from("company_intelligence_records")
    .select("id, status, updated_at, confidence, metadata")
    .eq("lead_id", leadId)
    .order("updated_at", { ascending: false })
    .limit(3)
  if (error) return { error: error.message, rows: [] as Record<string, unknown>[] }
  return { error: null, rows: data ?? [] }
}

async function loadSenderAffinity(admin: SupabaseClient, orgId: string, leadId: string, email: string | null) {
  if (!email) return null
  const { data } = await admin
    .schema("growth")
    .from("outbound_sender_assignments")
    .select("id, sender_account_id, sender_email, assignment_source, status, created_at")
    .eq("organization_id", orgId)
    .eq("lead_id", leadId)
    .eq("contact_email", email.trim().toLowerCase())
    .eq("status", "active")
    .maybeSingle()
  return data
}

async function funnelCounts(admin: SupabaseClient, orgId: string) {
  const { data: leads } = await admin
    .schema("growth")
    .from("leads")
    .select("id, status, metadata, last_researched_at, latest_research_run_id")
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
  const genByLead = new Map<string, typeof gens>()
  for (const gen of gens ?? []) {
    const bucket = genByLead.get(gen.lead_id) ?? []
    bucket.push(gen)
    genByLead.set(gen.lead_id, bucket)
  }

  let discovered = 0
  let admitted = 0
  let needsResearch = 0
  let researchReady = 0
  let generationReady = 0
  let awaitingReview = 0
  let approved = 0
  let sent = 0

  for (const row of leads ?? []) {
    const lead = {
      id: row.id,
      status: row.status,
      metadata: row.metadata as Record<string, unknown>,
      lastResearchedAt: row.last_researched_at,
      latestResearchRunId: row.latest_research_run_id,
    }
    discovered += 1
    const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    if (admission === "admitted" || admission === "qualified") admitted += 1
    if (!lead.lastResearchedAt && !lead.latestResearchRunId) needsResearch += 1
    if (lead.lastResearchedAt && lead.latestResearchRunId) researchReady += 1

    const df = dfByLead.get(row.id)
    if (df?.state === "waiting_for_generation" || df?.state === "research_complete") generationReady += 1

    const leadGens = genByLead.get(row.id) ?? []
    for (const gen of leadGens) {
      const cls = gen.classification as Record<string, unknown> | null
      const supervised = cls?.avaSupervisedOutbound === true
      if (supervised && gen.status === "draft" && !gen.sent_at) awaitingReview += 1
      if (gen.status === "approved" && !gen.sent_at) approved += 1
      if (gen.sent_at) sent += 1
    }
  }

  return { discovered, admitted, needsResearch, researchReady, generationReady, awaitingReview, approved, sent }
}

async function snapshotLead(admin: SupabaseClient, orgId: string, leadId: string) {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) throw new Error("lead_not_found")

  const draftFactory = await loadDraftFactory(admin, orgId, leadId)
  const researchRuns = await loadResearchRuns(admin, leadId)
  const companyIntel = await loadCompanyIntelligence(admin, leadId)
  const generations = await listGrowthAiCopilotGenerationsForLead(admin, leadId, 10)
  const eligibility = evaluateGrowthPortfolioLeadEligibility({ lead, organizationId: orgId })
  const researchReady = shouldAutoQueueLeadResearch(lead)
  const inconsistencies = evaluateGrowthCanonicalStateConsistencyForLead({ lead, organizationId: orgId })
  const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
  const senderAffinity = await loadSenderAffinity(admin, orgId, leadId, lead.contactEmail)
  const prospectRun = lead.latestProspectResearchRunId
    ? await loadProspectResearchRun(admin, lead.latestProspectResearchRunId)
    : null
  const metadataDeep = await loadLeadMetadataDeep(admin, leadId)

  const supervisedGenerations = generations
    .filter((gen) => isAvaSupervisedOutboundGeneration(gen))
    .map((gen) => ({
      id: gen.id,
      status: gen.status,
      createdAt: gen.createdAt,
      subject: gen.generatedSubject,
      primary: (gen.classification as { primary?: string }).primary ?? null,
      hasBinding: hasValidMessageApprovalBindingForGeneration(gen),
      emDash: containsProhibitedAvaOutboundStyleMarkers({
        subject: gen.generatedSubject,
        body: gen.generatedContent,
      }),
      presentation: resolveAvaSupervisedOutboundApprovalPresentation(gen),
    }))

  return {
    leadId: lead.id,
    companyName: lead.companyName,
    domain: lead.website,
    status: lead.status,
    admission,
    contactEmail: lead.contactEmail,
    contactName: lead.contactName,
    portfolioEligibility: eligibility,
    researchReady,
    lastResearchedAt: lead.lastResearchedAt,
    latestResearchRunId: lead.latestResearchRunId,
    lastProspectResearchedAt: lead.lastProspectResearchedAt,
    latestProspectResearchRunId: lead.latestProspectResearchRunId,
    draftFactory,
    researchRuns,
    prospectRun,
    metadataDeep,
    companyIntel,
    inconsistencies: inconsistencies.map((row) => row.kind),
    senderAffinity,
    supervisedGenerations,
    metadataKeys: Object.keys(lead.metadata ?? {}).slice(0, 30),
  }
}

function runWorkManagerFromSnapshot(snapshot: NonNullable<Awaited<ReturnType<typeof buildGrowthAutonomousPortfolioWorkSnapshot>>>) {
  return runWorkManager({
    ...snapshot.workManagerInput,
    organizationId: snapshot.workManagerInput.organizationId,
    portfolioLeads: snapshot.portfolioLeads,
  })
}

async function maybeReconcileMissedPostResearchAdmission(input: {
  admin: SupabaseClient
  orgId: string
  leadId: string
  generatedAt: string
}) {
  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) throw new Error("lead_not_found_for_reconcile")

  const metadata = (lead.metadata ?? {}) as Record<string, unknown>
  const intake = buildGrowthLeadAdmissionIntakeFromLead({
    id: lead.id,
    company_name: lead.companyName,
    contact_name: lead.contactName,
    contact_email: lead.contactEmail,
    website: lead.website,
    status: lead.status,
    metadata,
    industry: lead.industry,
  })
  const admissionReasons = Array.isArray(metadata.admission_reasons)
    ? metadata.admission_reasons.filter((value): value is string => typeof value === "string")
    : []
  const needsReconcile =
    lead.latestProspectResearchRunId != null &&
    resolveLeadAdmissionStateFromMetadata(metadata) === "review" &&
    admissionReasons.includes("pending_operational_keyword_validation") &&
    isExternalDiscoveryLeadIntakeSource(intake.source)

  if (!needsReconcile) {
    return {
      attempted: false,
      reason: "not_eligible_for_missed_post_research_reconcile",
      intakeSource: intake.source,
    }
  }

  const { data: runRow, error: runError } = await input.admin
    .schema("growth")
    .from("research_runs")
    .select(
      "id, status, research_summary, suggested_pitch_angle, suggested_sequence, suggested_call_opening, recommended_next_action, industry_guess, detected_technologies, signals",
    )
    .eq("id", lead.latestProspectResearchRunId)
    .maybeSingle()
  if (runError) throw new Error(runError.message)
  if (!runRow || runRow.status !== "completed") {
    return {
      attempted: false,
      reason: "prospect_research_run_missing_or_incomplete",
      intakeSource: intake.source,
    }
  }

  const admissionContext = await loadGrowthLeadAdmissionContext(input.admin, input.orgId)
  const evidenceBundle =
    (runRow.signals?.companyEvidence_v22 as GrowthCompanyEvidenceBundle | undefined) ?? null

  const reconciliation = await reconcileExternalDiscoveryPostResearchAdmission({
    admin: input.admin,
    lead,
    organizationId: input.orgId,
    admissionContext,
    evidenceBundle,
    generatedAt: input.generatedAt,
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

  return {
    attempted: true,
    intakeSource: intake.source,
    reconciliation,
  }
}

async function main() {
  console.log(`[${CERT_ID}] Crosswalk autonomy probe`)
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")

  const admin = cert.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const generatedAt = new Date().toISOString()
  const execute = process.env.AVA_CROSSWALK_E2E_AUTONOMY_1A_EXECUTE === "true"

  const matches = await findLead(admin, orgId)
  const primary = matches[0]
  if (!primary) throw new Error(`No lead matching ${COMPANY_QUERY}`)

  const leadForIntake = await fetchGrowthLeadById(admin, primary.id)
  const leadMetadata = (leadForIntake?.metadata ?? {}) as Record<string, unknown>
  const resolvedIntakeSource = resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata(leadMetadata)
  const intakeSourceDiagnostics = {
    unified_intake_source: leadMetadata.unified_intake_source ?? null,
    normalized_source: leadMetadata.normalized_source ?? null,
    intake_site_key: leadMetadata.intake_site_key ?? leadMetadata.intakeSiteKey ?? null,
    source_lineage_intake_source:
      leadMetadata.source_lineage &&
      typeof leadMetadata.source_lineage === "object" &&
      "intake_source" in leadMetadata.source_lineage
        ? (leadMetadata.source_lineage as { intake_source?: unknown }).intake_source ?? null
        : null,
    resolvedIntakeSource,
    externalDiscovery: isExternalDiscoveryLeadIntakeSource(resolvedIntakeSource),
  }

  const before = await snapshotLead(admin, orgId, primary.id)

  let missedReconcileResult: Awaited<ReturnType<typeof maybeReconcileMissedPostResearchAdmission>> | null =
    null
  if (execute) {
    missedReconcileResult = await maybeReconcileMissedPostResearchAdmission({
      admin,
      orgId,
      leadId: primary.id,
      generatedAt,
    })
  }

  const snapshot = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
    organizationId: orgId,
    generatedAt,
  })
  if (!snapshot) throw new Error("portfolio_snapshot_unavailable")

  const draftFactorySignals = await loadDraftFactorySignalCounts(admin, orgId)
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
  const selectedLeadId = aslDryRun.selected_work?.[0]?.lead_id ?? null
  const killSwitches = await getRuntimeKillSwitchStates(admin)

  const workResult = snapshot.workManagerInput.workManagerResult ?? runWorkManagerFromSnapshot(snapshot)
  const nextExecutable = workResult ? selectNextExecutableWorkItem(workResult) : null
  const crosswalkWorkItems = (workResult?.all_work_items ?? [])
    .filter((item) => extractLeadIdFromWorkItem(item) === primary.id)
    .map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      status: item.status,
      decisionScore: item.decision_score,
      estimatedMinutes: item.estimated_minutes,
    }))

  const heroTask = snapshot.workManagerInput.workspaceSummary.aiOsUx?.waitingOnYou?.[0] ?? null
  const outcomeProjection = heroTask
    ? buildGrowthHomeAvaRecommendationOutcomeProjection({
        item: {
          kind: "work_manager",
          headline: heroTask.title ?? heroTask.label ?? "",
          title: heroTask.title ?? heroTask.label ?? "",
          companyName: heroTask.companyName ?? before.companyName,
          leadId: heroTask.leadId ?? primary.id,
          supportingLine: heroTask.detail ?? heroTask.supportingLine ?? null,
          detail: heroTask.detail ?? null,
          whyReasons: heroTask.whyReasons ?? [],
          outcomeLine: heroTask.outcomeLine ?? null,
          employeeHeadline: heroTask.employeeHeadline ?? null,
          explanation: heroTask.explanation ?? null,
          executionPathSteps: heroTask.executionPathSteps ?? null,
          expectedOutcomeLabel: heroTask.expectedOutcomeLabel ?? null,
          estimatedEffortLabel: heroTask.estimatedEffortLabel ?? null,
        },
      })
    : null

  let executionResult: Awaited<ReturnType<typeof runAutonomousSalesLoop>> | null = null
  if (execute) {
    executionResult = await runAutonomousSalesLoop({
      admin,
      organizationId: orgId,
      maxIterations: 3,
      dailyBudgetMinutes: 20,
      dryRun: false,
    })
  }

  const after = await snapshotLead(admin, orgId, primary.id)

  const supervisedGens = await loadSupervisedAvaGenerationsForHome(
    admin,
    snapshot.portfolioLeads.map((lead) => lead.id),
  )
  const approvalSnapshot = await loadCanonicalOperatorApprovalSnapshotForHome(admin, { organizationId: orgId })
  const leadsById = buildLeadsByIdMap(snapshot.portfolioLeads)
  const supervisedAttention = buildSupervisedAvaHomeOperatorAttention({
    generations: supervisedGens,
    leadsById,
  })
  const crosswalkOnHome = supervisedAttention.readyForReview.filter(
    (row) => row.leadId === primary.id || /crosswalk/i.test(row.companyName ?? ""),
  )

  const funnel = await funnelCounts(admin, orgId)

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        generatedAt,
        organizationId: orgId,
        companyMatches: matches.map((row) => ({
          id: row.id,
          company: row.company_name,
          domain: row.website,
          status: row.status,
        })),
        crosswalkBefore: before,
        intakeSourceDiagnostics,
        missedPostResearchReconcile: missedReconcileResult,
        homeLabelAuthorities: {
          preparingOutreach: "growth-home-runtime-execution-presentation-1b / executive-briefing-synthesizer when draft_factory or outreach prep mission",
          monitoringAudience: "growth-mission-runtime-orchestrator when audience refresh not due",
          oneBuyingSignalRemains: {
            source: "growth-home-ava-recommendation-outcome-next-1d buildProgressNarrative",
            condition: "research progress percent >= 75 and < 100 (parsed from supportingLine/detail)",
            isRealGate: false,
            note: "Presentation-only milestone language, not a persisted blocking requirement",
          },
          outcomeProjection,
          heroTask,
        },
        autonomousExecution: {
          killSwitches,
          aslDryRun: {
            executed: aslDryRun.executed,
            stopReason: aslDryRun.stop_reason,
            nonExecutionReason: aslDryRun.non_execution_reason,
            selectedWork: aslDryRun.selected_work,
            selectedLeadId,
            selectsCrosswalk: selectedLeadId === primary.id,
          },
          nextExecutableWorkItem: nextExecutable
            ? {
                id: nextExecutable.id,
                title: nextExecutable.title,
                type: nextExecutable.type,
                status: nextExecutable.status,
                leadId: extractLeadIdFromWorkItem(nextExecutable),
              }
            : null,
          crosswalkWorkItems,
          diagnosisSummary: {
            portfolioLeadsEligible: diagnosis.portfolio_leads_eligible,
            executableWorkItems: diagnosis.executable_work_items,
            selectedExecutable: diagnosis.selected_executable,
            nonExecutionReason: diagnosis.non_execution_reason,
            topBlockedReasons: diagnosis.top_blocked_reasons,
          },
          liveExecution: executionResult
            ? {
                executed: executionResult.executed,
                iterations: executionResult.iterations,
                outcomesCompleted: executionResult.outcomes_completed,
                stopReason: executionResult.stop_reason,
                selectedWork: executionResult.selected_work,
              }
            : null,
        },
        crosswalkAfter: after,
        crosswalkOnHomeReviewQueue: crosswalkOnHome,
        supervisedAttentionSummary: {
          readyForReview: supervisedAttention.readyForReview.length,
          needsInformation: supervisedAttention.needsInformation.length,
        },
        approvalSnapshotSummary: {
          packageCount: approvalSnapshot.packages.length,
          pendingApprovalCount: approvalSnapshot.pendingApprovalCount,
        },
        funnel,
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
