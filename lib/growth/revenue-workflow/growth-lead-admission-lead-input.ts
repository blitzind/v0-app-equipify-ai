/** GE-AIOS-21C-4 — Map persisted leads to canonical admission intake (client-safe). */

import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import type { GrowthLeadAdmissionIntakeInput } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  LEAD_INTAKE_SOURCES,
  type LeadIntakeSource,
} from "@/lib/growth/revenue-workflow/unified-lead-intake-types"

export const AVA_CROSSWALK_E2E_AUTONOMY_1A_ADMISSION_INTAKE_SOURCE_QA_MARKER =
  "ava-crosswalk-e2e-autonomy-1a-admission-intake-source-v1" as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isLeadIntakeSource(value: string): value is LeadIntakeSource {
  return (LEAD_INTAKE_SOURCES as readonly string[]).includes(value)
}

/** Rehydrate intake source from persisted lead metadata when unified_intake_source was not written. */
export function resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata(
  metadata: Record<string, unknown>,
): LeadIntakeSource {
  const unified = asString(metadata.unified_intake_source)
  if (unified && isLeadIntakeSource(unified)) return unified

  const normalized = asString(metadata.normalized_source)
  if (normalized && isLeadIntakeSource(normalized)) return normalized

  const lineage =
    metadata.source_lineage && typeof metadata.source_lineage === "object"
      ? (metadata.source_lineage as Record<string, unknown>)
      : null
  const lineageSource = asString(lineage?.intake_source)
  if (lineageSource && isLeadIntakeSource(lineageSource)) return lineageSource

  const siteKey = asString(metadata.intake_site_key) || asString(metadata.intakeSiteKey)
  if (siteKey === "prospect_search_external_discovery") return "datamoon"

  if (metadata.datamoon && typeof metadata.datamoon === "object") return "datamoon"

  const prospectSearch =
    metadata.prospect_search && typeof metadata.prospect_search === "object"
      ? (metadata.prospect_search as Record<string, unknown>)
      : null
  if (asString(prospectSearch?.source_type) === "external_discovered") return "datamoon"

  return "manual"
}

export type GrowthLeadAdmissionLeadRow = {
  id: string
  company_name: string | null
  contact_name?: string | null
  contact_email?: string | null
  website?: string | null
  status?: string | null
  metadata?: Record<string, unknown> | null
  industry?: string | null
}

export function buildGrowthLeadAdmissionIntakeFromLead(
  lead: GrowthLeadAdmissionLeadRow,
): GrowthLeadAdmissionIntakeInput {
  const metadata =
    lead.metadata && typeof lead.metadata === "object" ? lead.metadata : {}
  const datamoon =
    metadata.datamoon && typeof metadata.datamoon === "object"
      ? (metadata.datamoon as Record<string, unknown>)
      : {}

  return {
    companyName: lead.company_name?.trim() ?? "",
    website: lead.website,
    domain: normalizeDomain(lead.website),
    industry: lead.industry ?? null,
    email: lead.contact_email ?? null,
    contactName: lead.contact_name ?? null,
    identityUncertain: metadata.identity_uncertain === true,
    source: resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata(metadata),
    metadata: {
      ...metadata,
      business_email:
        typeof datamoon.business_email === "string"
          ? datamoon.business_email
          : typeof metadata.business_email === "string"
            ? metadata.business_email
            : null,
    },
  }
}

export function redactEmail(email: string | null | undefined): string | null {
  if (!email?.trim()) return null
  const [local, domain] = email.trim().toLowerCase().split("@")
  if (!local || !domain) return "[redacted]"
  const visible = local.length <= 2 ? "*" : `${local.slice(0, 2)}***`
  return `${visible}@${domain}`
}

export function redactLeadSample(lead: {
  id: string
  company_name: string | null
  contact_email?: string | null
  website?: string | null
  status?: string | null
}): Record<string, unknown> {
  return {
    id: lead.id,
    company_name: lead.company_name,
    contact_email: redactEmail(lead.contact_email),
    website: lead.website,
    status: lead.status,
  }
}
