import type { DetectedRevenueOpportunitySignal } from "@/lib/growth/revenue-intelligence/opportunity-signal-engine"
import type { GrowthBuyingCommitteeMap } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"

export type CommitteeMemberDraft = {
  label: string
  roleHint: string | null
  evidence: string
}

const ROLE_PATTERNS: Array<{ pattern: RegExp; role: string; label: string }> = [
  { pattern: /\bceo\b/i, role: "executive", label: "CEO" },
  { pattern: /\bcfo\b/i, role: "finance", label: "CFO" },
  { pattern: /\bcto\b/i, role: "technical", label: "CTO" },
  { pattern: /\bvp\b/i, role: "executive", label: "VP" },
  { pattern: /\bdirector\b/i, role: "director", label: "Director" },
  { pattern: /\bprocurement\b/i, role: "procurement", label: "Procurement" },
  { pattern: /\bit\b|\bsecurity\b/i, role: "technical", label: "IT/Security" },
  { pattern: /\boperations\b|\bops\b/i, role: "operations", label: "Operations" },
]

const MISSING_ROLE_SUGGESTIONS: Record<string, string> = {
  executive: "Identify economic buyer or executive sponsor.",
  finance: "Confirm budget owner or finance stakeholder.",
  technical: "Identify technical evaluator or IT/security contact.",
  procurement: "Map procurement or legal review contact.",
  operations: "Confirm operational owner for rollout.",
}

export function buildBuyingCommitteeMap(input: {
  leadId: string
  companyLabel: string
  bodyPreview: string | null | undefined
  signals: DetectedRevenueOpportunitySignal[]
  committeeSignalCount?: number
}): Omit<GrowthBuyingCommitteeMap, "leadId" | "companyLabel"> & { committeeMembers: CommitteeMemberDraft[] } {
  const body = input.bodyPreview?.trim() ?? ""
  const evidence: string[] = []
  const members: CommitteeMemberDraft[] = []
  const rolesFound = new Set<string>()

  for (const rule of ROLE_PATTERNS) {
    const match = body.match(rule.pattern)
    if (!match) continue
    rolesFound.add(rule.role)
    const excerpt = body.slice(Math.max(0, (match.index ?? 0) - 20), Math.min(body.length, (match.index ?? 0) + 60)).trim()
    members.push({ label: rule.label, roleHint: rule.role, evidence: excerpt })
    evidence.push(excerpt)
  }

  if (input.signals.some((s) => s.signalType === "multi_person_engagement")) {
    rolesFound.add("referral")
    members.push({
      label: "Additional stakeholder",
      roleHint: "referral",
      evidence: input.signals.find((s) => s.signalType === "multi_person_engagement")?.excerpt ?? "Multi-person language detected.",
    })
  }

  if (/\brefer\b|\bintroduce\b|\bcolleague\b/i.test(body)) {
    members.push({
      label: "Referred contact",
      roleHint: "referral",
      evidence: body.match(/(?:refer|introduce|colleague)[^.!?]{0,60}/i)?.[0] ?? body.slice(0, 80),
    })
  }

  const uniqueMembers = new Map<string, CommitteeMemberDraft>()
  for (const member of members) {
    uniqueMembers.set(`${member.label}:${member.roleHint ?? ""}`, member)
  }
  const committeeMembers = [...uniqueMembers.values()]

  const stakeholderCount = Math.max(committeeMembers.length, input.committeeSignalCount ?? 0)
  const completenessScore = Math.min(100, Math.round((rolesFound.size / 4) * 100))

  const missingStakeholderSuggestions: string[] = []
  for (const [role, suggestion] of Object.entries(MISSING_ROLE_SUGGESTIONS)) {
    if (!rolesFound.has(role)) missingStakeholderSuggestions.push(suggestion)
  }

  return {
    stakeholderCount,
    completenessScore,
    committeeMembers,
    missingStakeholderSuggestions: missingStakeholderSuggestions.slice(0, 4),
    evidence: evidence.slice(0, 6),
  }
}
