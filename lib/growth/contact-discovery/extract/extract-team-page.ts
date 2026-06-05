import {
  baseExtractedContact,
  dedupeExtractedContacts,
  evidenceFromPage,
  extractCardBlocks,
  extractEmails,
  extractLinkedInUrls,
  extractPhones,
  extractSectionBlocks,
  inferDepartmentLabelFromTitle,
  isPlausibleTeamPagePersonName,
  leadershipIndicatorFromTitle,
  readHeadingAndSubheading,
  splitName,
  stripHtmlTags,
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

function pushTeamContact(
  contacts: ExtractedWebsiteContact[],
  input: {
    name: string
    title: string | null
    block: string
    pageUrl: string
    email?: string | null
    phone?: string | null
    linkedin_url?: string | null
    claimPrefix?: string
  },
) {
  const plain = stripHtmlTags(input.block)
  const mailto = input.block.match(/mailto:([^"'>\s]+)/i)?.[1]?.toLowerCase() ?? null
  const email = input.email ?? mailto ?? extractEmails(plain)[0] ?? null
  const phone = input.phone ?? extractPhones(plain)[0] ?? null
  const linkedin_url = input.linkedin_url ?? extractLinkedInUrls(input.block)[0] ?? null
  const { first_name, last_name } = splitName(input.name)
  contacts.push(
    baseExtractedContact({
      full_name: input.name,
      first_name,
      last_name,
      title: input.title,
      department: inferDepartmentLabelFromTitle(input.title, plain),
      department_label: inferDepartmentLabelFromTitle(input.title, plain),
      email,
      phone,
      linkedin_url,
      source_type: "team_page",
      leadership_indicator: leadershipIndicatorFromTitle(input.title),
      source_page_type: "team",
      source_page_url: input.pageUrl,
      source_evidence: [
        evidenceFromPage({
          claim: `${input.claimPrefix ?? "team_page"}: ${input.name}${input.title ? ` — ${input.title}` : ""}`,
          excerpt: plain.slice(0, 240),
          source: "team_page",
          page_url: input.pageUrl,
        }),
      ],
    }),
  )
}

function extractTeamMembersFromMailtoCards(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const contacts: ExtractedWebsiteContact[] = []
  for (const match of html.matchAll(
    /<(?:article|li|div|section)[^>]*>([\s\S]{0,2500}?mailto:([^"'>\s]+)[\s\S]{0,2500}?)<\/(?:article|li|div|section)>/gi,
  )) {
    const block = match[1] ?? ""
    if (!block || !match[2]) continue
    const { name, title } = readHeadingAndSubheading(block)
    if (!name || !isPlausibleTeamPagePersonName(name, block)) continue
    pushTeamContact(contacts, {
      name,
      title,
      block,
      pageUrl,
      email: match[2]?.toLowerCase() ?? null,
      claimPrefix: "team_mailto_card",
    })
  }
  return contacts
}

export function extractTeamPageContacts(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const contacts: ExtractedWebsiteContact[] = []
  for (const block of extractSectionBlocks(html)) {
    const { name, title } = readHeadingAndSubheading(block)
    if (!name || !isPlausibleTeamPagePersonName(name, block)) continue
    pushTeamContact(contacts, { name, title, block, pageUrl })
  }

  for (const block of extractCardBlocks(html)) {
    const { name, title } = readHeadingAndSubheading(block)
    if (!name || !isPlausibleTeamPagePersonName(name, block)) continue
    pushTeamContact(contacts, { name, title, block, pageUrl, claimPrefix: "team_card" })
  }

  contacts.push(...extractTeamMembersFromMailtoCards(html, pageUrl))
  return dedupeExtractedContacts(contacts)
}
