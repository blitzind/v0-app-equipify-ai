/**
 * GE-SIMPLIFY-1F — Build operator workspace payload directly from canonical growth.leads.
 * Decision authority: GrowthAiOsRuntimeContext.getDecision() (Runtime Context 1A).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import { fetchIntentPixelSite, fetchVisitHistory } from "@/lib/growth/intent-pixel/intent-pixel-repository"
import type { GrowthIntentPixelVisitHistory } from "@/lib/growth/intent-pixel/intent-pixel-types"
import type { RevenueQueueRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import {
  loadOperatorHandoffFromGrowthLead,
} from "@/lib/growth/operator-handoff/operator-handoff-repository"
import { computeOperatorHandoffPriorityHints } from "@/lib/growth/operator-handoff/operator-handoff-priority"
import type { GrowthOperatorHandoffInput, GrowthOperatorHandoffOutput } from "@/lib/growth/operator-handoff/operator-handoff-types"
import { extractLeadEngineOutputsFromRun } from "@/lib/growth/lead-operator-workspace/lead-engine-run-extract"
import { loadBuyingStageAssessmentsForRevenueQueue } from "@/lib/growth/buying-stage/buying-stage-repository"
import { loadCompanyIdentificationMatchesForRevenueQueue } from "@/lib/growth/company-identification/company-identification-repository"
import { loadSearchIntentSignalsForRevenueQueue } from "@/lib/growth/search-intent/search-intent-repository"
import {
  GROWTH_LEAD_ENGINE_RUN_METADATA_KEY,
  GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
  type RevenueQueueRowPublic,
  type GrowthLeadOperatorAttributionCard,
  type GrowthLeadOperatorBuyingStageSummary,
  type GrowthLeadOperatorCompanyMatchSummary,
  type GrowthLeadOperatorEvidenceCard,
  type GrowthLeadOperatorHistoryEntry,
  type GrowthLeadOperatorOverview,
  type GrowthLeadOperatorSearchIntentSummary,
  type GrowthLeadOperatorWorkspacePayload,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { buildRevenueQueueCardProjectionFromLead } from "@/lib/growth/revenue-queue/revenue-queue-card-projection"
import {
  deriveCandidateConfidenceFromLead,
  deriveHumanReviewRequiredFromLead,
  deriveIntentScoreFromLead,
  domainFromWebsite,
  mapLeadStatusToInboxQueueStatus,
  mapResearchPriorityToInboxPriority,
  mapWorkflowHealthToPipelineStatus,
  readLeadMetadataSummary,
} from "@/lib/growth/revenue-queue/revenue-queue-inbox-display-map"
import type { GrowthLead } from "@/lib/growth/types"
import { projectGrowthCanonicalOperatorDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import { projectCanonicalLeadOpportunityNarrative } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { buildCanonicalOperatorAccountNarrative } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-account-narrative-1a"
import { buildCanonicalMission } from "@/lib/growth/aios/missions/growth-canonical-mission-1a"
import { resolveCanonicalHumanMemoryForLead } from "@/lib/growth/lead-memory/resolve-canonical-human-memory-for-lead"
import {
  createGrowthAiOsRuntimeContext,
  type GrowthAiOsRuntimeContext,
} from "@/lib/growth/aios/runtime/growth-aios-runtime-context-1a"
import { resolveGrowthEngineWorkspaceOrganizationId } from "@/lib/growth/growth-engine-workspace-organization"

function isPipelineRun(value: unknown): value is GrowthLeadEnginePipelineRun {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return Array.isArray(row.stage_results) && typeof row.run_id === "string"
}

function asEvidenceCards(
  items: Array<{ claim?: string; evidence?: string; source?: string; confidence?: number }>,
): GrowthLeadOperatorEvidenceCard[] {
  return items
    .map((item) => ({
      claim: String(item.claim ?? "").trim(),
      evidence: String(item.evidence ?? "").trim(),
      source: String(item.source ?? "").trim(),
      confidence: typeof item.confidence === "number" ? item.confidence : null,
    }))
    .filter((item) => item.claim && item.evidence)
}

function candidateEvidenceFromLead(lead: GrowthLead): RevenueQueueRow["candidate_evidence"] {
  return Array.isArray(lead.metadata.candidate_evidence)
    ? (lead.metadata.candidate_evidence as RevenueQueueRow["candidate_evidence"])
    : []
}

function candidateAttributionFromLead(lead: GrowthLead): RevenueQueueRow["candidate_attribution"] {
  if (!lead.sourceChannel) return []
  const confidence = deriveCandidateConfidenceFromLead(lead)
  return [
    {
      source: lead.sourceChannel,
      section: "canonical_lead",
      signal: lead.sourceKind,
      evidence: lead.sourceDetail ?? lead.sourceKind,
      confidence,
    },
  ]
}

function intentSiteKeyFromLead(lead: GrowthLead): string {
  return lead.sourceDetail ?? lead.sourceKind
}

function visitorKeyFromLead(lead: GrowthLead): string {
  return typeof lead.metadata.visitor_key === "string" ? lead.metadata.visitor_key : ""
}

function buildOperatorHandoffInputFromGrowthLead(lead: GrowthLead): GrowthOperatorHandoffInput {
  const run = lead.metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  const outputs = isPipelineRun(run) ? extractLeadEngineOutputsFromRun(run) : {}
  const hintContext = {
    intent_score: deriveIntentScoreFromLead(lead),
    candidate_priority: mapResearchPriorityToInboxPriority(
      lead.researchPriority,
    ) as RevenueQueueRow["candidate_priority"],
    metadata: lead.metadata,
  } as RevenueQueueRow
  return {
    leadInbox: hintContext,
    icpTargeting: outputs.icpTargeting ?? "",
    companyDiscovery: outputs.companyDiscovery ?? "",
    decisionMakerHypothesis: outputs.decisionMakerHypothesis ?? "",
    contactResearch: outputs.contactResearch ?? "",
    verificationTriage: outputs.verificationTriage ?? "",
    accountBrief: outputs.accountBrief ?? "",
    outreachPersonalization: outputs.outreachPersonalization ?? "",
    leadScore: outputs.leadScore ?? "",
    humanApproval: outputs.humanApproval ?? "",
    revenueExecution: outputs.revenueExecution ?? "",
    intentHistory: null,
  }
}

/** Public row projection for operator workspace UI — response contract, not an adapter hop. */
export function buildRevenueQueueRowPublicFromGrowthLead(
  lead: GrowthLead,
  contactIdentified: boolean,
): RevenueQueueRowPublic {
  const queueStatus = mapLeadStatusToInboxQueueStatus(lead.status)
  const intentScore = deriveIntentScoreFromLead(lead)
  const candidateConfidence = deriveCandidateConfidenceFromLead(lead)
  const contactIdentifiedFlag =
    contactIdentified ||
    Boolean(lead.contactName?.trim()) ||
    lead.metadata.contact_identified === true

  return {
    id: lead.id,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
    site_key: intentSiteKeyFromLead(lead),
    candidate_type: "identified",
    candidate_priority: mapResearchPriorityToInboxPriority(
      lead.researchPriority,
    ) as RevenueQueueRow["candidate_priority"],
    intent_score: intentScore,
    intent_grade: typeof lead.metadata.intent_grade === "string" ? lead.metadata.intent_grade : "F",
    candidate_confidence: candidateConfidence,
    pipeline_entry: "icp_targeting",
    pipeline_status: mapWorkflowHealthToPipelineStatus(
      lead.workflowHealth,
      queueStatus,
    ) as RevenueQueueRow["pipeline_status"],
    company_name: lead.companyName,
    domain: domainFromWebsite(lead.website),
    contact_name: contactIdentifiedFlag ? lead.contactName : null,
    email: contactIdentifiedFlag ? lead.contactEmail : null,
    phone: contactIdentifiedFlag ? lead.contactPhone : null,
    linkedin_url:
      contactIdentifiedFlag && typeof lead.metadata.linkedin_url === "string"
        ? lead.metadata.linkedin_url
        : null,
    dedupe_hash: lead.externalRef ?? lead.id,
    candidate_reasoning: lead.notes?.trim() ? [lead.notes.trim()] : [],
    candidate_evidence: candidateEvidenceFromLead(lead),
    candidate_attribution: candidateAttributionFromLead(lead),
    session_count:
      typeof lead.metadata.intent_session_count === "number" ? lead.metadata.intent_session_count : 0,
    visit_count:
      typeof lead.metadata.intent_visit_count === "number" ? lead.metadata.intent_visit_count : 0,
    utm_source: lead.sourceChannel ?? "",
    utm_medium: "",
    utm_campaign: lead.sourceCampaign ?? "",
    owner_id: lead.assignedTo,
    status: queueStatus,
    human_review_required: deriveHumanReviewRequiredFromLead(lead, queueStatus),
    lead_engine_run_id: lead.latestResearchRunId,
    intent_session_id:
      typeof lead.metadata.intent_session_id === "string" ? lead.metadata.intent_session_id : "",
    visitor_key: visitorKeyFromLead(lead),
    existing_account_match: {
      matched: Boolean(lead.promotedOrganizationId),
      source: lead.promotedOrganizationId ? "growth.leads" : null,
      ids: lead.promotedOrganizationId ? [lead.promotedOrganizationId] : [],
      evidence: "",
    },
    existing_lead_match: {
      matched: true,
      source: "growth.leads",
      ids: [lead.id],
      evidence: "Canonical revenue queue lead.",
    },
    metadata: {
      ...lead.metadata,
      growth_lead_id: lead.id,
      revenue_queue_source: "canonical",
    },
    contact_identified: contactIdentifiedFlag,
  }
}

function buildOverviewFromLead(
  lead: GrowthLead,
  outputs: ReturnType<typeof extractLeadEngineOutputsFromRun>,
  handoff: GrowthOperatorHandoffOutput | null,
): GrowthLeadOperatorOverview {
  const intentScore = deriveIntentScoreFromLead(lead)
  const intentGrade =
    typeof lead.metadata.intent_grade === "string" ? lead.metadata.intent_grade : "F"
  const brief = outputs.accountBrief
  const verification = outputs.verificationTriage
  const leadScore = outputs.leadScore
  const dm = outputs.decisionMakerHypothesis
  const contacts = outputs.contactResearch

  return {
    executive_summary:
      handoff?.handoff_summary ||
      brief?.company_summary ||
      `${lead.companyName} entered the Revenue Queue with intent grade ${intentGrade}.`,
    pain_points: asEvidenceCards(brief?.pain_points ?? []),
    buying_signals: asEvidenceCards(brief?.buying_signals ?? []),
    growth_signals: asEvidenceCards(brief?.growth_signals ?? []),
    decision_maker_summary:
      brief?.buying_committee_summary ||
      (dm?.recommended_targeting_strategy?.primary_motion
        ? `Targeting motion: ${dm.recommended_targeting_strategy.primary_motion}.`
        : dm?.buying_committee?.primary_targets?.length
          ? `${dm.buying_committee.primary_targets.length} primary role target(s) hypothesized.`
          : "Decision maker hypothesis not yet available."),
    contact_summary:
      brief?.verified_contacts_summary ||
      (contacts?.contact_candidates?.length
        ? `${contacts.contact_candidates.length} contact candidate(s) from research.`
        : "Contact research pending."),
    verification_summary:
      verification?.evidence_summary ||
      (verification?.disposition
        ? `Verification disposition: ${verification.disposition}.`
        : "Verification triage not yet run."),
    lead_score_summary:
      leadScore?.score_explanation ||
      (leadScore?.lead_score != null
        ? `Lead score ${leadScore.lead_score} (${leadScore.priority_level ?? "unknown"} priority).`
        : `Intent score ${intentScore} (grade ${intentGrade}).`),
  }
}

function buildHistoryFromLead(lead: GrowthLead): GrowthLeadOperatorHistoryEntry[] {
  const queueStatus = mapLeadStatusToInboxQueueStatus(lead.status)
  const candidatePriority = mapResearchPriorityToInboxPriority(lead.researchPriority)
  const entries: GrowthLeadOperatorHistoryEntry[] = [
    {
      at: lead.createdAt,
      action: "candidate_created",
      note: `Inbox candidate created (identified, ${candidatePriority} priority).`,
    },
  ]

  if (lead.metadata.promoted_at) {
    entries.push({
      at: String(lead.metadata.promoted_at),
      action: "promoted",
      note: String(lead.metadata.promotion_note ?? "Promoted for pipeline."),
    })
  }

  const handoffPkg = loadOperatorHandoffFromGrowthLead(lead)
  if (handoffPkg) {
    entries.push({
      at: handoffPkg.generated_at,
      action: "operator_handoff",
      note: "Operator guidance package generated.",
    })
  }

  const run = lead.metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  if (isPipelineRun(run)) {
    entries.push({
      at: lead.updatedAt,
      action: "lead_engine_run",
      note: run.execution_summary || "Lead Engine pipeline run stored.",
    })
  }

  if (queueStatus === "archived") {
    entries.push({ at: lead.updatedAt, action: "archived", note: "Lead archived." })
  }
  if (queueStatus === "duplicate") {
    entries.push({
      at: lead.updatedAt,
      action: "duplicate",
      note: String(lead.metadata.duplicate_reason ?? "Marked duplicate."),
    })
  }

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

async function loadIntentActivityFromLead(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<{ history: GrowthIntentPixelVisitHistory | null; identified: boolean }> {
  const siteKey = intentSiteKeyFromLead(lead)
  const visitorKey = visitorKeyFromLead(lead)
  if (!siteKey || !visitorKey) return { history: null, identified: false }

  const site = await fetchIntentPixelSite(admin, siteKey)
  if (!site) return { history: null, identified: false }

  const history = await fetchVisitHistory(admin, site.id, visitorKey, 12)
  const identified = history.sessions.some((s) => s.is_identified)
  return { history, identified }
}

function buildCompanyMatchFromLead(
  lead: GrowthLead,
  topCompany: Awaited<ReturnType<typeof loadCompanyIdentificationMatchesForRevenueQueue>>[number] | null,
): GrowthLeadOperatorCompanyMatchSummary | null {
  if (topCompany) {
    return {
      id: topCompany.id,
      company_name: topCompany.company_name,
      company_domain: topCompany.company_domain,
      matched_source: topCompany.matched_source,
      match_type: topCompany.match_type,
      match_confidence: topCompany.match_confidence,
      match_score: topCompany.match_score,
      evidence: topCompany.evidence,
      is_candidate_match: true,
    }
  }
  const companySummary = readLeadMetadataSummary<{ company_name?: string }>(
    lead.metadata,
    "company_identification_summary",
  )
  if (!companySummary?.company_name) return null
  const raw = lead.metadata.company_identification_summary as Record<string, unknown>
  return {
    id: "metadata",
    company_name: String(raw.company_name),
    company_domain: (raw.company_domain as string) ?? null,
    matched_source: String(raw.matched_source ?? "unknown"),
    match_type: String(raw.match_type ?? "inferred_company"),
    match_confidence: Number(raw.match_confidence ?? 0),
    match_score: Number(raw.match_score ?? 0),
    evidence: "Company identification summary from lead metadata — candidate match only.",
    is_candidate_match: true,
  }
}

function buildBuyingStageFromLead(
  lead: GrowthLead,
  topBuyingStage: Awaited<ReturnType<typeof loadBuyingStageAssessmentsForRevenueQueue>>[number] | null,
): GrowthLeadOperatorBuyingStageSummary | null {
  if (topBuyingStage) {
    return {
      id: topBuyingStage.id,
      detected_stage: topBuyingStage.detected_stage,
      stage_confidence: topBuyingStage.stage_confidence,
      stage_score: topBuyingStage.stage_score,
      evidence: topBuyingStage.evidence,
      signal_count: topBuyingStage.signal_summary.length,
      is_candidate_assessment: true,
    }
  }
  const buyingSummary = readLeadMetadataSummary<{ detected_stage?: string }>(
    lead.metadata,
    "buying_stage_summary",
  )
  if (!buyingSummary?.detected_stage) return null
  const raw = lead.metadata.buying_stage_summary as Record<string, unknown>
  return {
    id: "metadata",
    detected_stage: String(raw.detected_stage),
    stage_confidence: Number(raw.stage_confidence ?? 0),
    stage_score: Number(raw.stage_score ?? 0),
    evidence: "Buying stage summary from lead metadata — candidate assessment only.",
    signal_count: Number(raw.signal_count ?? 0),
    is_candidate_assessment: true,
  }
}

/** Build operator workspace payload directly from canonical growth.leads (GE-SIMPLIFY-1F). */
export async function buildLeadOperatorWorkspacePayloadFromGrowthLead(
  admin: SupabaseClient,
  lead: GrowthLead,
  options?: { organizationId?: string | null; runtimeContext?: GrowthAiOsRuntimeContext },
): Promise<GrowthLeadOperatorWorkspacePayload> {
  const workspaceOrg = resolveGrowthEngineWorkspaceOrganizationId(options?.organizationId)
  const organizationId = workspaceOrg?.organizationId ?? null

  const handoffPkg = loadOperatorHandoffFromGrowthLead(lead)
  const handoff = handoffPkg?.handoff ?? null
  const hints = computeOperatorHandoffPriorityHints(buildOperatorHandoffInputFromGrowthLead(lead))

  const runRaw = lead.metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  const lead_engine_run = isPipelineRun(runRaw) ? runRaw : null
  const outputs = lead_engine_run ? extractLeadEngineOutputsFromRun(lead_engine_run) : {}

  const candidateEvidence = asEvidenceCards(candidateEvidenceFromLead(lead))
  const operatorEvidence = handoff?.operator_evidence?.map((e) => ({
    claim: e.claim,
    evidence: e.evidence,
    source: e.source,
    confidence: e.confidence,
  })) ?? []

  const attribution: GrowthLeadOperatorAttributionCard[] = [
    ...candidateAttributionFromLead(lead).map((a) => ({
      source: a.source,
      section: a.section,
      signal: a.signal,
      evidence: a.evidence,
      confidence: a.confidence,
    })),
    ...(handoff?.operator_attribution ?? []),
  ]

  const runtimeContext =
    options?.runtimeContext ??
    (organizationId
      ? createGrowthAiOsRuntimeContext(admin, {
          organizationId,
          leadId: lead.id,
          boundary: "lead_workspace_load",
          cacheScope: "operator-surface",
          companyName: lead.companyName,
        })
      : null)

  const [
    intentResult,
    searchSignals,
    buyingStageRows,
    companyMatches,
    canonical_decision,
    memoryBundle,
  ] = await Promise.all([
    loadIntentActivityFromLead(admin, lead),
    loadSearchIntentSignalsForRevenueQueue(admin, lead.id, 12),
    loadBuyingStageAssessmentsForRevenueQueue(admin, lead.id, 3),
    loadCompanyIdentificationMatchesForRevenueQueue(admin, lead.id, 5),
    runtimeContext
      ? runtimeContext.getDecision()
      : Promise.resolve(null),
    runtimeContext
      ? runtimeContext.getMemory()
      : organizationId
        ? resolveCanonicalHumanMemoryForLead(admin, {
            organizationId,
            leadId: lead.id,
          }).catch(() => null)
        : Promise.resolve(null),
  ])

  const { history: intentActivity, identified } = intentResult

  const search_intent_signals: GrowthLeadOperatorSearchIntentSummary[] = searchSignals.map((s) => ({
    id: s.id,
    intent_topic: s.intent_topic,
    intent_category: s.intent_category,
    intent_stage: s.intent_stage,
    intent_score: s.intent_score,
    keyword: s.normalized_keyword || s.keyword,
    source_type: s.source_type,
    evidence: s.evidence,
  }))

  const operatorDecision = canonical_decision
    ? projectGrowthCanonicalOperatorDecision({
        decision: canonical_decision.decision,
        freshness: canonical_decision.freshness,
      })
    : null

  const operator_opportunity_narrative = canonical_decision
    ? projectCanonicalLeadOpportunityNarrative({
        leadId: lead.id,
        companyName: lead.companyName,
        decision: operatorDecision,
      })
    : null

  const canonical_mission =
    organizationId && canonical_decision
      ? buildCanonicalMission({
          organizationId,
          leadId: lead.id,
          companyName: lead.companyName,
          contactName: lead.contactName,
          decisionResolution: canonical_decision,
          opportunityNarrative: operator_opportunity_narrative ?? undefined,
          relationshipSummary:
            memoryBundle?.relationship.summary ??
            handoff?.operator_evidence?.[0]?.claim ??
            null,
          conversationSummary: operatorDecision?.whatToDo ?? null,
          memorySummary: memoryBundle?.relationship.summary ?? null,
        })
      : null

  const canonical_account_narrative = buildCanonicalOperatorAccountNarrative({
    leadId: lead.id,
    companyName: lead.companyName,
    memoryBundle,
    decision: operatorDecision,
    opportunityNarrative: operator_opportunity_narrative ?? undefined,
    mission: canonical_mission,
  })

  return {
    qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
    row: buildRevenueQueueRowPublicFromGrowthLead(lead, identified),
    card: buildRevenueQueueCardProjectionFromLead(lead),
    operator_handoff: handoff,
    guidance_hints: hints,
    lead_engine_run,
    intent_activity: intentActivity,
    overview: buildOverviewFromLead(lead, outputs, handoff),
    evidence: {
      items: [...operatorEvidence, ...candidateEvidence],
      attribution,
    },
    history: buildHistoryFromLead(lead),
    search_intent_signals,
    company_match: buildCompanyMatchFromLead(lead, companyMatches[0] ?? null),
    buying_stage: buildBuyingStageFromLead(lead, buyingStageRows[0] ?? null),
    canonical_decision,
    operator_opportunity_narrative,
    canonical_account_narrative,
    canonical_mission,
  }
}
