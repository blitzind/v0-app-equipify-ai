import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import { fetchIntentPixelSite, fetchVisitHistory } from "@/lib/growth/intent-pixel/intent-pixel-repository"
import type { GrowthIntentPixelVisitHistory } from "@/lib/growth/intent-pixel/intent-pixel-types"
import type { RevenueQueueRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import { loadOperatorHandoffFromRevenueQueue } from "@/lib/growth/operator-handoff/operator-handoff-repository"
import { computeOperatorHandoffPriorityHints } from "@/lib/growth/operator-handoff/operator-handoff-priority"
import type { GrowthOperatorHandoffOutput } from "@/lib/growth/operator-handoff/operator-handoff-types"
import {
  buildRevenueQueueCardView,
  buildOperatorHandoffInputFromRow,
} from "@/lib/growth/lead-operator-workspace/lead-inbox-card-view"
import { extractLeadEngineOutputsFromRun } from "@/lib/growth/lead-operator-workspace/lead-engine-run-extract"
import { loadBuyingStageAssessmentsForRevenueQueue } from "@/lib/growth/buying-stage/buying-stage-repository"
import { loadCompanyIdentificationMatchesForRevenueQueue } from "@/lib/growth/company-identification/company-identification-repository"
import { loadSearchIntentSignalsForRevenueQueue } from "@/lib/growth/search-intent/search-intent-repository"
import {
  GROWTH_LEAD_ENGINE_RUN_METADATA_KEY,
  GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
  type RevenueQueueRowPublic,
  type GrowthLeadOperatorAttributionCard,
  type GrowthLeadOperatorEvidenceCard,
  type GrowthLeadOperatorHistoryEntry,
  type GrowthLeadOperatorBuyingStageSummary,
  type GrowthLeadOperatorCompanyMatchSummary,
  type GrowthLeadOperatorOverview,
  type GrowthLeadOperatorWorkspacePayload,
} from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"

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

export function sanitizeLeadInboxRowForPublic(
  row: RevenueQueueRow,
  intentIdentified: boolean,
): RevenueQueueRowPublic {
  const contactIdentified =
    intentIdentified ||
    Boolean(row.contact_name?.trim()) ||
    row.metadata.contact_identified === true

  return {
    ...row,
    contact_identified: contactIdentified,
    email: contactIdentified ? row.email : null,
    phone: contactIdentified ? row.phone : null,
    contact_name: contactIdentified ? row.contact_name : null,
    linkedin_url: contactIdentified ? row.linkedin_url : null,
  }
}

function buildOverview(
  row: RevenueQueueRow,
  outputs: ReturnType<typeof extractLeadEngineOutputsFromRun>,
  handoff: GrowthOperatorHandoffOutput | null,
): GrowthLeadOperatorOverview {
  const brief = outputs.accountBrief
  const verification = outputs.verificationTriage
  const leadScore = outputs.leadScore
  const dm = outputs.decisionMakerHypothesis
  const contacts = outputs.contactResearch

  return {
    executive_summary:
      handoff?.handoff_summary ||
      brief?.company_summary ||
      `${row.company_name} entered the Revenue Queue with intent grade ${row.intent_grade}.`,
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
        : `Intent score ${row.intent_score} (grade ${row.intent_grade}).`),
  }
}

function buildHistory(row: RevenueQueueRow): GrowthLeadOperatorHistoryEntry[] {
  const entries: GrowthLeadOperatorHistoryEntry[] = [
    {
      at: row.created_at,
      action: "candidate_created",
      note: `Inbox candidate created (${row.candidate_type}, ${row.candidate_priority} priority).`,
    },
  ]

  if (row.metadata.promoted_at) {
    entries.push({
      at: String(row.metadata.promoted_at),
      action: "promoted",
      note: String(row.metadata.promotion_note ?? "Promoted for pipeline."),
    })
  }

  const handoffPkg = loadOperatorHandoffFromRevenueQueue(row)
  if (handoffPkg) {
    entries.push({
      at: handoffPkg.generated_at,
      action: "operator_handoff",
      note: "Operator guidance package generated.",
    })
  }

  const run = row.metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  if (isPipelineRun(run)) {
    entries.push({
      at: row.updated_at,
      action: "lead_engine_run",
      note: run.execution_summary || "Lead Engine pipeline run stored.",
    })
  }

  if (row.status === "archived") {
    entries.push({ at: row.updated_at, action: "archived", note: "Lead archived." })
  }
  if (row.status === "duplicate") {
    entries.push({
      at: row.updated_at,
      action: "duplicate",
      note: String(row.metadata.duplicate_reason ?? "Marked duplicate."),
    })
  }

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

async function loadIntentActivity(
  admin: SupabaseClient,
  row: RevenueQueueRow,
): Promise<{ history: GrowthIntentPixelVisitHistory | null; identified: boolean }> {
  if (!row.site_key || !row.visitor_key) return { history: null, identified: false }

  const site = await fetchIntentPixelSite(admin, row.site_key)
  if (!site) return { history: null, identified: false }

  const history = await fetchVisitHistory(admin, site.id, row.visitor_key, 12)
  const identified = history.sessions.some((s) => s.is_identified)
  return { history, identified }
}

/** @deprecated Use buildLeadOperatorWorkspacePayloadFromGrowthLead (GE-SIMPLIFY-1F). */
export async function buildLeadOperatorWorkspacePayload(
  admin: SupabaseClient,
  row: RevenueQueueRow,
): Promise<GrowthLeadOperatorWorkspacePayload> {
  const { history: intentActivity, identified } = await loadIntentActivity(admin, row)
  const handoffPkg = loadOperatorHandoffFromRevenueQueue(row)
  const handoff = handoffPkg?.handoff ?? null
  const hints = computeOperatorHandoffPriorityHints(buildOperatorHandoffInputFromRow(row))

  const runRaw = row.metadata[GROWTH_LEAD_ENGINE_RUN_METADATA_KEY]
  const lead_engine_run = isPipelineRun(runRaw) ? runRaw : null
  const outputs = lead_engine_run ? extractLeadEngineOutputsFromRun(lead_engine_run) : {}

  const candidateEvidence = asEvidenceCards(row.candidate_evidence)
  const operatorEvidence = handoff?.operator_evidence?.map((e) => ({
    claim: e.claim,
    evidence: e.evidence,
    source: e.source,
    confidence: e.confidence,
  })) ?? []

  const attribution: GrowthLeadOperatorAttributionCard[] = [
    ...row.candidate_attribution.map((a) => ({
      source: a.source,
      section: a.section,
      signal: a.signal,
      evidence: a.evidence,
      confidence: a.confidence,
    })),
    ...(handoff?.operator_attribution ?? []),
  ]

  const searchSignals = await loadSearchIntentSignalsForRevenueQueue(admin, row.id, 12)
  const buyingStageRows = await loadBuyingStageAssessmentsForRevenueQueue(admin, row.id, 3)
  const companyMatches = await loadCompanyIdentificationMatchesForRevenueQueue(admin, row.id, 5)
  const topCompany = companyMatches[0] ?? null
  const company_match: GrowthLeadOperatorCompanyMatchSummary | null = topCompany
    ? {
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
    : (row.metadata?.company_identification_summary as { company_name?: string } | undefined)?.company_name
      ? {
          id: "metadata",
          company_name: String(
            (row.metadata.company_identification_summary as Record<string, unknown>).company_name,
          ),
          company_domain:
            ((row.metadata.company_identification_summary as Record<string, unknown>)
              .company_domain as string) ?? null,
          matched_source: String(
            (row.metadata.company_identification_summary as Record<string, unknown>).matched_source ??
              "unknown",
          ),
          match_type: String(
            (row.metadata.company_identification_summary as Record<string, unknown>).match_type ??
              "inferred_company",
          ),
          match_confidence: Number(
            (row.metadata.company_identification_summary as Record<string, unknown>)
              .match_confidence ?? 0,
          ),
          match_score: Number(
            (row.metadata.company_identification_summary as Record<string, unknown>).match_score ?? 0,
          ),
          evidence: "Company identification summary from inbox metadata — candidate match only.",
          is_candidate_match: true,
        }
      : null
  const topBuyingStage = buyingStageRows[0] ?? null
  const buying_stage: GrowthLeadOperatorBuyingStageSummary | null = topBuyingStage
    ? {
        id: topBuyingStage.id,
        detected_stage: topBuyingStage.detected_stage,
        stage_confidence: topBuyingStage.stage_confidence,
        stage_score: topBuyingStage.stage_score,
        evidence: topBuyingStage.evidence,
        signal_count: topBuyingStage.signal_summary.length,
        is_candidate_assessment: true,
      }
    : (row.metadata?.buying_stage_summary as { detected_stage?: string } | undefined)?.detected_stage
      ? {
          id: "metadata",
          detected_stage: String(
            (row.metadata.buying_stage_summary as Record<string, unknown>).detected_stage,
          ),
          stage_confidence: Number(
            (row.metadata.buying_stage_summary as Record<string, unknown>).stage_confidence ?? 0,
          ),
          stage_score: Number(
            (row.metadata.buying_stage_summary as Record<string, unknown>).stage_score ?? 0,
          ),
          evidence: "Buying stage summary from inbox metadata — candidate assessment only.",
          signal_count: Number(
            (row.metadata.buying_stage_summary as Record<string, unknown>).signal_count ?? 0,
          ),
          is_candidate_assessment: true,
        }
      : null

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

  return {
    qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
    row: sanitizeLeadInboxRowForPublic(row, identified),
    card: buildRevenueQueueCardView(row),
    operator_handoff: handoff,
    guidance_hints: hints,
    lead_engine_run,
    intent_activity: intentActivity,
    overview: buildOverview(row, outputs, handoff),
    evidence: {
      items: [...operatorEvidence, ...candidateEvidence],
      attribution,
    },
    history: buildHistory(row),
    search_intent_signals,
    company_match,
    buying_stage,
  }
}

export function buildDeterministicOperatorHandoffFromPipeline(
  row: RevenueQueueRow,
  run: GrowthLeadEnginePipelineRun,
): GrowthOperatorHandoffOutput {
  const input = buildOperatorHandoffInputFromRow({ ...row, metadata: { ...row.metadata, lead_engine_run: run } })
  const hints = computeOperatorHandoffPriorityHints(input)
  const outputs = extractLeadEngineOutputsFromRun(run)

  const operator_evidence = row.candidate_evidence.slice(0, 6).map((e) => ({
    claim: e.claim,
    evidence: e.evidence,
    source: e.source,
    confidence: 0.75,
  }))

  const operator_attribution = row.candidate_attribution.slice(0, 4).map((a) => ({
    source: a.source,
    section: a.section,
    signal: a.signal,
    evidence: a.evidence,
    confidence: a.confidence,
  }))

  if (operator_attribution.length === 0) {
    operator_attribution.push({
      source: "lead_engine",
      section: "pipeline",
      signal: "fixture_run",
      evidence: run.execution_summary || "Lead Engine fixture pipeline completed.",
      confidence: 0.7,
    })
  }

  const verification =
    outputs.verificationTriage && typeof outputs.verificationTriage === "object"
      ? outputs.verificationTriage
      : null

  return {
    handoff_summary: run.execution_summary || `${row.company_name} — Lead Engine run ready for operator review.`,
    why_this_matters:
      outputs.accountBrief?.why_this_account ||
      `Intent score ${row.intent_score} with ${row.candidate_priority} inbox priority.`,
    lead_priority: hints.lead_priority,
    recommended_motion: hints.recommended_motion,
    recommended_owner: hints.recommended_owner,
    recommended_channel: hints.recommended_channel,
    recommended_urgency: hints.recommended_urgency,
    recommended_next_action: hints.recommended_next_action,
    objection_preparation: [],
    missing_information: verification?.human_review_required
      ? [
          {
            claim: "Verification requires human review",
            evidence: verification.evidence_summary || "Verification triage flagged review.",
            source: "verification_triage",
            confidence: 0.8,
          },
        ]
      : [],
    human_notes: [
      "Guidance generated from Lead Engine fixture run — confirm before any outreach.",
      "No outbound copy included; human execution required.",
    ],
    recommended_followup_window: hints.recommended_followup_window,
    talking_point_summary:
      outputs.accountBrief?.recommended_angle ||
      outputs.accountBrief?.fit_summary ||
      "Review account brief and verification before first touch.",
    operator_confidence: Math.min(run.pipeline_confidence > 1 ? run.pipeline_confidence / 100 : run.pipeline_confidence, 0.85),
    operator_confidence_reasoning: "Deterministic handoff from Lead Engine pipeline outputs (fixture mode).",
    operator_evidence,
    operator_attribution,
    human_review_required: true,
  }
}
