import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthBuyingCommitteeIntelligenceSource } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

const COMPANY_CONTACT_SOURCES: GrowthBuyingCommitteeIntelligenceSource[] = [
  "metadata_declared",
  "title_pattern",
  "confirmed_decision_maker",
  "website_evidence",
  "team_page_evidence",
  "staging_contact",
]

export function buyingCommitteeSourceRequiresEmploymentCheck(
  source: GrowthBuyingCommitteeIntelligenceSource,
): boolean {
  return COMPANY_CONTACT_SOURCES.includes(source)
}

/** Person must be linked to company via employment row or canonical staging contact. */
export async function personHasVerifiedCompanyEmploymentLink(
  admin: SupabaseClient,
  input: { company_id: string; person_id: string },
): Promise<boolean> {
  const company_id = input.company_id.trim()
  const person_id = input.person_id.trim()
  if (!company_id || !person_id) return false

  const { data: role } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("id")
    .eq("company_id", company_id)
    .eq("person_id", person_id)
    .limit(1)
    .maybeSingle()
  if (role?.id) return true

  const { data: contact } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id")
    .or(`canonical_company_id.eq.${company_id},company_id.eq.${company_id}`)
    .eq("canonical_person_id", person_id)
    .limit(1)
    .maybeSingle()

  return Boolean(contact?.id)
}
