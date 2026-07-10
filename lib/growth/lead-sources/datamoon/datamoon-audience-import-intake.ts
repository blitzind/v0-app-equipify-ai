/** GE-DATAMOON-1C — Map Datamoon normalized records to unified intake payload. Client-safe. */

import type {
  DatamoonAudienceImportRecord,
  DatamoonAudienceImportRun,
  DatamoonNormalizedLeadRecord,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  resolveDatamoonCompanyName,
  resolveDatamoonCompanyWebsite,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-company-identity"
import type {
  LeadIntakeSource,
  UnifiedLeadIntakeCompanyInput,
  UnifiedLeadIntakeContactInput,
  UnifiedLeadIntakeMetadataInput,
} from "@/lib/growth/revenue-workflow/unified-lead-intake-types"

export type DatamoonUnifiedIntakePayload = {
  source: LeadIntakeSource
  leadId: string
  company: UnifiedLeadIntakeCompanyInput
  contact: UnifiedLeadIntakeContactInput
  metadata: UnifiedLeadIntakeMetadataInput
}

function resolveCompanyName(normalized: DatamoonNormalizedLeadRecord): string {
  return resolveDatamoonCompanyName(normalized)
}

export function buildDatamoonUnifiedIntakePayload(input: {
  run: Pick<
    DatamoonAudienceImportRun,
    "id" | "datamoonAudienceId" | "providerMode" | "audienceType"
  >
  record: Pick<DatamoonAudienceImportRecord, "id" | "recordIndex" | "normalized">
  leadId: string
}): DatamoonUnifiedIntakePayload {
  const { run, record, leadId } = input
  const normalized = record.normalized
  const externalRef = `datamoon:${run.datamoonAudienceId ?? run.id}:${record.recordIndex}`

  return {
    source: "datamoon",
    leadId,
    company: {
      name: resolveCompanyName(normalized),
      website: resolveDatamoonCompanyWebsite(normalized),
      domain: normalized.company_domain,
    },
    contact: {
      firstName: normalized.first_name,
      lastName: normalized.last_name,
      name: normalized.contact_name,
      email: normalized.email,
      phone: normalized.phone,
      linkedinUrl: normalized.linkedin_url,
    },
    metadata: {
      leadId,
      externalRef,
      datamoon_import_run_id: run.id,
      datamoon_audience_id: run.datamoonAudienceId,
      datamoon_record_id: record.id,
      record_index: record.recordIndex,
      provider_mode: run.providerMode,
      audience_type: run.audienceType,
      business_email: normalized.business_email,
      personal_email: normalized.personal_emails,
      address_line1: normalized.address_line1,
      city: normalized.city,
      state: normalized.state,
      postal_code: normalized.postal_code,
      country: normalized.country,
    },
  }
}

export function formatDatamoonUnifiedIntakeRecordMessage(input: {
  skipped: boolean
  skipReason?: string | null
}): string {
  const base = "Imported into growth.leads."
  if (!input.skipped) {
    return `${base} Unified intake completed.`
  }

  const reason =
    typeof input.skipReason === "string" && input.skipReason.trim()
      ? input.skipReason.trim().slice(0, 200)
      : "workflow_skipped"
  return `${base} Unified intake skipped: ${reason}.`
}
