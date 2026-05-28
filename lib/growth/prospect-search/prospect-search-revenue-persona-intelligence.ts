/** Revenue persona intelligence — evidence-backed title/role classification. Client-safe. */

export const GROWTH_REVENUE_PERSONA_INTELLIGENCE_QA_MARKER =
  "growth-revenue-persona-intelligence-v1" as const

export const PROSPECT_SEARCH_REVENUE_PERSONA_TYPES = [
  "owner",
  "founder",
  "service_manager",
  "operations_manager",
  "dispatcher",
  "sales_manager",
  "branch_manager",
  "administrator",
  "procurement",
  "technician_lead",
  "decision_maker",
  "operator",
  "unknown",
] as const

export type ProspectSearchRevenuePersonaType =
  (typeof PROSPECT_SEARCH_REVENUE_PERSONA_TYPES)[number]

export type ProspectSearchRevenuePersonaIntelligence = {
  persona_type: ProspectSearchRevenuePersonaType
  persona_label: string
  icp_relevance: number
  buying_influence: number
  outreach_suitability: number
  operational_authority: number
  confidence: number
  evidence: string[]
}

type PersonaRule = {
  type: ProspectSearchRevenuePersonaType
  label: string
  patterns: RegExp[]
  icp_relevance: number
  buying_influence: number
  outreach_suitability: number
  operational_authority: number
}

const PERSONA_RULES: PersonaRule[] = [
  {
    type: "owner",
    label: "Owner",
    patterns: [/\bowner\b/i, /\bfounder\b/i, /\bco-founder\b/i, /\bpresident\b/i, /\bceo\b/i, /\bprincipal\b/i],
    icp_relevance: 0.95,
    buying_influence: 0.98,
    outreach_suitability: 0.85,
    operational_authority: 0.95,
  },
  {
    type: "founder",
    label: "Founder",
    patterns: [/\bfounder\b/i, /\bco-founder\b/i],
    icp_relevance: 0.93,
    buying_influence: 0.96,
    outreach_suitability: 0.84,
    operational_authority: 0.92,
  },
  {
    type: "operations_manager",
    label: "Operations Manager",
    patterns: [
      /\boperations?\s+manager\b/i,
      /\bdirector\s+of\s+operations\b/i,
      /\bops\s+manager\b/i,
      /\bvp\s+operations\b/i,
    ],
    icp_relevance: 0.92,
    buying_influence: 0.88,
    outreach_suitability: 0.9,
    operational_authority: 0.9,
  },
  {
    type: "service_manager",
    label: "Service Manager",
    patterns: [
      /\bservice\s+manager\b/i,
      /\bfield\s+service\s+manager\b/i,
      /\bservice\s+director\b/i,
      /\bcustomer\s+service\s+manager\b/i,
    ],
    icp_relevance: 0.9,
    buying_influence: 0.82,
    outreach_suitability: 0.92,
    operational_authority: 0.85,
  },
  {
    type: "branch_manager",
    label: "Branch Manager",
    patterns: [/\bbranch\s+manager\b/i, /\bgeneral\s+manager\b/i, /\bregional\s+manager\b/i],
    icp_relevance: 0.86,
    buying_influence: 0.8,
    outreach_suitability: 0.88,
    operational_authority: 0.82,
  },
  {
    type: "dispatcher",
    label: "Dispatcher",
    patterns: [/\bdispatch(er|ing)?\b/i, /\bscheduling\s+coordinator\b/i],
    icp_relevance: 0.72,
    buying_influence: 0.55,
    outreach_suitability: 0.78,
    operational_authority: 0.7,
  },
  {
    type: "sales_manager",
    label: "Sales Manager",
    patterns: [/\bsales\s+manager\b/i, /\bbusiness\s+development\b/i, /\bbd\s+manager\b/i],
    icp_relevance: 0.78,
    buying_influence: 0.7,
    outreach_suitability: 0.8,
    operational_authority: 0.65,
  },
  {
    type: "procurement",
    label: "Procurement",
    patterns: [/\bprocurement\b/i, /\bpurchasing\b/i, /\bsourcing\b/i],
    icp_relevance: 0.75,
    buying_influence: 0.85,
    outreach_suitability: 0.7,
    operational_authority: 0.6,
  },
  {
    type: "technician_lead",
    label: "Technician Lead",
    patterns: [/\blead\s+technician\b/i, /\bservice\s+lead\b/i, /\bforeman\b/i, /\bshop\s+foreman\b/i],
    icp_relevance: 0.68,
    buying_influence: 0.45,
    outreach_suitability: 0.72,
    operational_authority: 0.55,
  },
  {
    type: "administrator",
    label: "Administrator",
    patterns: [/\badministrator\b/i, /\boffice\s+manager\b/i, /\badmin\s+assistant\b/i],
    icp_relevance: 0.55,
    buying_influence: 0.35,
    outreach_suitability: 0.65,
    operational_authority: 0.4,
  },
  {
    type: "decision_maker",
    label: "Decision Maker",
    patterns: [/\bdirector\b/i, /\bvp\b/i, /\bvice\s+president\b/i, /\bhead\s+of\b/i],
    icp_relevance: 0.84,
    buying_influence: 0.86,
    outreach_suitability: 0.82,
    operational_authority: 0.8,
  },
]

const CRITICAL_PERSONAS: ProspectSearchRevenuePersonaType[] = [
  "owner",
  "founder",
  "operations_manager",
  "service_manager",
  "branch_manager",
]

export function getCriticalRevenuePersonas(): ProspectSearchRevenuePersonaType[] {
  return [...CRITICAL_PERSONAS]
}

function normalizeBlob(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function resolveProspectSearchRevenuePersona(input: {
  title?: string | null
  role_type?: string | null
  source_label?: string | null
  source_page_url?: string | null
  source_evidence?: Array<{ claim?: string; evidence?: string; source?: string }>
  industry?: string | null
}): ProspectSearchRevenuePersonaIntelligence {
  const evidence: string[] = []
  const title = input.title?.trim() ?? ""
  const roleType = input.role_type?.trim() ?? ""
  const blob = `${title} ${roleType}`.trim()

  if (title) evidence.push(`Title observed: ${title}`)
  if (roleType && roleType !== title) evidence.push(`Role type: ${roleType.replace(/_/g, " ")}`)

  const pageUrl = input.source_page_url?.trim().toLowerCase() ?? ""
  if (pageUrl.includes("team") || pageUrl.includes("leadership") || pageUrl.includes("about")) {
    evidence.push("Listed on leadership/team page")
  }
  if ((input.source_label ?? "").toLowerCase().includes("website")) {
    evidence.push("Website-published contact")
  }
  for (const item of input.source_evidence ?? []) {
    if (item.evidence?.trim()) evidence.push(item.evidence.trim())
    if (evidence.length >= 4) break
  }

  let matched: PersonaRule | null = null
  for (const rule of PERSONA_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(blob))) {
      matched = rule
      break
    }
  }

  if (!matched && roleType) {
    const normalizedRole = normalizeBlob(roleType)
    if (normalizedRole.includes("owner") || normalizedRole.includes("economic")) matched = PERSONA_RULES[0]!
    else if (normalizedRole.includes("operator")) {
      matched = {
        type: "operator",
        label: "Operator",
        patterns: [],
        icp_relevance: 0.62,
        buying_influence: 0.5,
        outreach_suitability: 0.7,
        operational_authority: 0.55,
      }
    } else if (normalizedRole.includes("decision")) {
      matched = PERSONA_RULES.find((r) => r.type === "decision_maker") ?? null
    }
  }

  if (!matched) {
    return {
      persona_type: "unknown",
      persona_label: title || "Unknown role",
      icp_relevance: 0.35,
      buying_influence: 0.3,
      outreach_suitability: 0.4,
      operational_authority: 0.25,
      confidence: title ? 0.45 : 0.2,
      evidence: title ? evidence : [...evidence, "No title evidence for persona classification"],
    }
  }

  const confidence = Math.min(
    0.98,
    0.55 +
      (title ? 0.2 : 0) +
      (evidence.length >= 2 ? 0.12 : 0) +
      (pageUrl ? 0.08 : 0) +
      matched.buying_influence * 0.05,
  )

  evidence.push(`Persona classified as ${matched.label} from observed title/role evidence`)

  return {
    persona_type: matched.type,
    persona_label: matched.label,
    icp_relevance: matched.icp_relevance,
    buying_influence: matched.buying_influence,
    outreach_suitability: matched.outreach_suitability,
    operational_authority: matched.operational_authority,
    confidence: Number(confidence.toFixed(3)),
    evidence: [...new Set(evidence)].slice(0, 6),
  }
}
