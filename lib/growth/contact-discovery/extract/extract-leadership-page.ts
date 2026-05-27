import {
  dedupeExtractedContacts,
  evidenceFromPage,
  extractCardBlocks,
  extractLinkedInUrls,
  isPlausiblePersonName,
  leadershipIndicatorFromTitle,
  readHeadingAndSubheading,
  splitName,
  stripHtmlTags,
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

export function extractLeadershipPageContacts(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const contacts: ExtractedWebsiteContact[] = []
  for (const block of extractCardBlocks(html)) {
    const { name, title } = readHeadingAndSubheading(block)
    if (!name || !isPlausiblePersonName(name)) continue
    if (!leadershipIndicatorFromTitle(title)) continue
    const plain = stripHtmlTags(block)
    const linkedin_url = extractLinkedInUrls(block)[0] ?? null
    const { first_name, last_name } = splitName(name)
    contacts.push({
      full_name: name,
      first_name,
      last_name,
      title,
      department: null,
      email: null,
      phone: null,
      linkedin_url,
      source_type: "team_page",
      leadership_indicator: true,
      source_evidence: [
        evidenceFromPage({
          claim: `Leadership: ${name}${title ? ` — ${title}` : ""}`,
          excerpt: plain.slice(0, 240),
          source: "leadership_page",
          page_url: pageUrl,
        }),
      ],
    })
  }
  return dedupeExtractedContacts(contacts)
}
