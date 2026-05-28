import {
  baseExtractedContact,
  dedupeExtractedContacts,
  evidenceFromPage,
  extractEmails,
  extractLinkedInUrls,
  extractPhones,
  isPlausiblePersonName,
  readHeadingAndSubheading,
  stripHtmlTags,
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

export function extractFooterContacts(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i)
  if (!footerMatch?.[0]) return []

  const footerHtml = footerMatch[0]
  const plain = stripHtmlTags(footerHtml)
  const emails = extractEmails(plain)
  const phones = extractPhones(plain)
  const linkedinUrls = extractLinkedInUrls(plain)
  const contacts: ExtractedWebsiteContact[] = []

  const heading = readHeadingAndSubheading(footerHtml)
  if (heading.name && isPlausiblePersonName(heading.name)) {
    contacts.push(
      baseExtractedContact({
        full_name: heading.name,
        first_name: null,
        last_name: null,
        title: heading.title,
        department: null,
        department_label: null,
        email: emails[0] ?? null,
        phone: phones[0] ?? null,
        linkedin_url: linkedinUrls[0] ?? null,
        source_type: "website",
        leadership_indicator: false,
        source_page_type: "footer",
        source_page_url: pageUrl,
        source_evidence: [
          evidenceFromPage({
            claim: "Footer person observed",
            excerpt: plain.slice(0, 240),
            source: "website_footer",
            page_url: pageUrl,
          }),
        ],
      }),
    )
  }

  if (emails.length > 0 || phones.length > 0) {
    contacts.push(
      baseExtractedContact({
        full_name: "Company contact",
        first_name: null,
        last_name: null,
        title: null,
        department: null,
        department_label: null,
        email: emails[0] ?? null,
        phone: phones[0] ?? null,
        linkedin_url: linkedinUrls[0] ?? null,
        source_type: "website",
        leadership_indicator: false,
        source_page_type: "footer",
        source_page_url: pageUrl,
        source_evidence: [
          evidenceFromPage({
            claim: "Footer contact channel observed",
            excerpt: plain.slice(0, 240),
            source: "website_footer",
            page_url: pageUrl,
          }),
        ],
      }),
    )
  }

  return dedupeExtractedContacts(contacts)
}
