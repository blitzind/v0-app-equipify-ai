/** Deterministic committee role classification — evidence patterns only (client-safe). */

import type {
  GrowthBuyingCommitteeIntelligenceRole,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export type CommitteeRolePatternMatch = {
  committee_role: GrowthBuyingCommitteeIntelligenceRole
  pattern_id: string
  matched_span: string
  evidence_text: string
}

type RolePattern = {
  committee_role: GrowthBuyingCommitteeIntelligenceRole
  pattern_id: string
  patterns: RegExp[]
}

const ROLE_PATTERNS: RolePattern[] = [
  {
    committee_role: "executive_sponsor",
    pattern_id: "exec_sponsor_title",
    patterns: [
      /\bceo\b/i,
      /\bchief executive\b/i,
      /\bpresident\b/i,
      /\bowner\b/i,
      /\bfounder\b/i,
      /\bco-founder\b/i,
      /\bcofounder\b/i,
      /\bmanaging partner\b/i,
      /\bprincipal owner\b/i,
      /\bmanaging member\b/i,
    ],
  },
  {
    committee_role: "end_user",
    pattern_id: "operations_manager_title",
    patterns: [
      /\boperations manager\b/i,
      /\bdirector of operations\b/i,
      /\bhead of operations\b/i,
      /\boperations director\b/i,
      /\bvp operations\b/i,
    ],
  },
  {
    committee_role: "end_user",
    pattern_id: "service_manager_title",
    patterns: [
      /\bservice manager\b/i,
      /\bservices manager\b/i,
      /\bfield service manager\b/i,
      /\bservice director\b/i,
    ],
  },
  {
    committee_role: "end_user",
    pattern_id: "biomedical_manager_title",
    patterns: [
      /\bbiomedical manager\b/i,
      /\bbiomed manager\b/i,
      /\bclinical engineering manager\b/i,
      /\bbe manager\b/i,
      /\bbiomedical equipment manager\b/i,
      /\bbiomedical service manager\b/i,
    ],
  },
  {
    committee_role: "technical_buyer",
    pattern_id: "biomedical_technical_buyer_title",
    patterns: [
      /\bbiomedical engineer\b/i,
      /\bclinical engineer\b/i,
      /\bhtm director\b/i,
      /\bhealthcare technology manager\b/i,
    ],
  },
  {
    committee_role: "economic_buyer",
    pattern_id: "economic_buyer_title",
    patterns: [
      /\bcfo\b/i,
      /\bchief financial\b/i,
      /\bfinance director\b/i,
      /\bvp finance\b/i,
      /\bbudget owner\b/i,
    ],
  },
  {
    committee_role: "technical_buyer",
    pattern_id: "technical_buyer_title",
    patterns: [
      /\bcto\b/i,
      /\bchief technology\b/i,
      /\bvp engineering\b/i,
      /\bit director\b/i,
      /\btechnical director\b/i,
      /\bhead of engineering\b/i,
    ],
  },
  {
    committee_role: "procurement",
    pattern_id: "procurement_title",
    patterns: [
      /\bprocurement\b/i,
      /\bpurchasing\b/i,
      /\bstrategic sourcing\b/i,
      /\bsupply chain\b/i,
    ],
  },
  {
    committee_role: "champion",
    pattern_id: "champion_title",
    patterns: [/\bchampion\b/i, /\bproject sponsor\b/i],
  },
  {
    committee_role: "influencer",
    pattern_id: "influencer_title",
    patterns: [/\binfluencer\b/i, /\badvisor\b/i, /\bconsultant\b/i],
  },
  {
    committee_role: "end_user",
    pattern_id: "end_user_title",
    patterns: [
      /\bend user\b/i,
      /\bfield technician\b/i,
      /\bservice technician\b/i,
      /\boperations technician\b/i,
    ],
  },
  {
    committee_role: "blocker_risk_stakeholder",
    pattern_id: "blocker_risk_title",
    patterns: [
      /\bchief legal\b/i,
      /\bgeneral counsel\b/i,
      /\bcompliance officer\b/i,
      /\brisk officer\b/i,
      /\bciso\b/i,
      /\bchief security\b/i,
    ],
  },
]

const CANONICAL_ROLE_MAP: Record<string, GrowthBuyingCommitteeIntelligenceRole> = {
  economic_buyer: "economic_buyer",
  technical_buyer: "technical_buyer",
  champion: "champion",
  owner: "executive_sponsor",
  decision_maker: "executive_sponsor",
  operator: "end_user",
  influencer: "influencer",
  end_user: "end_user",
  executive_sponsor: "executive_sponsor",
  procurement: "procurement",
  blocker_risk_stakeholder: "blocker_risk_stakeholder",
}

export function mapCanonicalEmploymentRoleToCommitteeRole(
  role_type: string,
): GrowthBuyingCommitteeIntelligenceRole | null {
  const key = role_type.trim().toLowerCase()
  if (!key || key === "unknown") return null
  return CANONICAL_ROLE_MAP[key] ?? null
}

export function classifyCommitteeRoleFromJobTitle(input: {
  job_title?: string | null
}): CommitteeRolePatternMatch | null {
  const title = typeof input.job_title === "string" ? input.job_title.trim() : ""
  if (!title) return null

  for (const entry of ROLE_PATTERNS) {
    for (const pattern of entry.patterns) {
      const match = title.match(pattern)
      if (!match || !match[0]) continue
      const matched_span = match[0]
      return {
        committee_role: entry.committee_role,
        pattern_id: entry.pattern_id,
        matched_span,
        evidence_text: `Title pattern ${entry.pattern_id} matched "${matched_span}" in job title: ${title}`,
      }
    }
  }
  return null
}

export function buildNormalizedAssignmentKey(input: {
  company_id: string
  person_id: string
  committee_role: GrowthBuyingCommitteeIntelligenceRole
}): string {
  return `${input.company_id}:${input.person_id}:${input.committee_role}`
}
