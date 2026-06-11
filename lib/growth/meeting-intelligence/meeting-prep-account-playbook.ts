/** Account-aware meeting prep builders (M1-B). Client-safe. */

import type { ApolloAccountPlaybookCommitteeRoleCategory } from "@/lib/growth/apollo/apollo-account-playbooks-types"
import type { ApolloMeetingBridgeAttributionRecord } from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import type { GrowthReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-types"
import type {
  MeetingPrepAccountPlaybookContext,
  MeetingPrepObjective,
  MeetingPrepOpenRisk,
  MeetingPrepStakeholderFocus,
} from "@/lib/growth/meeting-intelligence/meeting-prep-types"
import { MEETING_PREP_ACCOUNT_PLAYBOOK_QA_MARKER } from "@/lib/growth/meeting-intelligence/meeting-prep-types"

export { MEETING_PREP_ACCOUNT_PLAYBOOK_QA_MARKER } from "@/lib/growth/meeting-intelligence/meeting-prep-types"

const ROLE_FOCUS_AREAS: Record<ApolloAccountPlaybookCommitteeRoleCategory, string[]> = {
  Executive: ["ROI", "strategic priority", "growth outcome"],
  Operations: ["workflow efficiency", "team visibility", "process control"],
  Technical: ["reliability", "integration", "implementation risk"],
  Financial: ["cost control", "margin impact", "budget confidence"],
  "End User": ["daily workflow pain", "ease of use", "adoption"],
  Unknown: ["discovery questions", "authority clarification"],
}

const COVERAGE_RISK_MESSAGES = {
  Weak: "Committee coverage is weak. Confirm additional stakeholders before pushing for a close.",
  Partial:
    "Committee coverage is partial. Identify who owns implementation, budget, and final approval.",
  Strong: "Committee coverage is strong. Align messaging by stakeholder role.",
} as const

export type MeetingPrepAccountPlaybookSource = {
  meeting_candidate_id?: string | null
  account_playbook_id?: string | null
  playbook_key?: string | null
  committee_role_summary?: Array<{
    full_name: string
    title?: string | null
    role_category: ApolloAccountPlaybookCommitteeRoleCategory
    recommended_messaging_theme?: string[]
    recommended_channel_mix?: string[]
    contactable?: boolean
  }>
  committee_coverage_score?: number | null
  committee_strategy?: string | null
  coverage_status?: "Weak" | "Partial" | "Strong" | null
  recommended_messaging_theme?: Record<string, string[]> | null
  recommended_channel_mix?: Record<string, string[]> | null
  confidence_score?: number | null
  reasoning?: string | null
  source_attribution?: ApolloMeetingBridgeAttributionRecord | Record<string, unknown> | null
  qualification_score?: number | null
  meeting_readiness_score?: number | null
  reply_intent?: GrowthReplyIntent | null
}

function normalizeCoverageStatus(
  value: unknown,
  score: number,
): "Weak" | "Partial" | "Strong" {
  if (value === "Weak" || value === "Partial" || value === "Strong") return value
  if (score >= 70) return "Strong"
  if (score >= 45) return "Partial"
  return "Weak"
}

export function buildMeetingPrepRoleCategoryMix(
  committeeRoleSummary: MeetingPrepAccountPlaybookSource["committee_role_summary"],
): Record<string, number> {
  const mix: Record<string, number> = {}
  for (const member of committeeRoleSummary ?? []) {
    mix[member.role_category] = (mix[member.role_category] ?? 0) + 1
  }
  return mix
}

export function buildMeetingPrepStakeholderFocus(
  committeeRoleSummary: NonNullable<MeetingPrepAccountPlaybookSource["committee_role_summary"]>,
  recommendedMessagingTheme?: Record<string, string[]> | null,
  recommendedChannelMix?: Record<string, string[]> | null,
): MeetingPrepStakeholderFocus[] {
  const byRole = new Map<ApolloAccountPlaybookCommitteeRoleCategory, MeetingPrepStakeholderFocus>()

  for (const member of committeeRoleSummary) {
    const existing = byRole.get(member.role_category)
    const messagingThemes =
      member.recommended_messaging_theme ??
      recommendedMessagingTheme?.[member.role_category] ??
      []
    const recommendedChannels =
      member.recommended_channel_mix ?? recommendedChannelMix?.[member.role_category] ?? []

    if (existing) {
      existing.members.push({ fullName: member.full_name, title: member.title ?? null })
      existing.messagingThemes = [...new Set([...existing.messagingThemes, ...messagingThemes])]
      existing.recommendedChannels = [
        ...new Set([...existing.recommendedChannels, ...recommendedChannels]),
      ]
      continue
    }

    byRole.set(member.role_category, {
      roleCategory: member.role_category,
      focusAreas: [...ROLE_FOCUS_AREAS[member.role_category]],
      messagingThemes: [...messagingThemes],
      recommendedChannels: [...recommendedChannels],
      members: [{ fullName: member.full_name, title: member.title ?? null }],
    })
  }

  return [...byRole.values()]
}

export function buildMeetingPrepCommitteeCoverageRisks(input: {
  coverageStatus: "Weak" | "Partial" | "Strong"
  committeeCoverageScore: number
}): MeetingPrepOpenRisk[] {
  const priority =
    input.coverageStatus === "Weak" ? "High" : input.coverageStatus === "Partial" ? "Medium" : "Low"

  return [
    {
      id: `account_playbook_committee_coverage_${input.coverageStatus.toLowerCase()}`,
      label: `Committee coverage ${input.coverageStatus.toLowerCase()}`,
      priority,
      reason: COVERAGE_RISK_MESSAGES[input.coverageStatus],
      source: "account_playbook",
    },
  ]
}

export function buildAccountLevelMeetingObjective(input: {
  playbookKey: string | null
  committeeStrategy: string | null
  qualificationScore?: number | null
  meetingReadinessScore?: number | null
  replyIntent?: GrowthReplyIntent | null
  coverageStatus?: "Weak" | "Partial" | "Strong" | null
}): MeetingPrepObjective | null {
  const replyIntent = input.replyIntent ?? null
  const playbookKey = input.playbookKey ?? ""

  if (replyIntent === "meeting_request" || replyIntent === "demo_request") {
    return {
      objective: "Convert interest into a scheduled demo",
      reasons: ["Reply intent indicates meeting or demo interest"],
      evidence: [replyIntent.replace(/_/g, " ")],
      priority: 96,
    }
  }

  if (replyIntent === "pricing_question") {
    return {
      objective: "Validate budget timing and stakeholder approval path",
      reasons: ["Pricing question detected in reply intelligence"],
      evidence: ["pricing question"],
      priority: 94,
    }
  }

  if (playbookKey === "committee_gap_fill" || input.coverageStatus === "Weak") {
    return {
      objective: "Expand committee coverage before advancing the opportunity",
      reasons: ["Account playbook indicates committee gaps"],
      evidence: [input.committeeStrategy ?? playbookKey ?? "committee gap fill"].filter(Boolean),
      priority: 93,
    }
  }

  if (
    playbookKey === "executive_operations_multichannel" ||
    (input.committeeStrategy ?? "").toLowerCase().includes("executive")
  ) {
    return {
      objective: "Align executive ROI with operations workflow impact",
      reasons: ["Executive + operations playbook strategy"],
      evidence: [playbookKey || "executive operations multichannel"].filter(Boolean),
      priority: 91,
    }
  }

  if (
    (input.qualificationScore ?? 0) >= 60 &&
    (replyIntent === "positive_interest" || (input.meetingReadinessScore ?? 0) >= 65)
  ) {
    return {
      objective: "Confirm operational pain and identify implementation owner",
      reasons: ["Qualification and readiness support operational discovery"],
      evidence: [
        input.qualificationScore != null ? `Qualification ${input.qualificationScore}` : null,
        input.meetingReadinessScore != null ? `Readiness ${input.meetingReadinessScore}` : null,
      ].filter(Boolean) as string[],
      priority: 88,
    }
  }

  if (playbookKey === "technical_evaluation_led") {
    return {
      objective: "Validate technical fit and implementation risk with technical stakeholders",
      reasons: ["Technical evaluation-led account playbook"],
      evidence: [playbookKey],
      priority: 87,
    }
  }

  if (input.committeeStrategy) {
    return {
      objective: "Advance account strategy with role-aligned stakeholder messaging",
      reasons: ["Account playbook committee strategy available"],
      evidence: [input.committeeStrategy.slice(0, 160)],
      priority: 82,
    }
  }

  return null
}

export function buildMeetingPrepAccountPlaybookContext(
  source: MeetingPrepAccountPlaybookSource | null | undefined,
): MeetingPrepAccountPlaybookContext | null {
  if (!source?.account_playbook_id && !(source?.committee_role_summary?.length ?? 0)) {
    return null
  }

  const committeeRoleSummary = source.committee_role_summary ?? []
  const committeeCoverageScore = Math.max(0, source.committee_coverage_score ?? 0)
  const coverageStatus = normalizeCoverageStatus(source.coverage_status, committeeCoverageScore)
  const stakeholderFocus = buildMeetingPrepStakeholderFocus(
    committeeRoleSummary,
    source.recommended_messaging_theme ?? undefined,
    source.recommended_channel_mix ?? undefined,
  )
  const committeeCoverageRisks = buildMeetingPrepCommitteeCoverageRisks({
    coverageStatus,
    committeeCoverageScore,
  })
  const accountLevelObjective = buildAccountLevelMeetingObjective({
    playbookKey: source.playbook_key ?? null,
    committeeStrategy: source.committee_strategy ?? null,
    qualificationScore: source.qualification_score,
    meetingReadinessScore: source.meeting_readiness_score,
    replyIntent: source.reply_intent ?? null,
    coverageStatus,
  })

  const attribution =
    source.source_attribution && typeof source.source_attribution === "object"
      ? (source.source_attribution as ApolloMeetingBridgeAttributionRecord)
      : null

  return {
    qa_marker: MEETING_PREP_ACCOUNT_PLAYBOOK_QA_MARKER,
    available: true,
    meetingCandidateId: source.meeting_candidate_id ?? null,
    accountPlaybookId: source.account_playbook_id ?? null,
    playbookKey: source.playbook_key ?? null,
    committeeRoleSummary: committeeRoleSummary.map((member) => ({
      fullName: member.full_name,
      title: member.title ?? null,
      roleCategory: member.role_category,
      recommendedMessagingTheme: member.recommended_messaging_theme ?? [],
      recommendedChannelMix: member.recommended_channel_mix ?? [],
      contactable: member.contactable ?? false,
    })),
    committeeCoverageScore,
    committeeStrategy: source.committee_strategy ?? "",
    coverageStatus,
    recommendedMessagingTheme: source.recommended_messaging_theme ?? {},
    recommendedChannelMix: source.recommended_channel_mix ?? {},
    roleCategoryMix: buildMeetingPrepRoleCategoryMix(committeeRoleSummary),
    confidenceScore: source.confidence_score ?? null,
    reasoning: source.reasoning ?? null,
    sourceAttribution: attribution,
    stakeholderFocus,
    accountLevelObjective: accountLevelObjective,
    committeeCoverageRisks,
  }
}
