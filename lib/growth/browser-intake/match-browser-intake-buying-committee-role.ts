/** Target buying committee role matching — client-safe. */

import {
  GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_TARGET_ROLES,
  type GrowthBrowserIntakeBuyingCommitteeTargetRole,
} from "@/lib/growth/browser-intake/browser-intake-buying-committee-types"

type RolePattern = {
  role: GrowthBrowserIntakeBuyingCommitteeTargetRole
  patterns: RegExp[]
  baseConfidence: number
}

const ROLE_PATTERNS: RolePattern[] = [
  { role: "CEO", patterns: [/\bceo\b/i, /chief executive/i], baseConfidence: 92 },
  { role: "President", patterns: [/\bpresident\b/i], baseConfidence: 88 },
  { role: "Owner", patterns: [/\bowner\b/i, /\bfounder\b/i, /\bco-founder\b/i], baseConfidence: 90 },
  {
    role: "Director",
    patterns: [/\bdirector\b/i, /\bmanaging director\b/i],
    baseConfidence: 82,
  },
  {
    role: "VP Operations",
    patterns: [/\bvp\b.*\boperations\b/i, /vice president.*operations/i, /\bvp ops\b/i],
    baseConfidence: 86,
  },
  {
    role: "Service Manager",
    patterns: [/\bservice manager\b/i, /\bservice director\b/i],
    baseConfidence: 84,
  },
  {
    role: "Purchasing",
    patterns: [/\bpurchasing\b/i, /\bprocurement\b/i, /\bbuyer\b/i],
    baseConfidence: 80,
  },
  {
    role: "Operations Manager",
    patterns: [/\boperations manager\b/i, /\bops manager\b/i, /\bgeneral manager\b/i],
    baseConfidence: 83,
  },
]

export function matchBrowserIntakeBuyingCommitteeTargetRole(input: {
  job_title?: string | null
  full_name?: string | null
}): { role: GrowthBrowserIntakeBuyingCommitteeTargetRole; confidence: number } | null {
  const blob = `${input.job_title ?? ""} ${input.full_name ?? ""}`.trim()
  if (!blob) return null

  for (const entry of ROLE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(blob))) {
      return { role: entry.role, confidence: entry.baseConfidence }
    }
  }
  return null
}

export function scoreBrowserIntakeBuyingCommitteeCandidate(input: {
  job_title?: string | null
  full_name?: string | null
  sourceConfidence?: number | null
}): { matched_target_role: GrowthBrowserIntakeBuyingCommitteeTargetRole | null; confidence: number } {
  const roleMatch = matchBrowserIntakeBuyingCommitteeTargetRole(input)
  const sourceBoost = Math.round((input.sourceConfidence ?? 0.5) * 20)
  if (!roleMatch) {
    return {
      matched_target_role: null,
      confidence: Math.min(65, 35 + sourceBoost),
    }
  }
  return {
    matched_target_role: roleMatch.role,
    confidence: Math.min(100, roleMatch.confidence + Math.round(sourceBoost / 4)),
  }
}

export function listBrowserIntakeBuyingCommitteeTargetRoles(): GrowthBrowserIntakeBuyingCommitteeTargetRole[] {
  return [...GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_TARGET_ROLES]
}
