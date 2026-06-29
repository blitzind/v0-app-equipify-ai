/** GE-LAUNCH-1B — Intake source mapping helpers (client-safe). */

import type { GrowthBrowserIntakeSourcePlatform } from "@/lib/growth/browser-intake/browser-intake-types"
import type { GrowthCompanyContact } from "@/lib/growth/contact-discovery/company-contact-types"
import type { NormalizedImportRow } from "@/lib/growth/import/types"
import type {
  LeadIntakeSource,
  UnifiedLeadIntakeContactInput,
  UnifiedLeadIntakeMetadataInput,
  UnifiedRevenueWorkflowResult,
} from "@/lib/growth/revenue-workflow/unified-lead-intake-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function resolveBrowserIntakeLeadSource(
  sourcePlatform: GrowthBrowserIntakeSourcePlatform | string | null | undefined,
): LeadIntakeSource {
  const platform = asString(sourcePlatform).toLowerCase()
  if (platform === "linkedin") return "linkedin_capture"
  if (platform === "website") return "website"
  return "browser_intake"
}

export function resolveAcquisitionContactIntakeSource(
  contact: Pick<GrowthCompanyContact, "metadata" | "source_evidence">,
  metadata?: UnifiedLeadIntakeMetadataInput,
): LeadIntakeSource {
  const explicit = asString(metadata?.intakeSource)
  if (explicit === "apollo" || explicit === "pdl" || explicit === "saved_search") {
    return explicit
  }

  const discoveryProvider = asString(contact.metadata.discovery_provider).toLowerCase()
  const providerType = asString(contact.metadata.provider_type).toLowerCase()

  if (
    discoveryProvider.includes("apollo") ||
    providerType.includes("apollo") ||
    asString(contact.metadata.apollo_person_id)
  ) {
    return "apollo"
  }

  if (
    discoveryProvider.includes("pdl") ||
    discoveryProvider.includes("people_data") ||
    providerType.includes("pdl") ||
    providerType.includes("people_data")
  ) {
    return "pdl"
  }

  if (asString(metadata?.savedSearchId) || asString(metadata?.saved_search_id)) {
    return "saved_search"
  }

  for (const evidence of contact.source_evidence ?? []) {
    const source = asString(evidence.source).toLowerCase()
    if (source.includes("apollo")) return "apollo"
    if (source.includes("pdl") || source.includes("people_data")) return "pdl"
    if (source.includes("prospect_search") || source.includes("saved_search")) return "saved_search"
  }

  return "saved_search"
}

export function importRowToIntakeContact(row: NormalizedImportRow): UnifiedLeadIntakeContactInput {
  return {
    name: row.contactName,
    firstName: row.firstName,
    lastName: row.lastName,
    title: row.title,
    email: row.email,
    phone: row.phone,
    linkedinUrl: row.linkedinUrl,
  }
}

export function workflowResultNeedsReview(result: UnifiedRevenueWorkflowResult): boolean {
  return (
    result.approvalRequired === true ||
    result.humanApproval?.required === true ||
    result.warnings.some((warning) => warning.includes("human_review")) ||
    result.blockers.length > 0
  )
}
