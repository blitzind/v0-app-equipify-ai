/** Loose name matching for associating discovered emails with a canonical person. Client-safe. */

import { canonicalNormalizedPersonName } from "@/lib/growth/canonical-persons/canonical-person-normalize"

export function personNameMatchesDiscoveryContact(input: {
  person_normalized_name: string
  contact_full_name: string
}): boolean {
  const person = input.person_normalized_name.trim()
  const contact = canonicalNormalizedPersonName(input.contact_full_name)
  if (!person || !contact) return false
  if (person === contact) return true

  const personParts = person.split(/\s+/).filter(Boolean)
  const contactParts = contact.split(/\s+/).filter(Boolean)
  if (personParts.length < 2 || contactParts.length < 2) return false

  const personFirst = personParts[0] ?? ""
  const personLast = personParts[personParts.length - 1] ?? ""
  const contactFirst = contactParts[0] ?? ""
  const contactLast = contactParts[contactParts.length - 1] ?? ""

  return personFirst === contactFirst && personLast === contactLast
}
