import {
  baseExtractedContact,
  dedupeExtractedContacts,
  evidenceFromPage,
  extractCardBlocks,
  extractSectionBlocks,
  isPlausiblePersonName,
  isPlausibleTeamPagePersonName,
  leadershipIndicatorFromTitle,
  readHeadingAndSubheading,
  splitName,
  stripHtmlTags,
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

function pushAboutContact(
  contacts: ExtractedWebsiteContact[],
  input: {
    name: string
    title: string | null
    block: string
    pageUrl: string
    claimPrefix: string
  },
): void {
  const plain = stripHtmlTags(input.block)
  const { first_name, last_name } = splitName(input.name)
  contacts.push(
    baseExtractedContact({
      full_name: input.name,
      first_name,
      last_name,
      title: input.title,
      department: null,
      department_label: null,
      email: null,
      phone: null,
      linkedin_url: null,
      source_type: "website",
      leadership_indicator: leadershipIndicatorFromTitle(input.title),
      source_page_type: "about",
      source_page_url: input.pageUrl,
      source_evidence: [
        evidenceFromPage({
          claim: `${input.claimPrefix}: ${input.name}${input.title ? ` — ${input.title}` : ""}`,
          excerpt: plain.slice(0, 240),
          source: "about_page",
          page_url: input.pageUrl,
        }),
      ],
    }),
  )
}

function extractAboutPageProseNames(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const contacts: ExtractedWebsiteContact[] = []
  const plain = stripHtmlTags(html)
  const patterns = [
    /(?:founded|started|owned and operated|owned|operated)\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/gi,
    /(?:president|owner|ceo|founder|general manager|service manager|director)\s*[,:]\s*([A-Z][a-z]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/gi,
  ]

  for (const pattern of patterns) {
    for (const match of plain.matchAll(pattern)) {
      const name = match[1]?.trim()
      if (!name || !isPlausiblePersonName(name)) continue
      pushAboutContact(contacts, {
        name,
        title: null,
        block: match[0] ?? name,
        pageUrl,
        claimPrefix: "about_prose",
      })
    }
  }

  return contacts
}

export function extractAboutPageContacts(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const contacts: ExtractedWebsiteContact[] = []
  const leadershipSection = html.match(/(?:leadership|our team|management|founder)[\s\S]{0,4000}/i)?.[0] ?? html

  for (const block of extractSectionBlocks(leadershipSection)) {
    const { name, title } = readHeadingAndSubheading(block)
    if (!name || !isPlausibleTeamPagePersonName(name, block)) continue
    pushAboutContact(contacts, {
      name,
      title,
      block,
      pageUrl,
      claimPrefix: "about_section",
    })
  }

  for (const block of extractCardBlocks(html)) {
    const { name, title } = readHeadingAndSubheading(block)
    if (!name || !isPlausibleTeamPagePersonName(name, block)) continue
    pushAboutContact(contacts, {
      name,
      title,
      block,
      pageUrl,
      claimPrefix: "about_card",
    })
  }

  contacts.push(...extractAboutPageProseNames(html, pageUrl))
  return dedupeExtractedContacts(contacts)
}
