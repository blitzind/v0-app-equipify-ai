/** GE-AIOS-21C-4 — Map persisted leads to canonical admission intake (client-safe). */

import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import type { GrowthLeadAdmissionIntakeInput } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"

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
    source:
      typeof metadata.unified_intake_source === "string"
        ? (metadata.unified_intake_source as GrowthLeadAdmissionIntakeInput["source"])
        : "manual",
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
