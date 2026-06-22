/** GE-v1-3 — API prospect field mapping (client-safe). */

import type { GeV13ProspectGenerationInput } from "@/lib/growth/media/ge-v1-3-types"

export function mapGeV13ProspectFromApiBody(body: {
  lead_id?: string | null
  company_candidate_id?: string | null
  person_candidate_id?: string | null
  personalization_profile_id?: string | null
  sender_profile_id?: string | null
  operator_instructions?: string | null
}): GeV13ProspectGenerationInput | null {
  const prospect: GeV13ProspectGenerationInput = {
    leadId: body.lead_id ?? null,
    companyCandidateId: body.company_candidate_id ?? null,
    personCandidateId: body.person_candidate_id ?? null,
    personalizationProfileId: body.personalization_profile_id ?? null,
    senderProfileId: body.sender_profile_id ?? null,
    operatorInstructions: body.operator_instructions ?? null,
  }

  const hasInput = Object.values(prospect).some((value) => Boolean(value?.trim?.() ?? value))
  return hasInput ? prospect : null
}
