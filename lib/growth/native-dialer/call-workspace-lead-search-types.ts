/** Client-safe Native Dialer call workspace lead search types. */

export const GROWTH_NATIVE_DIALER_LEAD_SEARCH_QA_MARKER = "native-dialer-lead-search-v2" as const

export const CALL_WORKSPACE_LEAD_SEARCH_SOURCES = [
  "growth_lead",
  "prospect",
  "contact",
  "account",
  "decision_maker",
  "outbound_contact",
  "import_lead",
  "relationship_memory",
] as const

export type CallWorkspaceLeadSearchSource = (typeof CALL_WORKSPACE_LEAD_SEARCH_SOURCES)[number]

/** @deprecated Use CallWorkspaceLeadSearchSource */
export const CALL_WORKSPACE_LEAD_SEARCH_ENTITY_TYPES = CALL_WORKSPACE_LEAD_SEARCH_SOURCES
export type CallWorkspaceLeadSearchEntityType = CallWorkspaceLeadSearchSource

/** Normalized selectable entity from any Growth Engine datasource. */
export type CallWorkspaceLeadSearchHit = {
  id: string
  displayName: string
  companyName: string
  email: string | null
  phone: string | null
  source: CallWorkspaceLeadSearchSource
  confidence: number
}

export type CallWorkspaceLeadSearchResult = CallWorkspaceLeadSearchHit & {
  /** Growth lead id for attach-lead API; null when entity has no promoted growth lead yet. */
  attachLeadId: string | null
  /** @deprecated Prefer attachLeadId; kept for backward compatibility */
  leadId: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  domain: string | null
  entityType: CallWorkspaceLeadSearchEntityType
  matchedField: string
  sourceKind: string | null
}

export type CallWorkspaceLeadSearchSourceCounts = {
  growth_leads: number
  prospects: number
  contacts: number
  accounts: number
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

export function resolveCallWorkspaceAttachLeadId(hit: CallWorkspaceLeadSearchHit): string | null {
  if ("attachLeadId" in hit && typeof hit.attachLeadId === "string" && hit.attachLeadId) {
    return hit.attachLeadId
  }
  if (hit.source === "growth_lead" || hit.source === "import_lead" || hit.source === "relationship_memory") {
    return hit.id
  }
  return null
}
