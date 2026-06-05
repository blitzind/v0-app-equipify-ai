import {
  baseExtractedContact,
  dedupeExtractedContacts,
  evidenceFromPage,
  isPlausiblePersonName,
  leadershipIndicatorFromTitle,
  splitName,
  stripHtmlTags,
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

/** Extract author bylines from blog/article pages — evidence-backed name + title only. */
export function extractAuthorBylineContacts(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const contacts: ExtractedWebsiteContact[] = []
  const plain = stripHtmlTags(html)

  const authorPatterns = [
    /(?:written by|posted by|author[:\s]+)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+)+)(?:\s*[,\-|]\s*([A-Za-z][A-Za-z\s&./'-]{2,60}))?/gi,
    /class=["'][^"']*author[^"']*["'][^>]*>[\s\S]{0,400}?([A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+)+)(?:\s*<[^>]+>\s*([A-Za-z][A-Za-z\s&./'-]{2,60}))?/gi,
  ]

  for (const pattern of authorPatterns) {
    for (const match of plain.matchAll(pattern)) {
      const name = match[1]?.trim() ?? ""
      const title = match[2]?.trim() || null
      if (!name || !isPlausiblePersonName(name)) continue
      const { first_name, last_name } = splitName(name)
      contacts.push(
        baseExtractedContact({
          full_name: name,
          first_name,
          last_name,
          title,
          department: null,
          department_label: null,
          email: null,
          phone: null,
          linkedin_url: null,
          source_type: "website",
          leadership_indicator: leadershipIndicatorFromTitle(title),
          source_page_type: "blog_author",
          source_page_url: pageUrl,
          source_evidence: [
            evidenceFromPage({
              claim: `author_byline: ${name}${title ? ` — ${title}` : ""}`,
              excerpt: (match[0] ?? "").slice(0, 240),
              source: "author_byline",
              page_url: pageUrl,
            }),
          ],
        }),
      )
    }
  }

  return dedupeExtractedContacts(contacts)
}
