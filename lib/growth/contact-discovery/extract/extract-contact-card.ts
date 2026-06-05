import {
  baseExtractedContact,
  dedupeExtractedContacts,
  evidenceFromPage,
  extractCardBlocks,
  extractEmails,
  extractLinkedInUrls,
  extractPhones,
  isPlausiblePersonName,
  leadershipIndicatorFromTitle,
  readHeadingAndSubheading,
  splitName,
  stripHtmlTags,
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

/** Structured contact cards (team/staff cards with name + title). */
export function extractContactCardContacts(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const contacts: ExtractedWebsiteContact[] = []

  for (const block of extractCardBlocks(html)) {
    const { name, title } = readHeadingAndSubheading(block)
    if (!name || !isPlausiblePersonName(name)) continue
    const plain = stripHtmlTags(block)
    const email = extractEmails(plain)[0] ?? null
    const phone = extractPhones(plain)[0] ?? null
    const linkedin_url = extractLinkedInUrls(block)[0] ?? null
    const { first_name, last_name } = splitName(name)
    contacts.push(
      baseExtractedContact({
        full_name: name,
        first_name,
        last_name,
        title,
        department: null,
        department_label: null,
        email,
        phone,
        linkedin_url,
        source_type: "team_page",
        leadership_indicator: leadershipIndicatorFromTitle(title),
        source_page_type: "team",
        source_page_url: pageUrl,
        source_evidence: [
          evidenceFromPage({
            claim: `contact_card: ${name}${title ? ` — ${title}` : ""}`,
            excerpt: plain.slice(0, 240),
            source: "contact_card",
            page_url: pageUrl,
          }),
        ],
      }),
    )
  }

  return dedupeExtractedContacts(contacts)
}
