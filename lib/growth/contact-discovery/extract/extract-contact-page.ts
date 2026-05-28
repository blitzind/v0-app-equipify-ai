import {
  baseExtractedContact,
  dedupeExtractedContacts,
  evidenceFromPage,
  extractBranchLocationFromPage,
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

  const labelMatch = plain.match(/(?:contact|email|phone|call us|reach us|dispatch|service department|office)[^.]{0,120}/i)
  const excerpt = labelMatch?.[0] ?? plain.slice(0, 240)
  const branch = extractBranchLocationFromPage(plain)

  contacts.push(
    baseExtractedContact({
      full_name: "Company contact",
      first_name: null,
      last_name: null,
      title: null,
      department: null,
      department_label: labelMatch?.[0]?.includes("dispatch")
        ? "Dispatch"
        : labelMatch?.[0]?.includes("service")
          ? "Service"
          : null,
      email: emails[0] ?? null,
      phone: phones[0] ?? null,
      linkedin_url: null,
      source_type: "contact_page",
      leadership_indicator: false,
      source_page_type: "contact",
      source_page_url: pageUrl,
      branch_name: branch.branch_name,
      branch_city: branch.branch_city,
      branch_state: branch.branch_state,
      branch_phone: phones[0] ?? null,
      location_confidence: branch.location_confidence > 0 ? branch.location_confidence : null,
      source_evidence: [
        evidenceFromPage({
          claim: "Contact page channel observed",
          excerpt,
          source: "contact_page",
          page_url: pageUrl,
        }),
      ],
    }),
  )

  return dedupeExtractedContacts(contacts)
}
