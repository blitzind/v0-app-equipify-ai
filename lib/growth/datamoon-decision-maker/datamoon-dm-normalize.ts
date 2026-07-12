/** SV1-4 / GE-AIOS-CONTACT-1A — Normalize DataMoon audience records into DM candidates (client-safe). */

import { normalizeDatamoonAudienceRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import { extractDatamoonContactChannels } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-contact-channels"
import { rankDatamoonDecisionMakerCandidates } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-engine"
import type { AiOsDatamoonDmCandidate } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-types"

function pickJobTitle(record: unknown): string | null {
  if (!record || typeof record !== "object") return null
  const raw = record as Record<string, unknown>
  for (const key of ["job_title", "title", "position", "jobTitle"]) {
    const value = raw[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function pickCompanyName(record: unknown, fallback: string | null): string | null {
  if (fallback?.trim()) return fallback.trim()
  if (!record || typeof record !== "object") return null
  const raw = record as Record<string, unknown>
  for (const key of ["company_name", "companyName", "organization_name"]) {
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
    const channels = extractDatamoonContactChannels(record)
    const fullName =
      normalized.contact_name?.trim() ||
      [normalized.first_name, normalized.last_name].filter(Boolean).join(" ").trim()

    const primaryEmail = channels.primaryEmail ?? normalized.email ?? normalized.business_email ?? null
    const primaryPhone = channels.primaryPhone ?? normalized.phone ?? null

    return {
      fullName: fullName || `Unknown ${index + 1}`,
      title: pickJobTitle(record),
      email: primaryEmail,
      phone: primaryPhone,
      linkedinUrl: normalized.linkedin_url,
      companyName: pickCompanyName(record, normalized.company_name),
      companyDomain: normalized.company_domain,
      providerRecordId:
        typeof (record as { id?: unknown })?.id === "string"
          ? String((record as { id: string }).id)
          : `idx:${index}`,
      emails: channels.emails.map((email) => ({
        value: email.value,
        normalized: email.normalized,
        emailType: email.emailType,
        rawProviderValue: email.rawProviderValue,
        fieldKey: email.fieldKey,
      })),
      phones: channels.phones.map((phone) => ({
        value: phone.value,
        normalized: phone.normalized,
        e164: phone.e164,
        extension: phone.extension,
        phoneType: phone.phoneType,
        isCompanySwitchboard: phone.isCompanySwitchboard,
        rawProviderValue: phone.rawProviderValue,
        fieldKey: phone.fieldKey,
      })),
    }
  })

  return rankDatamoonDecisionMakerCandidates(mapped, {
    expectedCompanyDomain: input.expectedCompanyDomain,
    expectedCompanyName: input.expectedCompanyName,
  })
}
