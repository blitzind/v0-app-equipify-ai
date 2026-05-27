import {
  dedupeExtractedContacts,
  evidenceFromPage,
  extractEmails,
  extractLinkedInUrls,
  extractPhones,
  isPlausiblePersonName,
  leadershipIndicatorFromTitle,
  splitName,
  stripHtmlTags,
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

function parseJsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = match[1]?.trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") blocks.push(item as Record<string, unknown>)
        }
      } else if (parsed && typeof parsed === "object") {
        blocks.push(parsed as Record<string, unknown>)
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return blocks
}

function personFromNode(node: Record<string, unknown>, pageUrl: string): ExtractedWebsiteContact | null {
  const type = String(node["@type"] ?? "").toLowerCase()
  if (type !== "person") return null
  const full_name = typeof node.name === "string" ? node.name.trim() : ""
  if (!full_name || !isPlausiblePersonName(full_name)) return null
  const title = typeof node.jobTitle === "string" ? node.jobTitle.trim() : null
  const email = typeof node.email === "string" ? node.email.trim().toLowerCase() : extractEmails(JSON.stringify(node))[0] ?? null
  const phone = typeof node.telephone === "string" ? node.telephone.trim() : extractPhones(JSON.stringify(node))[0] ?? null
  const linkedin_url =
    typeof node.sameAs === "string"
      ? extractLinkedInUrls(node.sameAs)[0] ?? null
      : Array.isArray(node.sameAs)
        ? extractLinkedInUrls(node.sameAs.filter((item) => typeof item === "string").join(" "))[0] ?? null
        : extractLinkedInUrls(JSON.stringify(node))[0] ?? null
  const { first_name, last_name } = splitName(full_name)
  return {
    full_name,
    first_name,
    last_name,
    title,
    department: typeof node.worksFor === "string" ? node.worksFor : null,
    email,
    phone,
    linkedin_url,
    source_type: "website",
    leadership_indicator: leadershipIndicatorFromTitle(title),
    source_evidence: [
      evidenceFromPage({
        claim: `schema.org Person: ${full_name}${title ? ` — ${title}` : ""}`,
        excerpt: stripHtmlTags(JSON.stringify(node)).slice(0, 240),
        source: "schema_org_person",
        page_url: pageUrl,
      }),
    ],
  }
}

export function extractSchemaOrgPersonContacts(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const contacts: ExtractedWebsiteContact[] = []
  for (const block of parseJsonLdBlocks(html)) {
    const direct = personFromNode(block, pageUrl)
    if (direct) contacts.push(direct)
    const employees = block.employee
    if (Array.isArray(employees)) {
      for (const employee of employees) {
        if (employee && typeof employee === "object") {
          const mapped = personFromNode(employee as Record<string, unknown>, pageUrl)
          if (mapped) contacts.push(mapped)
        }
      }
    }
  }
  return dedupeExtractedContacts(contacts)
}
