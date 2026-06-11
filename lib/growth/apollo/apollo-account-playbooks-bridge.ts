/** Apollo Account Playbooks bridge — enrollment approval → account playbook (no send). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { runAccountPlaybookEngine } from "@/lib/growth/apollo/apollo-account-playbook-engine"
import {
  buildApolloAccountPlaybookAttributionRecord,
  evaluateApolloAccountPlaybookDuplicateBlock,
  mapApolloAccountPlaybookDbRow,
} from "@/lib/growth/apollo/apollo-account-playbooks-evidence"
import type {
  ApolloAccountPlaybookAutomationActionResult,
  ApolloAccountPlaybookCommitteeMemberInput,
  ApolloAccountPlaybookEnrollmentHandoffInput,
  ApolloAccountPlaybookStatus,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"
import { APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER } from "@/lib/growth/apollo/apollo-account-playbooks-types"

const PLAYBOOKS_TABLE = "account_playbooks"
const MEMBERS_TABLE = "account_playbook_members"

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

function resolveChannelAvailability(input: ApolloAccountPlaybookEnrollmentHandoffInput) {
  return {
    email: Boolean(input.email?.trim()),
    phone: Boolean(input.phone?.trim()),
    sms: Boolean(input.phone?.trim()),
    linkedin: false,
    voice_drop: Boolean(input.phone?.trim()),
  }
}

function extractBuyingCommitteeMembers(
  input: ApolloAccountPlaybookEnrollmentHandoffInput,
): ApolloAccountPlaybookCommitteeMemberInput[] {
  if (input.buying_committee_members?.length) {
    return input.buying_committee_members
  }

  const operatorIntel = input.operator_intelligence ?? {}
  const rawMembers = operatorIntel.buying_committee_members
  if (Array.isArray(rawMembers)) {
    return rawMembers
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null
        const record = entry as Record<string, unknown>
        const full_name = typeof record.full_name === "string" ? record.full_name.trim() : ""
        if (!full_name) return null
        return {
          full_name,
          title: typeof record.title === "string" ? record.title : null,
          email: typeof record.email === "string" ? record.email : null,
          phone: typeof record.phone === "string" ? record.phone : null,
          contactable: record.contactable === true,
          is_decision_maker: record.is_decision_maker === true,
        } satisfies ApolloAccountPlaybookCommitteeMemberInput
      })
      .filter((entry): entry is ApolloAccountPlaybookCommitteeMemberInput => entry !== null)
  }

  if (input.full_name.trim()) {
    return [
      {
        full_name: input.full_name,
        title: input.title,
        email: input.email,
        phone: input.phone,
        contactable: Boolean(input.email || input.phone),
        is_decision_maker: true,
      },
    ]
  }

  return []
}

export async function handoffEnrollmentApprovedToAccountPlaybook(
  admin: SupabaseClient,
  input: ApolloAccountPlaybookEnrollmentHandoffInput,
): Promise<ApolloAccountPlaybookAutomationActionResult> {
  const { data: existing } = await admin
    .schema("growth")
    .from(PLAYBOOKS_TABLE)
    .select("id, status")
    .eq("enrollment_candidate_id", input.enrollment_candidate_id)
    .in("status", ["pending_playbook_approval", "playbook_approved"])
    .limit(1)
    .maybeSingle()

  if (existing) {
    const duplicate = evaluateApolloAccountPlaybookDuplicateBlock({
      existing_status: existing.status as ApolloAccountPlaybookStatus,
    })
    if (duplicate.blocked) {
      return {
        ok: true,
        action: "create_from_enrollment",
        playbook_id: typeof existing.id === "string" ? existing.id : null,
        playbook_ids: typeof existing.id === "string" ? [existing.id] : [],
        status: existing.status as ApolloAccountPlaybookStatus,
        outreach_sent: false,
      }
    }
  }

  const operatorIntel = input.operator_intelligence ?? {}
  const buyingCommitteeMembers = extractBuyingCommitteeMembers(input)
  const channelAvailability = resolveChannelAvailability(input)

  const engineResult = runAccountPlaybookEngine({
    canonical_company_id: input.canonical_company_id ?? input.company_candidate_id,
    company_profile: {
      company_name: input.company_name,
      summary:
        typeof operatorIntel.company_summary === "string" ? operatorIntel.company_summary : null,
      fit_score: input.fit_score,
      research_score: input.research_score,
    },
    buying_committee_members: buyingCommitteeMembers,
    qualification_data: {
      qualification_score: input.qualification_score,
      fit_score: input.fit_score,
      research_score: input.research_score,
      buying_committee_present: buyingCommitteeMembers.length > 0,
      buying_committee_coverage:
        typeof operatorIntel.buying_committee_coverage === "number"
          ? operatorIntel.buying_committee_coverage
          : null,
    },
    channel_availability: channelAvailability,
  })

  const sourceAttribution = buildApolloAccountPlaybookAttributionRecord(input.source_attribution)
  const now = new Date().toISOString()

  const { data, error } = await admin
    .schema("growth")
    .from(PLAYBOOKS_TABLE)
    .insert({
      enrollment_candidate_id: input.enrollment_candidate_id,
      company_candidate_id: input.company_candidate_id,
      canonical_company_id: input.canonical_company_id,
      company_contact_id: input.company_contact_id,
      contact_candidate_id: input.contact_candidate_id,
      growth_lead_id: input.growth_lead_id,
      status: "pending_playbook_approval",
      company_name: input.company_name,
      playbook_key: engineResult.playbook_key,
      committee_strategy: engineResult.committee_strategy,
      recommended_roles: engineResult.recommended_roles,
      recommended_channels: engineResult.recommended_channels,
      committee_role_summary: engineResult.committee_role_summary,
      committee_coverage_score: engineResult.committee_coverage_score,
      coverage_status: engineResult.coverage_status,
      recommended_messaging_theme: engineResult.recommended_messaging_theme,
      recommended_channel_mix: engineResult.recommended_channel_mix,
      confidence_score: engineResult.confidence_score,
      reasoning: engineResult.reasoning,
      qualification_snapshot: {
        qualification_score: input.qualification_score,
        fit_score: input.fit_score,
        research_score: input.research_score,
      },
      company_profile_snapshot: {
        company_name: input.company_name,
        fit_score: input.fit_score,
        research_score: input.research_score,
      },
      channel_availability: channelAvailability,
      source_attribution: sourceAttribution,
      outreach_sent: false,
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
        enrollment_handoff_at: now,
      },
    })
    .select("*")
    .single()

  if (error || !data) {
    return emptyResult("create_from_enrollment", error?.message ?? "account_playbook_insert_failed")
  }

  const playbookId = typeof data.id === "string" ? data.id : null
  if (playbookId && engineResult.committee_role_summary.length > 0) {
    const memberRows = engineResult.committee_role_summary.map((member) => ({
      account_playbook_id: playbookId,
      full_name: member.full_name,
      title: member.title,
      role_category: member.role_category,
      recommended_messaging_theme: member.recommended_messaging_theme,
      recommended_channel_mix: member.recommended_channel_mix,
      contactable: member.contactable,
      is_decision_maker:
        member.role_category === "Executive" || member.role_category === "Financial",
      metadata: { qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER },
    }))

    await admin.schema("growth").from(MEMBERS_TABLE).insert(memberRows)
  }

  logGrowthEngine("apollo_account_playbook_created", {
    playbook_id: playbookId,
    enrollment_candidate_id: input.enrollment_candidate_id,
    playbook_key: engineResult.playbook_key,
    coverage_status: engineResult.coverage_status,
    committee_coverage_score: engineResult.committee_coverage_score,
  })

  return {
    ok: true,
    action: "create_from_enrollment",
    playbook_id: playbookId,
    playbook_ids: playbookId ? [playbookId] : [],
    status: "pending_playbook_approval",
    outreach_sent: false,
  }
}

export async function regenerateApolloAccountPlaybookIntelligence(
  admin: SupabaseClient,
  input: ApolloAccountPlaybookEnrollmentHandoffInput & { account_playbook_id: string },
): Promise<ApolloAccountPlaybookAutomationActionResult> {
  const buyingCommitteeMembers = extractBuyingCommitteeMembers(input)
  const channelAvailability = resolveChannelAvailability(input)
  const operatorIntel = input.operator_intelligence ?? {}

  const engineResult = runAccountPlaybookEngine({
    canonical_company_id: input.canonical_company_id ?? input.company_candidate_id,
    company_profile: {
      company_name: input.company_name,
      summary:
        typeof operatorIntel.company_summary === "string" ? operatorIntel.company_summary : null,
      fit_score: input.fit_score,
      research_score: input.research_score,
    },
    buying_committee_members: buyingCommitteeMembers,
    qualification_data: {
      qualification_score: input.qualification_score,
      fit_score: input.fit_score,
      research_score: input.research_score,
      buying_committee_present: buyingCommitteeMembers.length > 0,
    },
    channel_availability: channelAvailability,
  })

  const now = new Date().toISOString()
  const { error } = await admin
    .schema("growth")
    .from(PLAYBOOKS_TABLE)
    .update({
      playbook_key: engineResult.playbook_key,
      committee_strategy: engineResult.committee_strategy,
      recommended_roles: engineResult.recommended_roles,
      recommended_channels: engineResult.recommended_channels,
      committee_role_summary: engineResult.committee_role_summary,
      committee_coverage_score: engineResult.committee_coverage_score,
      coverage_status: engineResult.coverage_status,
      recommended_messaging_theme: engineResult.recommended_messaging_theme,
      recommended_channel_mix: engineResult.recommended_channel_mix,
      confidence_score: engineResult.confidence_score,
      reasoning: engineResult.reasoning,
      status: "pending_playbook_approval",
      updated_at: now,
      metadata: {
        qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
        intelligence_rerun_at: now,
      },
    })
    .eq("id", input.account_playbook_id)

  if (error) return emptyResult("rerun_playbook", error.message)

  await admin
    .schema("growth")
    .from(MEMBERS_TABLE)
    .delete()
    .eq("account_playbook_id", input.account_playbook_id)

  if (engineResult.committee_role_summary.length > 0) {
    await admin.schema("growth").from(MEMBERS_TABLE).insert(
      engineResult.committee_role_summary.map((member) => ({
        account_playbook_id: input.account_playbook_id,
        full_name: member.full_name,
        title: member.title,
        role_category: member.role_category,
        recommended_messaging_theme: member.recommended_messaging_theme,
        recommended_channel_mix: member.recommended_channel_mix,
        contactable: member.contactable,
        is_decision_maker:
          member.role_category === "Executive" || member.role_category === "Financial",
        metadata: { qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER },
      })),
    )
  }

  return {
    ok: true,
    action: "rerun_playbook",
    playbook_id: input.account_playbook_id,
    playbook_ids: [input.account_playbook_id],
    status: "pending_playbook_approval",
    outreach_sent: false,
  }
}

export { mapApolloAccountPlaybookDbRow }
