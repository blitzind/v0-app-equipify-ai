/** Load Account Playbook context for meeting prep (M1-B). Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { mapApolloAccountPlaybookDbRow } from "@/lib/growth/apollo/apollo-account-playbooks-evidence"
import { mapApolloMeetingCandidateDbRow } from "@/lib/growth/apollo/apollo-meeting-bridge-evidence"
import type { ApolloMeetingBridgeAttributionRecord } from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import {
  buildMeetingPrepAccountPlaybookContext,
  type MeetingPrepAccountPlaybookSource,
} from "@/lib/growth/meeting-intelligence/meeting-prep-account-playbook"
import type { MeetingPrepAccountPlaybookContext } from "@/lib/growth/meeting-intelligence/meeting-prep-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return null
}

function buildSourceFromPlaybookRow(
  playbook: ReturnType<typeof mapApolloAccountPlaybookDbRow>,
  extras?: Partial<MeetingPrepAccountPlaybookSource>,
): MeetingPrepAccountPlaybookSource {
  return {
    account_playbook_id: playbook.playbook_id,
    playbook_key: playbook.playbook_key,
    committee_role_summary: playbook.committee_role_summary.map((member) => ({
      full_name: member.full_name,
      title: member.title,
      role_category: member.role_category,
      recommended_messaging_theme: member.recommended_messaging_theme,
      recommended_channel_mix: member.recommended_channel_mix,
      contactable: member.contactable,
    })),
    committee_coverage_score: playbook.committee_coverage_score,
    committee_strategy: playbook.committee_strategy,
    coverage_status: playbook.coverage_status,
    recommended_messaging_theme: playbook.recommended_messaging_theme,
    recommended_channel_mix: playbook.recommended_channel_mix,
    confidence_score: playbook.confidence_score,
    reasoning: playbook.reasoning,
    source_attribution: playbook.source_attribution,
    ...extras,
  }
}

function buildSourceFromCandidateRow(
  candidate: ReturnType<typeof mapApolloMeetingCandidateDbRow>,
): MeetingPrepAccountPlaybookSource {
  const qualificationScore =
    typeof candidate.qualification_snapshot.qualification_score === "number"
      ? candidate.qualification_snapshot.qualification_score
      : null

  return {
    meeting_candidate_id: candidate.candidate_id,
    account_playbook_id: candidate.account_playbook_id,
    committee_role_summary: candidate.committee_role_summary.map((member) => ({
      full_name: member.full_name,
      title: member.title,
      role_category: member.role_category,
      recommended_messaging_theme: member.recommended_messaging_theme,
      recommended_channel_mix: member.recommended_channel_mix,
      contactable: member.contactable,
    })),
    committee_coverage_score: candidate.committee_coverage_score,
    committee_strategy: candidate.committee_strategy,
    coverage_status:
      candidate.meeting_readiness_snapshot.committee_coverage_score >= 70
        ? "Strong"
        : candidate.meeting_readiness_snapshot.committee_coverage_score >= 45
          ? "Partial"
          : "Weak",
    recommended_messaging_theme: {},
    recommended_channel_mix: {},
    confidence_score: candidate.confidence_score,
    reasoning: null,
    source_attribution: candidate.source_attribution,
    qualification_score: qualificationScore ?? candidate.meeting_readiness_snapshot.qualification_score,
    meeting_readiness_score: candidate.meeting_readiness_score,
    reply_intent: candidate.meeting_readiness_snapshot.reply_intent,
  }
}

export async function loadMeetingPrepAccountPlaybookContext(
  admin: SupabaseClient,
  meeting: GrowthMeeting,
): Promise<MeetingPrepAccountPlaybookContext | null> {
  let source: MeetingPrepAccountPlaybookSource | null = null

  if (meeting.meetingCandidateId) {
    const { data: candidateRow } = await admin
      .schema("growth")
      .from("meeting_candidates")
      .select("*")
      .eq("id", meeting.meetingCandidateId)
      .maybeSingle()

    if (candidateRow) {
      const candidate = mapApolloMeetingCandidateDbRow(candidateRow as Record<string, unknown>)
      source = buildSourceFromCandidateRow(candidate)

      if (candidate.account_playbook_id) {
        const { data: playbookRow } = await admin
          .schema("growth")
          .from("account_playbooks")
          .select("*")
          .eq("id", candidate.account_playbook_id)
          .maybeSingle()

        if (playbookRow) {
          source = buildSourceFromPlaybookRow(
            mapApolloAccountPlaybookDbRow(playbookRow as Record<string, unknown>),
            {
              meeting_candidate_id: candidate.candidate_id,
              qualification_score: source.qualification_score,
              meeting_readiness_score: source.meeting_readiness_score,
              reply_intent: source.reply_intent,
              source_attribution:
                (meeting.sourceAttribution as ApolloMeetingBridgeAttributionRecord | null) ??
                candidate.source_attribution,
            },
          )
        }
      }
    }
  }

  if (!source && meeting.accountPlaybookId) {
    const { data: playbookRow } = await admin
      .schema("growth")
      .from("account_playbooks")
      .select("*")
      .eq("id", meeting.accountPlaybookId)
      .maybeSingle()

    if (playbookRow) {
      source = buildSourceFromPlaybookRow(
        mapApolloAccountPlaybookDbRow(playbookRow as Record<string, unknown>),
        {
          meeting_candidate_id: meeting.meetingCandidateId,
          source_attribution: meeting.sourceAttribution as ApolloMeetingBridgeAttributionRecord | null,
        },
      )
    }
  }

  if (!source && meeting.outboundReplyId) {
    const { data: candidateRow } = await admin
      .schema("growth")
      .from("meeting_candidates")
      .select("*")
      .eq("outbound_reply_id", meeting.outboundReplyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (candidateRow) {
      source = buildSourceFromCandidateRow(
        mapApolloMeetingCandidateDbRow(candidateRow as Record<string, unknown>),
      )
    }
  }

  if (!source) {
    const { data: candidateRow } = await admin
      .schema("growth")
      .from("meeting_candidates")
      .select("*")
      .eq("growth_meeting_id", meeting.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (candidateRow) {
      source = buildSourceFromCandidateRow(
        mapApolloMeetingCandidateDbRow(candidateRow as Record<string, unknown>),
      )
    }
  }

  if (!source && meeting.sourceAttribution) {
    const attribution = meeting.sourceAttribution as ApolloMeetingBridgeAttributionRecord
    if (attribution.account_playbook_source) {
      source = {
        source_attribution: attribution,
      }
    }
  }

  return buildMeetingPrepAccountPlaybookContext(source)
}

export async function linkMeetingToAccountPlaybookContext(
  admin: SupabaseClient,
  input: {
    meeting_id: string
    meeting_candidate_id: string | null
    account_playbook_id: string | null
    source_attribution: ApolloMeetingBridgeAttributionRecord | Record<string, unknown> | null
  },
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("meetings")
    .update({
      meeting_candidate_id: input.meeting_candidate_id,
      account_playbook_id: input.account_playbook_id,
      source_attribution: input.source_attribution ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.meeting_id)

  if (error) throw new Error(error.message)
}
