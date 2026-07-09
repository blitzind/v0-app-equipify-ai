/** GE-AIOS-15C — Infer intake binding source from lead create input (client-safe). */

import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import type { CreateGrowthLeadInput } from "@/lib/growth/types"
import type { IntakeRelationshipBindingSource } from "@/lib/growth/relationship/intake-relationship-graph-binding"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function inferIntakeBindingSource(
  input: Pick<
    CreateGrowthLeadInput,
    "intakeBindingSource" | "sourceKind" | "sourceVendor" | "sourceDetail" | "metadata"
  >,
): IntakeRelationshipBindingSource | null {
  if (input.intakeBindingSource) return input.intakeBindingSource

  const metadata = input.metadata ?? {}
  if (metadata.datamoon) return "datamoon"
  if (metadata.browser_extension || metadata.browser_extension_captures) return "browser_capture"
  if (metadata.acquisition || metadata.leadInboxDedupeHash || metadata.intake_site_key) {
    return "discovery_import"
  }

  const unifiedSource = asString(metadata.unified_intake_source)
  if (unifiedSource === "saved_search" || unifiedSource === "datamoon") {
    return unifiedSource === "datamoon" ? "datamoon" : "discovery_import"
  }

  if (input.sourceVendor === "datamoon" || asString(input.sourceDetail).includes("datamoon")) {
    return "datamoon"
  }
  if (input.sourceKind === "browser_extension") return "browser_capture"
  if (input.sourceKind === "acquisition") return "discovery_import"
  if (input.sourceKind === "import" && input.sourceVendor === "datamoon") return "datamoon"
  if (input.sourceKind === "manual") return "manual_lead"
  if (input.sourceKind === "import") return "discovery_import"

  return null
}

export function buildIntakeBindingInputFromCreateLead(
  input: CreateGrowthLeadInput,
  leadId?: string | null,
): {
  source: IntakeRelationshipBindingSource
  bindInput: Omit<
    import("@/lib/growth/relationship/bind-intake-relationship-graph").BindIntakeRelationshipGraphInput,
    "source"
  >
} | null {
  const source = inferIntakeBindingSource(input)
  if (!source) return null

  const metadata = input.metadata ?? {}
  const datamoonMeta =
    metadata.datamoon && typeof metadata.datamoon === "object"
      ? (metadata.datamoon as Record<string, unknown>)
      : null
  const linkedinUrl =
    asString(metadata.linkedin_url) ||
    asString(datamoonMeta?.linkedin_url) ||
    asString((metadata.import as Record<string, unknown> | undefined)?.linkedin) ||
    null
  const domain =
    canonicalNormalizedDomain(
      asString(datamoonMeta?.company_domain) || asString(metadata.company_domain) || null,
      input.website ?? null,
    ) ?? null

  return {
    source,
    bindInput: {
      lead_id: leadId ?? null,
      company_name: input.companyName,
      website: input.website ?? null,
      domain,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? null,
      contact_name: input.contactName ?? null,
      contact_email: input.contactEmail ?? null,
      contact_phone: input.contactPhone ?? null,
      linkedin_url: linkedinUrl,
      contact_title: asString(metadata.contact_title) || null,
      existing_metadata: metadata,
      source_lineage: {
        source_kind: input.sourceKind ?? null,
        source_detail: input.sourceDetail ?? null,
        external_ref: input.externalRef ?? null,
        source_vendor: input.sourceVendor ?? null,
        source_channel: input.sourceChannel ?? null,
      },
    },
  }
}
