/** Apollo Account Playbooks queue — server-only actions, no send. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildApolloAccountPlaybookQueueSnapshot,
  evaluateApolloAccountPlaybookApprovalGate,
  mapApolloAccountPlaybookDbRow,
} from "@/lib/growth/apollo/apollo-account-playbooks-evidence"
import {
  APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
  type ApolloAccountPlaybookAutomationActionResult,
  type ApolloAccountPlaybookEngineResult,
  type ApolloAccountPlaybookQueueSnapshot,
  type ApolloAccountPlaybookStatus,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"
import { handoffAccountPlaybookApprovedToVoiceDropPipeline } from "@/lib/growth/apollo/apollo-voice-drop-bridge"
import { regenerateApolloAccountPlaybookIntelligence } from "@/lib/growth/apollo/apollo-account-playbooks-bridge"

export {
  APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
  type ApolloAccountPlaybookQueueSnapshot,
  type ApolloAccountPlaybookAutomationActionResult,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"

const TABLE = "account_playbooks"

function emptyResult(
  action: ApolloAccountPlaybookAutomationActionResult["action"],
  error: string,
): ApolloAccountPlaybookAutomationActionResult {
  return {
    ok: false,
    action,
    playbook_id: null,
    playbook_ids: [],
    status: null,
    error,
    outreach_sent: false,
  }
}

export async function loadApolloAccountPlaybookQueue(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string | null
    enrollment_candidate_id?: string | null
    status?: ApolloAccountPlaybookStatus | "all"
    limit?: number
  },
): Promise<ApolloAccountPlaybookQueueSnapshot> {
  let query = admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 100)

  if (input?.company_candidate_id?.trim()) {
    query = query.eq("company_candidate_id", input.company_candidate_id.trim())
  }
  if (input?.enrollment_candidate_id?.trim()) {
    query = query.eq("enrollment_candidate_id", input.enrollment_candidate_id.trim())
  }

  const status = input?.status ?? "all"
  if (status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const items = ((data ?? []) as Record<string, unknown>[]).map(mapApolloAccountPlaybookDbRow)
  return buildApolloAccountPlaybookQueueSnapshot({ items })
}

export async function approveApolloAccountPlaybook(
  admin: SupabaseClient,
  input: {
    playbook_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloAccountPlaybookAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.playbook_id)
    .maybeSingle()

  if (error) return emptyResult("approve_playbook", error.message)
  if (!data) return emptyResult("approve_playbook", "playbook_not_found")

  const playbook = mapApolloAccountPlaybookDbRow(data as Record<string, unknown>)
  const gate = evaluateApolloAccountPlaybookApprovalGate({ playbook })
  if (!gate.allowed) {
    return emptyResult("approve_playbook", gate.code ?? "approval_blocked")
  }

  const { data: enrollmentRow } = await admin
    .schema("growth")
    .from("apollo_enrollment_candidates")
    .select("*")
    .eq("id", playbook.enrollment_candidate_id)
    .maybeSingle()

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "playbook_approved",
      playbook_approved_at: now,
      playbook_approved_by: input.approver_user_id ?? null,
      playbook_approved_email: input.approver_email ?? null,
      outreach_sent: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
        playbook_approval_note: input.note?.trim() || null,
      },
    })
    .eq("id", input.playbook_id)

  if (updateError) return emptyResult("approve_playbook", updateError.message)

  const enrollment = enrollmentRow as Record<string, unknown> | null
  await handoffAccountPlaybookApprovedToVoiceDropPipeline(admin, {
    account_playbook_id: playbook.playbook_id,
    enrollment_candidate_id: playbook.enrollment_candidate_id,
    company_candidate_id: playbook.company_candidate_id,
    canonical_company_id: playbook.canonical_company_id,
    company_contact_id: playbook.company_contact_id,
    contact_candidate_id: playbook.contact_candidate_id,
    growth_lead_id: playbook.growth_lead_id,
    company_name: playbook.company_name,
    full_name:
      typeof enrollment?.full_name === "string"
        ? enrollment.full_name
        : playbook.committee_role_summary[0]?.full_name ?? "",
    title:
      typeof enrollment?.title === "string"
        ? enrollment.title
        : playbook.committee_role_summary[0]?.title ?? null,
    email: typeof enrollment?.email === "string" ? enrollment.email : null,
    phone: typeof enrollment?.phone === "string" ? enrollment.phone : null,
    qualification_score:
      typeof enrollment?.qualification_score === "number" ? enrollment.qualification_score : 0,
    fit_score: typeof enrollment?.fit_score === "number" ? enrollment.fit_score : null,
    research_score: typeof enrollment?.research_score === "number" ? enrollment.research_score : null,
    operator_intelligence:
      enrollment?.operator_intelligence && typeof enrollment.operator_intelligence === "object"
        ? (enrollment.operator_intelligence as Record<string, unknown>)
        : {},
    source_attribution: playbook.source_attribution,
    acquisition_evidence:
      enrollment?.acquisition_evidence && typeof enrollment.acquisition_evidence === "object"
        ? (enrollment.acquisition_evidence as Record<string, unknown>)
        : {},
    playbook_result: {
      playbook_key: playbook.playbook_key,
      committee_strategy: playbook.committee_strategy,
      recommended_roles: playbook.recommended_roles,
      recommended_channels: playbook.recommended_channels,
      committee_role_summary: playbook.committee_role_summary,
      committee_coverage_score: playbook.committee_coverage_score,
      coverage_status: playbook.coverage_status,
      recommended_messaging_theme:
        playbook.recommended_messaging_theme as ApolloAccountPlaybookEngineResult["recommended_messaging_theme"],
      recommended_channel_mix:
        playbook.recommended_channel_mix as ApolloAccountPlaybookEngineResult["recommended_channel_mix"],
      confidence_score: playbook.confidence_score,
      reasoning: playbook.reasoning,
    },
  })

  return {
    ok: true,
    action: "approve_playbook",
    playbook_id: input.playbook_id,
    playbook_ids: [input.playbook_id],
    status: "playbook_approved",
    outreach_sent: false,
  }
}

export async function rejectApolloAccountPlaybook(
  admin: SupabaseClient,
  input: {
    playbook_id: string
    approver_user_id?: string | null
    approver_email?: string | null
    note?: string | null
  },
): Promise<ApolloAccountPlaybookAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("id, status")
    .eq("id", input.playbook_id)
    .maybeSingle()

  if (error) return emptyResult("reject_playbook", error.message)
  if (!data) return emptyResult("reject_playbook", "playbook_not_found")
  if (data.status !== "pending_playbook_approval") {
    return emptyResult("reject_playbook", "invalid_playbook_status")
  }

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "playbook_rejected",
      playbook_approved_by: input.approver_user_id ?? null,
      playbook_approved_email: input.approver_email ?? null,
      playbook_rejection_note: input.note?.trim() || null,
      outreach_sent: false,
      updated_at: now,
      metadata: { qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER },
    })
    .eq("id", input.playbook_id)

  if (updateError) return emptyResult("reject_playbook", updateError.message)

  return {
    ok: true,
    action: "reject_playbook",
    playbook_id: input.playbook_id,
    playbook_ids: [input.playbook_id],
    status: "playbook_rejected",
    outreach_sent: false,
  }
}

export async function rerunApolloAccountPlaybookIntelligence(
  admin: SupabaseClient,
  input: { playbook_id: string },
): Promise<ApolloAccountPlaybookAutomationActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", input.playbook_id)
    .maybeSingle()

  if (error) return emptyResult("rerun_playbook", error.message)
  if (!data) return emptyResult("rerun_playbook", "playbook_not_found")

  const playbook = mapApolloAccountPlaybookDbRow(data as Record<string, unknown>)
  const { data: enrollmentRow } = await admin
    .schema("growth")
    .from("apollo_enrollment_candidates")
    .select("*")
    .eq("id", playbook.enrollment_candidate_id)
    .maybeSingle()

  const enrollment = enrollmentRow as Record<string, unknown> | null
  return regenerateApolloAccountPlaybookIntelligence(admin, {
    account_playbook_id: playbook.playbook_id,
    enrollment_candidate_id: playbook.enrollment_candidate_id,
    company_candidate_id: playbook.company_candidate_id,
    canonical_company_id: playbook.canonical_company_id,
    company_contact_id: playbook.company_contact_id,
    contact_candidate_id: playbook.contact_candidate_id,
    growth_lead_id: playbook.growth_lead_id,
    company_name: playbook.company_name,
    full_name: typeof enrollment?.full_name === "string" ? enrollment.full_name : "",
    title: typeof enrollment?.title === "string" ? enrollment.title : null,
    email: typeof enrollment?.email === "string" ? enrollment.email : null,
    phone: typeof enrollment?.phone === "string" ? enrollment.phone : null,
    qualification_score:
      typeof enrollment?.qualification_score === "number" ? enrollment.qualification_score : 0,
    fit_score: typeof enrollment?.fit_score === "number" ? enrollment.fit_score : null,
    research_score: typeof enrollment?.research_score === "number" ? enrollment.research_score : null,
    operator_intelligence:
      enrollment?.operator_intelligence && typeof enrollment.operator_intelligence === "object"
        ? (enrollment.operator_intelligence as Record<string, unknown>)
        : {},
    source_attribution: playbook.source_attribution as unknown as Record<string, unknown>,
    acquisition_evidence:
      enrollment?.acquisition_evidence && typeof enrollment.acquisition_evidence === "object"
        ? (enrollment.acquisition_evidence as Record<string, unknown>)
        : {},
  })
}
