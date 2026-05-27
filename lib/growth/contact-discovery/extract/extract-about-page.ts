import {
  dedupeExtractedContacts,
  evidenceFromPage,
  extractCardBlocks,
  isPlausiblePersonName,
  leadershipIndicatorFromTitle,
  readHeadingAndSubheading,
  splitName,
  stripHtmlTags,
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

export function extractAboutPageContacts(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const contacts: ExtractedWebsiteContact[] = []
  const leadershipSection = html.match(/(?:leadership|our team|management|founder)[\s\S]{0,4000}/i)?.[0] ?? html
  for (const block of extractCardBlocks(leadershipSection)) {
    const { name, title } = readHeadingAndSubheading(block)
    if (!name || !isPlausiblePersonName(name)) continue
    const plain = stripHtmlTags(block)
    const { first_name, last_name } = splitName(name)
    contacts.push({
      full_name: name,
      first_name,
      last_name,
      title,
      department: null,
      email: null,
      phone: null,
      linkedin_url: null,
      source_type: "website",
      leadership_indicator: leadershipIndicatorFromTitle(title),
      source_evidence: [
        evidenceFromPage({
          claim: `${name}${title ? ` — ${title}` : ""}`,
          excerpt: plain.slice(0, 240),
          source: "about_page",
          page_url: pageUrl,
        }),
      ],
    })
  }
  return dedupeExtractedContacts(contacts)
}
