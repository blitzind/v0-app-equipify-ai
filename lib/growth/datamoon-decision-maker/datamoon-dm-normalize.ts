/** SV1-4 — Normalize DataMoon audience records into DM candidates (client-safe). */

import { normalizeDatamoonAudienceRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import { rankDatamoonDecisionMakerCandidates } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-engine"
import type { AiOsDatamoonDmCandidate } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-types"

function pickJobTitle(record: unknown): string | null {
  if (!record || typeof record !== "object") return null
  const raw = record as Record<string, unknown>
  for (const key of ["job_title", "title", "position"]) {
    const value = raw[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

export function normalizeDatamoonRecordsToDecisionMakerCandidates(input: {
  records: unknown[]
  expectedCompanyDomain?: string | null
  expectedCompanyName?: string | null
}): AiOsDatamoonDmCandidate[] {
  const mapped = input.records.map((record, index) => {
    const normalized = normalizeDatamoonAudienceRecord(record)
    const fullName =
      normalized.contact_name?.trim() ||
      [normalized.first_name, normalized.last_name].filter(Boolean).join(" ").trim()
    return {
      fullName: fullName || `Unknown ${index + 1}`,
      title: pickJobTitle(record),
      email: normalized.email ?? normalized.business_email ?? normalized.personal_emails,
      phone: normalized.phone ?? normalized.personal_phone,
      linkedinUrl: normalized.linkedin_url,
      companyName: normalized.company_name,
      companyDomain: normalized.company_domain,
      providerRecordId:
        typeof (record as { id?: unknown })?.id === "string"
          ? String((record as { id: string }).id)
          : `idx:${index}`,
    }
  })

  return rankDatamoonDecisionMakerCandidates(mapped, {
    expectedCompanyDomain: input.expectedCompanyDomain,
    expectedCompanyName: input.expectedCompanyName,
  })
}
