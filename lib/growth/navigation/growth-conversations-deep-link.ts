/** Client-safe deep-link query param helpers for Conversations workspace (Phase 7O). */

export const GROWTH_CONVERSATIONS_DEEP_LINK_QA_MARKER = "growth-conversations-deep-link-v1" as const

export type GrowthConversationsDeepLinkParams = {
  leadId: string | null
  threadId: string | null
  companyId: string | null
  personId: string | null
}

export type GrowthConversationsDashboardLeadRef = {
  id: string
  companyName?: string | null
  metadata?: Record<string, unknown> | null
}

export function parseGrowthConversationsDeepLinkParams(input: {
  get: (key: string) => string | null
}): GrowthConversationsDeepLinkParams {
  return {
    leadId: input.get("leadId")?.trim() || null,
    threadId: input.get("threadId")?.trim() || null,
    companyId: input.get("companyId")?.trim() || null,
    personId: input.get("personId")?.trim() || null,
  }
}

export function hasGrowthConversationsDeepLinkParams(params: GrowthConversationsDeepLinkParams): boolean {
  return Boolean(params.leadId || params.threadId || params.companyId || params.personId)
}

export function collectGrowthConversationsDashboardLeads(
  dashboard: Record<string, Array<GrowthConversationsDashboardLeadRef>>,
): GrowthConversationsDashboardLeadRef[] {
  const seen = new Set<string>()
  const merged: GrowthConversationsDashboardLeadRef[] = []

  for (const bucket of Object.values(dashboard)) {
    if (!Array.isArray(bucket)) continue
    for (const lead of bucket) {
      if (!lead?.id || seen.has(lead.id)) continue
      seen.add(lead.id)
      merged.push(lead)
    }
  }

  return merged
}

function metadataMatchesId(
  metadata: Record<string, unknown> | null | undefined,
  key: "companyId" | "personId",
  value: string,
): boolean {
  if (!metadata) return false
  const direct = metadata[key]
  if (typeof direct === "string" && direct === value) return true
  const nestedCompany = metadata.company
  if (key === "companyId" && nestedCompany && typeof nestedCompany === "object") {
    const companyId = (nestedCompany as { id?: unknown }).id
    if (typeof companyId === "string" && companyId === value) return true
  }
  const nestedPerson = metadata.person
  if (key === "personId" && nestedPerson && typeof nestedPerson === "object") {
    const personId = (nestedPerson as { id?: unknown }).id
    if (typeof personId === "string" && personId === value) return true
  }
  return false
}

export function resolveGrowthConversationsFocusedLeadId(
  leads: GrowthConversationsDashboardLeadRef[],
  params: GrowthConversationsDeepLinkParams,
): string | null {
  if (params.leadId && leads.some((lead) => lead.id === params.leadId)) {
    return params.leadId
  }

  if (params.companyId) {
    const match = leads.find((lead) => metadataMatchesId(lead.metadata ?? null, "companyId", params.companyId!))
    if (match) return match.id
  }

  if (params.personId) {
    const match = leads.find((lead) => metadataMatchesId(lead.metadata ?? null, "personId", params.personId!))
    if (match) return match.id
  }

  return null
}

export function findGrowthConversationsFocusedLead(
  leads: GrowthConversationsDashboardLeadRef[],
  focusedLeadId: string | null,
): GrowthConversationsDashboardLeadRef | null {
  if (!focusedLeadId) return null
  return leads.find((lead) => lead.id === focusedLeadId) ?? null
}

export function shouldShowGrowthConversationsMissingContextMessage(input: {
  params: GrowthConversationsDeepLinkParams
  focusedLeadId: string | null
}): boolean {
  if (!hasGrowthConversationsDeepLinkParams(input.params)) return false
  if (input.focusedLeadId) return false
  return Boolean(input.params.leadId || input.params.companyId || input.params.personId)
}
