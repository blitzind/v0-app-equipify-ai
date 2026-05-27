import {
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
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

export function extractTeamPageContacts(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const contacts: ExtractedWebsiteContact[] = []
  for (const block of extractCardBlocks(html)) {
    const { name, title } = readHeadingAndSubheading(block)
    if (!name || !isPlausiblePersonName(name)) continue
    const plain = block.replace(/<[^>]+>/g, " ")
    const mailto = block.match(/mailto:([^"'>\s]+)/i)?.[1]?.toLowerCase() ?? null
    const email = mailto ?? extractEmails(plain)[0] ?? null
    const phone = extractPhones(plain)[0] ?? null
    const linkedin_url = extractLinkedInUrls(block)[0] ?? null
    const { first_name, last_name } = splitName(name)
    contacts.push({
      full_name: name,
      first_name,
      last_name,
      title,
      department: null,
      email,
      phone,
      linkedin_url,
      source_type: "team_page",
      leadership_indicator: leadershipIndicatorFromTitle(title),
      source_evidence: [
        evidenceFromPage({
          claim: `${name}${title ? ` — ${title}` : ""}`,
          excerpt: plain.slice(0, 240),
          source: "team_page",
          page_url: pageUrl,
        }),
      ],
    })
  }
  return dedupeExtractedContacts(contacts)
}
