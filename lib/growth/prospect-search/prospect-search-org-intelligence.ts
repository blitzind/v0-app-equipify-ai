/** Organizational relationship graph + structure intelligence — evidence-backed. Client-safe. */

import type { ProspectSearchRevenuePersonaType } from "@/lib/growth/prospect-search/prospect-search-revenue-persona-intelligence"

export const GROWTH_ORG_INTELLIGENCE_QA_MARKER = "growth-org-intelligence-v1" as const

export const PROSPECT_SEARCH_RELATIONSHIP_EDGE_TYPES = [
  "operational_relationship",
  "departmental_relationship",
  "probable_buying_influence",
  "communication_routing",
  "same_page_evidence",
  "persona_cluster",
] as const

export type ProspectSearchRelationshipEdgeType =
  (typeof PROSPECT_SEARCH_RELATIONSHIP_EDGE_TYPES)[number]

export type ProspectSearchRelationshipGraphNode = {
  id: string
  kind: "contact" | "department" | "persona_cluster"
  label: string
  contact_id?: string | null
  persona_type?: ProspectSearchRevenuePersonaType | null
  confidence: number
  evidence: string[]
}

export type ProspectSearchRelationshipGraphEdge = {
  id: string
  from_id: string
  to_id: string
  edge_type: ProspectSearchRelationshipEdgeType
  confidence: number
  evidence: string[]
  bidirectional?: boolean
}

export type ProspectSearchRelationshipGraph = {
  qa_marker: typeof GROWTH_ORG_INTELLIGENCE_QA_MARKER
  nodes: ProspectSearchRelationshipGraphNode[]
  edges: ProspectSearchRelationshipGraphEdge[]
}

export type ProspectSearchOrgStructureLabel =
  | "owner_operated"
  | "branch_managed"
  | "operations_heavy"
  | "leadership_identified_ops_missing"
  | "service_focused"
  | "unclear_structure"

export type ProspectSearchOrgIntelligence = {
  qa_marker: typeof GROWTH_ORG_INTELLIGENCE_QA_MARKER
  structure_label: ProspectSearchOrgStructureLabel
  structure_summary: string
  operational_structure_confidence: number
  leadership_coverage: boolean
  operations_coverage: boolean
  service_coverage: boolean
  admin_coverage: boolean
  branch_structure_detected: boolean
  likely_communication_flow: string | null
  missing_department_warnings: string[]
  grouped_contacts_by_persona: Array<{
    persona_type: ProspectSearchRevenuePersonaType
    persona_label: string
    contact_ids: string[]
    contact_names: string[]
  }>
  uncertainty_notes: string[]
  relationship_graph: ProspectSearchRelationshipGraph
}

type OrgContactInput = {
  contact_id: string
  full_name?: string | null
  title?: string | null
  persona_type: ProspectSearchRevenuePersonaType
  persona_label: string
  source_page_url?: string | null
  source_label?: string | null
  persona_evidence?: string[]
}

const LEADERSHIP_PERSONAS = new Set<ProspectSearchRevenuePersonaType>([
  "owner",
  "founder",
  "decision_maker",
  "branch_manager",
])

const OPERATIONS_PERSONAS = new Set<ProspectSearchRevenuePersonaType>([
  "operations_manager",
  "dispatcher",
  "service_manager",
  "technician_lead",
])

function personaToDepartment(persona: ProspectSearchRevenuePersonaType): string {
  if (LEADERSHIP_PERSONAS.has(persona)) return "leadership"
  if (OPERATIONS_PERSONAS.has(persona)) return "operations"
  if (persona === "administrator" || persona === "procurement") return "administration"
  if (persona === "sales_manager") return "sales"
  return "general"
}

function normalizePage(url: string | null | undefined): string | null {
  const value = url?.trim().toLowerCase() ?? ""
  if (!value) return null
  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`)
    return parsed.pathname.replace(/\/$/, "") || "/"
  } catch {
    return value
  }
}

export function buildProspectSearchRelationshipGraph(
  contacts: OrgContactInput[],
): ProspectSearchRelationshipGraph {
  const nodes: ProspectSearchRelationshipGraphNode[] = []
  const edges: ProspectSearchRelationshipGraphEdge[] = []
  const departments = new Set<string>()

  for (const contact of contacts) {
    nodes.push({
      id: `contact:${contact.contact_id}`,
      kind: "contact",
      label: contact.full_name ?? contact.persona_label,
      contact_id: contact.contact_id,
      persona_type: contact.persona_type,
      confidence: contact.persona_type !== "unknown" ? 0.75 : 0.4,
      evidence: contact.persona_evidence?.slice(0, 3) ?? [`Title: ${contact.title ?? "—"}`],
    })

    const dept = personaToDepartment(contact.persona_type)
    departments.add(dept)
    const deptId = `dept:${dept}`
    if (!nodes.some((n) => n.id === deptId)) {
      nodes.push({
        id: deptId,
        kind: "department",
        label: dept.replace(/_/g, " "),
        confidence: 0.6,
        evidence: [`Inferred from persona types — not a confirmed org chart`],
      })
    }

    edges.push({
      id: `edge:${contact.contact_id}:dept:${dept}`,
      from_id: `contact:${contact.contact_id}`,
      to_id: deptId,
      edge_type: "departmental_relationship",
      confidence: contact.persona_type !== "unknown" ? 0.7 : 0.35,
      evidence: [`${contact.persona_label} mapped to ${dept} cluster from title evidence`],
    })
  }

  const byPage = new Map<string, OrgContactInput[]>()
  for (const contact of contacts) {
    const page = normalizePage(contact.source_page_url)
    if (!page) continue
    const list = byPage.get(page) ?? []
    list.push(contact)
    byPage.set(page, list)
  }

  for (const [page, group] of byPage) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!
        const b = group[j]!
        edges.push({
          id: `edge:page:${a.contact_id}:${b.contact_id}`,
          from_id: `contact:${a.contact_id}`,
          to_id: `contact:${b.contact_id}`,
          edge_type: "same_page_evidence",
          confidence: 0.65,
          evidence: [`Both listed on same website page (${page}) — co-location, not reporting line`],
          bidirectional: true,
        })
        edges.push({
          id: `edge:ops:${a.contact_id}:${b.contact_id}`,
          from_id: `contact:${a.contact_id}`,
          to_id: `contact:${b.contact_id}`,
          edge_type: "operational_relationship",
          confidence: 0.5,
          evidence: ["Probable operational peer relationship from shared page grouping"],
          bidirectional: true,
        })
      }
    }
  }

  const owner = contacts.find((c) => c.persona_type === "owner" || c.persona_type === "founder")
  for (const contact of contacts) {
    if (owner && contact.contact_id !== owner.contact_id && OPERATIONS_PERSONAS.has(contact.persona_type)) {
      edges.push({
        id: `edge:influence:${owner.contact_id}:${contact.contact_id}`,
        from_id: `contact:${owner.contact_id}`,
        to_id: `contact:${contact.contact_id}`,
        edge_type: "probable_buying_influence",
        confidence: 0.55,
        evidence: [
          "Owner/founder + operations/service role co-present — probable buying influence path (inferred, not confirmed hierarchy)",
        ],
      })
    }
    if (contact.persona_type === "dispatcher") {
      edges.push({
        id: `edge:route:${contact.contact_id}`,
        from_id: `contact:${contact.contact_id}`,
        to_id: "dept:operations",
        edge_type: "communication_routing",
        confidence: 0.6,
        evidence: ["Dispatcher persona — likely communication routing for field operations"],
      })
    }
  }

  return {
    qa_marker: GROWTH_ORG_INTELLIGENCE_QA_MARKER,
    nodes,
    edges,
  }
}

export function buildProspectSearchOrgIntelligence(input: {
  company_name: string
  contacts: OrgContactInput[]
}): ProspectSearchOrgIntelligence {
  const contacts = input.contacts
  const relationship_graph = buildProspectSearchRelationshipGraph(contacts)

  const personaTypes = new Set(contacts.map((c) => c.persona_type))
  const leadership_coverage = [...personaTypes].some((p) => LEADERSHIP_PERSONAS.has(p))
  const operations_coverage = [...personaTypes].some((p) => OPERATIONS_PERSONAS.has(p))
  const service_coverage = personaTypes.has("service_manager")
  const admin_coverage = personaTypes.has("administrator") || personaTypes.has("procurement")
  const branch_structure_detected = personaTypes.has("branch_manager")

  const missing_department_warnings: string[] = []
  if (!leadership_coverage) {
    missing_department_warnings.push("No leadership persona identified — review website leadership pages")
  }
  if (!operations_coverage) {
    missing_department_warnings.push("No operations/service/dispatch coverage detected")
  }
  if (!service_coverage && operations_coverage) {
    missing_department_warnings.push("Operations present but no service manager persona")
  }

  let structure_label: ProspectSearchOrgStructureLabel = "unclear_structure"
  let structure_summary = "Insufficient contact evidence to infer organizational structure"
  if (personaTypes.has("owner") && !operations_coverage && contacts.length <= 3) {
    structure_label = "owner_operated"
    structure_summary = "Owner-operated company — small team footprint on website"
  } else if (branch_structure_detected) {
    structure_label = "branch_managed"
    structure_summary = "Branch-managed organization — regional/branch leadership detected"
  } else if (operations_coverage && service_coverage) {
    structure_label = "operations_heavy"
    structure_summary = "Operations-heavy structure — service and operations personas present"
  } else if (leadership_coverage && !operations_coverage) {
    structure_label = "leadership_identified_ops_missing"
    structure_summary = "Leadership identified, operations missing"
  } else if (service_coverage) {
    structure_label = "service_focused"
    structure_summary = "Service-focused structure — service manager persona identified"
  }

  let likely_communication_flow: string | null = null
  if (personaTypes.has("dispatcher")) {
    likely_communication_flow = "Dispatcher may gatekeep operational routing — consider manager path"
  } else if (operations_coverage && leadership_coverage) {
    likely_communication_flow = "Operations contact first, leadership escalation if needed"
  } else if (leadership_coverage) {
    likely_communication_flow = "Leadership contact may be primary routing point"
  }

  const grouped = new Map<ProspectSearchRevenuePersonaType, OrgContactInput[]>()
  for (const c of contacts) {
    const list = grouped.get(c.persona_type) ?? []
    list.push(c)
    grouped.set(c.persona_type, list)
  }

  const grouped_contacts_by_persona = [...grouped.entries()].map(([persona_type, list]) => ({
    persona_type,
    persona_label: list[0]?.persona_label ?? persona_type.replace(/_/g, " "),
    contact_ids: list.map((c) => c.contact_id),
    contact_names: list.map((c) => c.full_name ?? "Unknown").filter(Boolean),
  }))

  const namedContacts = contacts.filter((c) => c.persona_type !== "unknown").length
  const operational_structure_confidence =
    contacts.length === 0
      ? 0
      : Math.round(
          Math.min(
            1,
            namedContacts / Math.max(contacts.length, 1) * 0.5 +
              (leadership_coverage ? 0.15 : 0) +
              (operations_coverage ? 0.2 : 0) +
              (relationship_graph.edges.filter((e) => e.edge_type === "same_page_evidence").length > 0
                ? 0.15
                : 0),
          ) * 100,
        ) / 100

  const uncertainty_notes: string[] = [
    "Relationships inferred from titles and website page grouping — not a confirmed org chart",
  ]
  if (operational_structure_confidence < 0.5) {
    uncertainty_notes.push("Low structure confidence — additional contact research recommended")
  }

  return {
    qa_marker: GROWTH_ORG_INTELLIGENCE_QA_MARKER,
    structure_label,
    structure_summary,
    operational_structure_confidence,
    leadership_coverage,
    operations_coverage,
    service_coverage,
    admin_coverage,
    branch_structure_detected,
    likely_communication_flow,
    missing_department_warnings: missing_department_warnings.slice(0, 4),
    grouped_contacts_by_persona,
    uncertainty_notes,
    relationship_graph,
  }
}
