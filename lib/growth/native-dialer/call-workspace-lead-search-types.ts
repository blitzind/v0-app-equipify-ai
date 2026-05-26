/** Client-safe Native Dialer call workspace lead search types. */

export const GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER = "native-dialer-lead-search-v1" as const

export const CALL_WORKSPACE_LEAD_SEARCH_ENTITY_TYPES = [
  "growth_lead",
  "prospect",
  "decision_maker",
  "outbound_contact",
  "import_lead",
  "relationship_memory",
] as const

export type CallWorkspaceLeadSearchEntityType = (typeof CALL_WORKSPACE_LEAD_SEARCH_ENTITY_TYPES)[number]

export type CallWorkspaceLeadSearchResult = {
  leadId: string
  companyName: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  domain: string | null
  entityType: CallWorkspaceLeadSearchEntityType
  matchedField: string
  confidence: number
  sourceKind: string | null
}

export type CallWorkspaceLeadSearchSourceCounts = {
  growth_leads: number
  prospects: number
  decision_makers: number
  outbound_contacts: number
  import_leads: number
  relationship_memory: number
}

export type CallWorkspaceLeadSearchDebugSource = {
  name: string
  count: number
  error: string | null
}

export type CallWorkspaceLeadSearchDebugDiagnostics = {
  sources: CallWorkspaceLeadSearchDebugSource[]
  mergedCount: number
  autoSelectedLeadId: string | null
}

export type CallWorkspaceLeadSearchDiagnostics = {
  qaMarker: typeof GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER
  query: string
  sourceCounts: CallWorkspaceLeadSearchSourceCounts
  matchedEntityTypes: CallWorkspaceLeadSearchEntityType[]
  resultCount: number
  autoSelectedLeadId: string | null
  debug?: CallWorkspaceLeadSearchDebugDiagnostics
}
