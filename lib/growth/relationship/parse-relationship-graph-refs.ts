/** GE-AIOS-15B — Parse relationship graph IDs from hrefs and source keys (client-safe). */

const LEAD_HREF_PATTERN = /\/growth\/leads\/([0-9a-f-]{36})/i
const PERSON_HREF_PATTERN = /\/growth\/(?:persons|contacts)\/([0-9a-f-]{36})/i
const CONVERSATION_HREF_PATTERN = /\/growth\/(?:conversations|inbox)\/([0-9a-f-]{36})/i
const OPPORTUNITY_HREF_PATTERN = /\/growth\/opportunities\/([0-9a-f-]{36})/i

export function parseLeadIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null
  const match = href.match(LEAD_HREF_PATTERN)
  return match?.[1] ?? null
}

export function parsePersonIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null
  const match = href.match(PERSON_HREF_PATTERN)
  return match?.[1] ?? null
}

export function parseConversationThreadIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null
  const match = href.match(CONVERSATION_HREF_PATTERN)
  return match?.[1] ?? null
}

export function parseOpportunityIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null
  const match = href.match(OPPORTUNITY_HREF_PATTERN)
  return match?.[1] ?? null
}

export function parseLeadIdFromSourceId(sourceId: string | null | undefined): string | null {
  if (!sourceId) return null
  if (/^[0-9a-f-]{36}$/i.test(sourceId)) return sourceId
  const researchMatch = sourceId.match(/^research:([0-9a-f-]{36})$/i)
  if (researchMatch?.[1]) return researchMatch[1]
  const leadMatch = sourceId.match(/^lead:([0-9a-f-]{36})$/i)
  if (leadMatch?.[1]) return leadMatch[1]
  const queueMatch = sourceId.match(/^queue:([0-9a-f-]{36})$/i)
  if (queueMatch?.[1]) return queueMatch[1]
  return null
}

export function readCanonicalCompanyIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) return null
  const direct = metadata.canonical_company_id
  if (typeof direct === "string" && direct.trim()) return direct.trim()
  const nested = metadata.relationship_graph
  if (nested && typeof nested === "object") {
    const row = nested as Record<string, unknown>
    const value = row.canonical_company_id
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

export function readPersonIdFromMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null
  const direct = metadata.canonical_person_id ?? metadata.person_id ?? metadata.primary_decision_maker_id
  if (typeof direct === "string" && direct.trim()) return direct.trim()
  return null
}
