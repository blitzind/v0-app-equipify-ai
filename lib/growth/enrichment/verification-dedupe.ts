import { createHash } from "node:crypto"

export function buildContactVerificationDedupeHash(input: {
  contact_candidate_id: string
  provider_name: string
}): string {
  return createHash("sha256")
    .update(`${input.contact_candidate_id}|${input.provider_name}`)
    .digest("hex")
    .slice(0, 40)
}

export function buildCompanyEnrichmentDedupeHash(input: {
  company_candidate_id: string
  provider_name: string
}): string {
  return createHash("sha256")
    .update(`${input.company_candidate_id}|${input.provider_name}`)
    .digest("hex")
    .slice(0, 40)
}
