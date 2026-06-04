/** Extract Organization fields from JSON-LD in HTML — deterministic, no AI. Client-safe. */

export type SchemaOrgOrganizationFacts = {
  name: string | null
  description: string | null
  industry: string | null
  numberOfEmployees: string | null
  addressLocality: string | null
  addressRegion: string | null
  addressCountry: string | null
  url: string | null
}

function trimOrNull(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : null
}

function isOrganizationType(typeValue: unknown): boolean {
  const types = Array.isArray(typeValue) ? typeValue : typeValue ? [typeValue] : []
  return types.some((t) => typeof t === "string" && /organization|corporation|localbusiness|company/i.test(t))
}

function addressField(
  address: unknown,
  field: "addressLocality" | "addressRegion" | "addressCountry",
): string | null {
  if (!address || typeof address !== "object") return null
  const record = address as Record<string, unknown>
  return trimOrNull(record[field])
}

function orgFromNode(node: Record<string, unknown>): SchemaOrgOrganizationFacts | null {
  if (!isOrganizationType(node["@type"])) return null
  const address = node.address
  return {
    name: trimOrNull(node.name),
    description: trimOrNull(node.description),
    industry: trimOrNull(node.industry),
    numberOfEmployees:
      trimOrNull(node.numberOfEmployees) ??
      (typeof node.numberOfEmployees === "number" ? String(node.numberOfEmployees) : null),
    addressLocality: addressField(address, "addressLocality"),
    addressRegion: addressField(address, "addressRegion"),
    addressCountry: addressField(address, "addressCountry"),
    url: trimOrNull(node.url),
  }
}

function collectOrganizations(value: unknown, out: SchemaOrgOrganizationFacts[]): void {
  if (!value) return
  if (Array.isArray(value)) {
    for (const entry of value) collectOrganizations(entry, out)
    return
  }
  if (typeof value !== "object") return
  const record = value as Record<string, unknown>
  const org = orgFromNode(record)
  if (org && (org.name || org.description || org.industry)) out.push(org)
  if (record.organization) collectOrganizations(record.organization, out)
  if (record.publisher) collectOrganizations(record.publisher, out)
  if (record.mainEntity) collectOrganizations(record.mainEntity, out)
  if (record["@graph"]) collectOrganizations(record["@graph"], out)
}

export function extractSchemaOrgOrganizationsFromHtml(html: string): SchemaOrgOrganizationFacts[] {
  const results: SchemaOrgOrganizationFacts[] = []
  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = scriptPattern.exec(html)) !== null) {
    const raw = match[1]?.trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      collectOrganizations(parsed, results)
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return results
}

export function extractMetaDescriptionFromHtml(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  ]
  for (const pattern of patterns) {
    const hit = html.match(pattern)
    if (hit?.[1]) {
      const trimmed = hit[1].trim()
      if (trimmed.length >= 20) return trimmed.slice(0, 500)
    }
  }
  return null
}
