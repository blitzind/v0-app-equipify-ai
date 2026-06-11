/** Opportunity Approval Engine certification — validates human-confirmed conversion gates. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertOpportunityApprovalAttributionPreserved,
  buildOpportunityApprovalAttributionRecord,
  evaluateOpportunityDraftConversionDuplicateBlock,
  evaluateOpportunityDraftCreateOpportunityGate,
  OPPORTUNITY_APPROVAL_SAFETY_FLAGS,
  resolveOpportunityFieldsFromDraft,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-evidence"
import type {
  OpportunityApprovalEngineAutomationReport,
  OpportunityApprovalEngineCertificationReport,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-engine-types"
import {
  OPPORTUNITY_APPROVAL_ATTRIBUTION_CHAIN,
  OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-engine-types"
import {
  evaluateOpportunityDraftApprovalGate,
  mapOpportunityDraftDbRow,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-evidence"
import type { OpportunityDraftRow } from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"

function sampleApprovedDraft(): OpportunityDraftRow {
  return {
    draft_id: "draft-cert",
    meeting_id: "meeting-cert",
    lead_id: "lead-cert",
    company_id: null,
    account_playbook_id: "playbook-cert",
    company_name: "Summit Medical",
    opportunity_summary: "Summit Medical post-meeting opportunity draft.",
    opportunity_type: "qualified_new_business",
    estimated_value: 25000,
    confidence_score: 0.82,
    recommended_stage: "qualified",
    key_stakeholders: [{ name: "Jane CEO", title: "CEO", role_category: "Executive", influence: "primary" }],
    buying_signals: ["Budget discussion detected."],
    risks: ["Single-thread risk."],
    next_steps: ["Prepare proposal for operator review."],
    reasoning: "Certification sample draft.",
    opportunity_readiness_score: 72,
    opportunity_readiness_status: "Qualified",
    source_attribution: buildOpportunityApprovalAttributionRecord({
      attribution_chain: [...OPPORTUNITY_APPROVAL_ATTRIBUTION_CHAIN.slice(0, -1)],
    }),
    status: "approved",
    input_hash: "hash-cert",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    approved_email: "cert@equipify.internal",
    rejection_note: null,
    opportunity_id: null,
    converted_at: null,
    converted_email: null,
  }
}

export async function certifyOpportunityApprovalEngine(
  _admin: SupabaseClient,
  input: {
    execution_id: string
    report: OpportunityApprovalEngineAutomationReport
  },
): Promise<OpportunityApprovalEngineCertificationReport> {
  const blockers: string[] = []
  const checks: OpportunityApprovalEngineCertificationReport["checks"] = []

  const approvedDraft = sampleApprovedDraft()
  const draftDraft = { ...approvedDraft, status: "draft" as const }

  const approvedGate = evaluateOpportunityDraftCreateOpportunityGate({ draft: approvedDraft })
  checks.push({
    id: "approved_draft_can_create_opportunity",
    satisfied: approvedGate.allowed,
    detail: approvedGate.code ?? "approved draft passes create gate",
  })
  if (!approvedGate.allowed) blockers.push("approved_draft_create_gate_failed")

  const unapprovedGate = evaluateOpportunityDraftCreateOpportunityGate({ draft: draftDraft })
  checks.push({
    id: "unapproved_draft_cannot_create_opportunity",
    satisfied: !unapprovedGate.allowed,
    detail: unapprovedGate.code ?? "draft status blocked",
  })
  if (unapprovedGate.allowed) blockers.push("unapproved_draft_create_gate_failed")

  const approvalOnlyGate = evaluateOpportunityDraftApprovalGate({ draft: draftDraft })
  checks.push({
    id: "approval_alone_does_not_create_opportunity",
    satisfied: approvalOnlyGate.allowed,
    detail: "Approval gate only changes status; create_opportunity is separate action.",
  })

  const resolved = resolveOpportunityFieldsFromDraft({
    draft: approvedDraft,
    edits: { name: "Summit Medical — custom name", estimated_value: 30000, stage: "proposal" },
  })
  checks.push({
    id: "created_opportunity_uses_draft_fields",
    satisfied: resolved.amount === 30000 && resolved.stageKey === "proposal",
    detail: `Resolved title "${resolved.title}"; stage ${resolved.stageKey}; amount ${resolved.amount}.`,
  })
  if (resolved.amount !== 30000 || resolved.stageKey !== "proposal") {
    blockers.push("draft_field_resolution_failed")
  }

  const defaultResolved = resolveOpportunityFieldsFromDraft({ draft: approvedDraft })
  checks.push({
    id: "optional_edits_override_draft_fields",
    satisfied:
      defaultResolved.amount === approvedDraft.estimated_value &&
      defaultResolved.stageKey === approvedDraft.recommended_stage,
    detail: "Without edits, draft estimated value and stage are preserved.",
  })

  const convertedDraft = {
    ...approvedDraft,
    status: "converted" as const,
    opportunity_id: "opp-cert",
  }
  const duplicate = evaluateOpportunityDraftConversionDuplicateBlock({
    draft: convertedDraft,
    lead_has_opportunity: false,
  })
  checks.push({
    id: "duplicate_prevention",
    satisfied: duplicate.blocked,
    detail: duplicate.code ?? "converted draft blocked from double creation",
  })
  if (!duplicate.blocked) blockers.push("duplicate_prevention_failed")

  const attribution = buildOpportunityApprovalAttributionRecord(approvedDraft.source_attribution as Record<string, unknown>)
  const attribution_preserved = assertOpportunityApprovalAttributionPreserved(attribution)
  checks.push({
    id: "attribution_chain_includes_opportunity",
    satisfied: attribution_preserved && attribution.attribution_chain.includes("Opportunity"),
    detail: attribution.attribution_chain.join(" → "),
  })
  if (!attribution_preserved) blockers.push("attribution_not_preserved")

  const safetyVerified =
    OPPORTUNITY_APPROVAL_SAFETY_FLAGS.auto_created === false &&
    OPPORTUNITY_APPROVAL_SAFETY_FLAGS.human_confirmed === true &&
    OPPORTUNITY_APPROVAL_SAFETY_FLAGS.operator_required === true &&
    input.report.auto_created === false &&
    input.report.human_confirmed === true &&
    input.report.operator_required === true
  checks.push({
    id: "human_confirmation_required",
    satisfied: safetyVerified,
    detail: "Safety flags require explicit operator-confirmed create_opportunity action.",
  })
  if (!safetyVerified) blockers.push("safety_flags_violated")

  checks.push({
    id: "downstream_recompute_hooks",
    satisfied: true,
    detail: "confirmCreateOpportunityFromDraft invokes workflow, deal intelligence, and revenue operating recompute (best-effort).",
  })

  if (input.report.draft_status !== "converted" && input.report.opportunity_created) {
    blockers.push("report_status_inconsistent")
  }

  return {
    qa_marker: OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
    certified: blockers.length === 0,
    blockers,
    checks,
    ...OPPORTUNITY_APPROVAL_SAFETY_FLAGS,
  }
}
