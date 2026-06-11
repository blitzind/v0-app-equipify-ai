/** Account Playbook Engine — client-safe account-centric orchestration logic. */

import type {
  ApolloAccountPlaybookChannelAvailability,
  ApolloAccountPlaybookCommitteeMemberInput,
  ApolloAccountPlaybookCommitteeRoleCategory,
  ApolloAccountPlaybookCoverageStatus,
  ApolloAccountPlaybookEngineInput,
  ApolloAccountPlaybookEngineResult,
  ApolloAccountPlaybookMemberRoleSummary,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"

export const APOLLO_ACCOUNT_PLAYBOOK_ENGINE_QA_MARKER = "apollo-account-playbook-engine-v1" as const

const ROLE_MESSAGING_THEMES: Record<ApolloAccountPlaybookCommitteeRoleCategory, string[]> = {
  Executive: ["ROI", "Revenue", "Growth"],
  Operations: ["Efficiency", "Productivity", "Visibility"],
  Technical: ["Reliability", "Integration", "Support"],
  Financial: ["Cost reduction", "Margin improvement"],
  "End User": ["Daily workflow improvement"],
  Unknown: ["Value alignment"],
}

const ROLE_CHANNEL_MIX: Record<ApolloAccountPlaybookCommitteeRoleCategory, string[]> = {
  Executive: ["Email", "LinkedIn"],
  Operations: ["Email", "Call"],
  Technical: ["Email"],
  Financial: ["Email", "Call"],
  "End User": ["SMS", "Email"],
  Unknown: ["Email"],
}

const EXECUTIVE_TITLE_PATTERNS = [
  /\bceo\b/i,
  /\bcfo\b/i,
  /\bcoo\b/i,
  /\bcto\b/i,
  /\bchief\b/i,
  /\bpresident\b/i,
  /\bvp\b/i,
  /\bvice president\b/i,
  /\bdirector\b/i,
  /\bowner\b/i,
  /\bfounder\b/i,
  /\bexecutive\b/i,
]

const OPERATIONS_TITLE_PATTERNS = [
  /\boperations\b/i,
  /\bops\b/i,
  /\bplant manager\b/i,
  /\bfacilities\b/i,
  /\blogistics\b/i,
  /\bsupply chain\b/i,
  /\bprocurement manager\b/i,
]

const TECHNICAL_TITLE_PATTERNS = [
  /\bengineer\b/i,
  /\bengineering\b/i,
  /\btechnical\b/i,
  /\bit director\b/i,
  /\bdeveloper\b/i,
  /\barchitect\b/i,
  /\bbiomedical\b/i,
  /\bclinical engineer\b/i,
  /\bsystems?\b/i,
]

const FINANCIAL_TITLE_PATTERNS = [
  /\bfinance\b/i,
  /\bfinancial\b/i,
  /\baccounting\b/i,
  /\bcontroller\b/i,
  /\btreasurer\b/i,
  /\bbudget\b/i,
]

const END_USER_TITLE_PATTERNS = [
  /\bservice manager\b/i,
  /\btechnician\b/i,
  /\bspecialist\b/i,
  /\bcoordinator\b/i,
  /\bnurse\b/i,
  /\bclinician\b/i,
  /\buser\b/i,
  /\bsupport\b/i,
]

export function classifyCommitteeRoleFromTitle(
  title: string | null | undefined,
): ApolloAccountPlaybookCommitteeRoleCategory {
  const normalized = (title ?? "").trim()
  if (!normalized) return "Unknown"

  if (EXECUTIVE_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))) return "Executive"
  if (FINANCIAL_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))) return "Financial"
  if (OPERATIONS_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))) return "Operations"
  if (TECHNICAL_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))) return "Technical"
  if (END_USER_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))) return "End User"

  return "Unknown"
}

function isContactableMember(member: ApolloAccountPlaybookCommitteeMemberInput): boolean {
  if (member.contactable === true) return true
  if (member.contactable === false) return false
  return Boolean(member.email?.trim() || member.phone?.trim())
}

function buildMemberRoleSummary(
  member: ApolloAccountPlaybookCommitteeMemberInput,
): ApolloAccountPlaybookMemberRoleSummary {
  const role_category = classifyCommitteeRoleFromTitle(member.title)
  return {
    full_name: member.full_name,
    title: member.title,
    role_category,
    recommended_messaging_theme: [...ROLE_MESSAGING_THEMES[role_category]],
    recommended_channel_mix: [...ROLE_CHANNEL_MIX[role_category]],
    contactable: isContactableMember(member),
  }
}

function resolveCoverageStatus(score: number): ApolloAccountPlaybookCoverageStatus {
  if (score >= 70) return "Strong"
  if (score >= 40) return "Partial"
  return "Weak"
}

function computeCommitteeCoverageScore(input: {
  members: ApolloAccountPlaybookMemberRoleSummary[]
  channel_availability: ApolloAccountPlaybookChannelAvailability
}): number {
  if (input.members.length === 0) return 0

  const decisionMakers = input.members.filter(
    (member) => member.role_category === "Executive" || member.role_category === "Financial",
  ).length
  const rolesCovered = new Set(input.members.map((member) => member.role_category)).size
  const contactableCount = input.members.filter((member) => member.contactable).length
  const channelCount = [
    input.channel_availability.email,
    input.channel_availability.phone,
    input.channel_availability.sms,
    input.channel_availability.linkedin,
    input.channel_availability.voice_drop,
  ].filter(Boolean).length

  const decisionMakerScore = Math.min(decisionMakers / 2, 1) * 30
  const roleCoverageScore = Math.min(rolesCovered / 4, 1) * 30
  const contactabilityScore = (contactableCount / input.members.length) * 25
  const channelScore = Math.min(channelCount / 3, 1) * 15

  return Math.round(decisionMakerScore + roleCoverageScore + contactabilityScore + channelScore)
}

function resolvePlaybookKey(input: {
  role_summary: ApolloAccountPlaybookMemberRoleSummary[]
  coverage_status: ApolloAccountPlaybookCoverageStatus
}): string {
  const roles = new Set(input.role_summary.map((member) => member.role_category))
  if (roles.has("Executive") && roles.has("Operations")) return "executive_operations_multichannel"
  if (roles.has("Technical") && !roles.has("Executive")) return "technical_evaluation_led"
  if (input.coverage_status === "Weak") return "committee_gap_fill"
  if (input.role_summary.length <= 1) return "single_thread_risk"
  return "balanced_committee_orchestration"
}

function resolveCommitteeStrategy(input: {
  role_summary: ApolloAccountPlaybookMemberRoleSummary[]
  coverage_status: ApolloAccountPlaybookCoverageStatus
}): string {
  const executivePresent = input.role_summary.some((member) => member.role_category === "Executive")
  const technicalPresent = input.role_summary.some((member) => member.role_category === "Technical")

  if (input.coverage_status === "Strong" && executivePresent && technicalPresent) {
    return "Multi-threaded account approach — engage executive sponsor for business case while technical stakeholders validate fit."
  }
  if (input.coverage_status === "Weak") {
    return "Gap-fill strategy — prioritize identifying missing decision-maker roles before broad outreach."
  }
  if (executivePresent) {
    return "Executive-led entry — lead with ROI messaging, expand to operations and end-user champions."
  }
  return "Committee expansion — anchor on known contacts and map adjacent roles for coverage."
}

function resolveRecommendedChannels(
  channel_availability: ApolloAccountPlaybookChannelAvailability,
): string[] {
  const channels: string[] = []
  if (channel_availability.email) channels.push("Email")
  if (channel_availability.linkedin) channels.push("LinkedIn")
  if (channel_availability.phone || channel_availability.voice_drop) channels.push("Call")
  if (channel_availability.sms) channels.push("SMS")
  return channels.length > 0 ? channels : ["Email"]
}

function buildReasoning(input: {
  company_name: string
  role_summary: ApolloAccountPlaybookMemberRoleSummary[]
  coverage_status: ApolloAccountPlaybookCoverageStatus
  coverage_score: number
  playbook_key: string
}): string {
  const roleLabels = [...new Set(input.role_summary.map((member) => member.role_category))].join(", ")
  return `${input.company_name}: ${input.role_summary.length} committee member(s) classified (${roleLabels || "none"}). Coverage ${input.coverage_status} (${input.coverage_score}/100). Playbook ${input.playbook_key} selected for account-centric orchestration.`
}

export function runAccountPlaybookEngine(
  input: ApolloAccountPlaybookEngineInput,
): ApolloAccountPlaybookEngineResult {
  const committee_role_summary = input.buying_committee_members.map(buildMemberRoleSummary)

  if (committee_role_summary.length === 0 && input.company_profile.company_name) {
    committee_role_summary.push({
      full_name: "Primary contact",
      title: null,
      role_category: "Unknown",
      recommended_messaging_theme: [...ROLE_MESSAGING_THEMES.Unknown],
      recommended_channel_mix: [...ROLE_CHANNEL_MIX.Unknown],
      contactable: input.channel_availability.email || input.channel_availability.phone,
    })
  }

  const committee_coverage_score = computeCommitteeCoverageScore({
    members: committee_role_summary,
    channel_availability: input.channel_availability,
  })
  const coverage_status = resolveCoverageStatus(committee_coverage_score)
  const playbook_key = resolvePlaybookKey({ role_summary: committee_role_summary, coverage_status })
  const committee_strategy = resolveCommitteeStrategy({ role_summary: committee_role_summary, coverage_status })
  const recommended_roles = [
    ...new Set(committee_role_summary.map((member) => member.role_category)),
  ] as ApolloAccountPlaybookCommitteeRoleCategory[]
  const recommended_channels = resolveRecommendedChannels(input.channel_availability)

  const qualificationBoost =
    (input.qualification_data.qualification_score ?? 0) / 100 * 0.15 +
    (input.qualification_data.buying_committee_coverage ?? 0) * 0.1
  const confidence_score = Math.min(
    0.95,
    Math.round((committee_coverage_score / 100) * 0.75 * 100 + qualificationBoost * 100) / 100,
  )

  return {
    playbook_key,
    committee_strategy,
    recommended_roles,
    recommended_channels,
    committee_role_summary,
    committee_coverage_score,
    coverage_status,
    recommended_messaging_theme: { ...ROLE_MESSAGING_THEMES },
    recommended_channel_mix: { ...ROLE_CHANNEL_MIX },
    confidence_score,
    reasoning: buildReasoning({
      company_name: input.company_profile.company_name,
      role_summary: committee_role_summary,
      coverage_status,
      coverage_score: committee_coverage_score,
      playbook_key,
    }),
  }
}
