import {
  dedupeExtractedContacts,
  evidenceFromPage,
  extractEmails,
  extractPhones,
  stripHtmlTags,
  type ExtractedWebsiteContact,
} from "@/lib/growth/contact-discovery/extract/extract-shared"

export function extractContactPageContacts(html: string, pageUrl: string): ExtractedWebsiteContact[] {
  const plain = stripHtmlTags(html)
  const emails = extractEmails(plain)
  const phones = extractPhones(plain)
  const contacts: ExtractedWebsiteContact[] = []

  if (emails.length === 0 && phones.length === 0) return contacts

  const labelMatch = plain.match(/(?:contact|email|phone|call us|reach us)[^.]{0,120}/i)
  const excerpt = labelMatch?.[0] ?? plain.slice(0, 240)

  contacts.push({
    full_name: "Company contact",
    first_name: null,
    last_name: null,
    title: null,
    department: null,
    email: emails[0] ?? null,
    phone: phones[0] ?? null,
    linkedin_url: null,
    source_type: "contact_page",
    leadership_indicator: false,
    source_evidence: [
      evidenceFromPage({
        claim: "Contact page channel observed",
        excerpt,
        source: "contact_page",
        page_url: pageUrl,
      }),
    ],
  })

  return dedupeExtractedContacts(contacts)
}
