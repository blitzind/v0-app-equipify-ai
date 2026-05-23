import type { SupabaseClient } from "@supabase/supabase-js"
import {
  normalizeCompanyName,
  normalizeEmail,
  normalizeLinkedIn,
  normalizePhone,
  normalizeWebsiteDomain,
} from "@/lib/growth/import/normalize"
import type { DedupeMatch, NormalizedImportRow } from "@/lib/growth/import/types"

type LeadDedupeRow = {
  id: string
  company_name: string
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  external_ref: string | null
  metadata: Record<string, unknown> | null
}

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function findImportDedupeMatch(
  admin: SupabaseClient,
  input: {
    vendorKey: string
    row: NormalizedImportRow
    externalRef: string | null
  },
): Promise<DedupeMatch | null> {
  const candidates: DedupeMatch[] = []

  if (input.externalRef) {
    const { data } = await growthLeadsTable(admin)
      .select("id, company_name, contact_email, contact_phone, website, external_ref, metadata")
      .eq("source_kind", "import")
      .eq("external_ref", input.externalRef)
      .limit(1)
    const match = (data?.[0] as LeadDedupeRow | undefined) ?? null
    if (match) {
      return {
        leadId: match.id,
        rule: "external_ref",
        confidence: 1,
        dedupeKey: input.externalRef,
      }
    }
  }

  const email = normalizeEmail(input.row.email)
  if (email) {
    const { data } = await growthLeadsTable(admin)
      .select("id, company_name, contact_email, contact_phone, website, external_ref, metadata")
      .ilike("contact_email", email)
      .limit(1)
    const match = (data?.[0] as LeadDedupeRow | undefined) ?? null
    if (match) {
      candidates.push({ leadId: match.id, rule: "email", confidence: 0.9, dedupeKey: email })
    }
  }

  const phone = normalizePhone(input.row.phone)
  if (phone) {
    const { data } = await growthLeadsTable(admin)
      .select("id, company_name, contact_email, contact_phone, website, external_ref, metadata")
      .not("contact_phone", "is", null)
      .limit(200)
    for (const row of (data ?? []) as LeadDedupeRow[]) {
      if (normalizePhone(row.contact_phone) === phone) {
        candidates.push({ leadId: row.id, rule: "phone", confidence: 0.85, dedupeKey: phone })
        break
      }
    }
  }

  const linkedin = normalizeLinkedIn(input.row.linkedinUrl)
  if (linkedin) {
    const { data } = await growthLeadsTable(admin)
      .select("id, metadata")
      .contains("metadata", { import: { linkedin: linkedin } })
      .limit(1)
    const match = (data?.[0] as { id: string } | undefined) ?? null
    if (match) {
      candidates.push({ leadId: match.id, rule: "linkedin", confidence: 0.88, dedupeKey: linkedin })
    }
  }

  const company = normalizeCompanyName(input.row.companyName)
  const domain = normalizeWebsiteDomain(input.row.website)
  if (company && domain) {
    const { data } = await growthLeadsTable(admin)
      .select("id, company_name, website")
      .not("website", "is", null)
      .limit(200)
    for (const row of (data ?? []) as LeadDedupeRow[]) {
      if (
        normalizeWebsiteDomain(row.website) === domain &&
        normalizeCompanyName(row.company_name) === company
      ) {
        candidates.push({
          leadId: row.id,
          rule: "website_company",
          confidence: 0.95,
          dedupeKey: `${domain}|${company}`,
        })
        break
      }
    }
  }

  if (candidates.length === 0) return null
  return candidates.sort((a, b) => b.confidence - a.confidence)[0] ?? null
}

export function proposeImportRowAction(
  match: DedupeMatch | null,
  strategy: "skip_high_confidence" | "merge_empty_fields" | "create_new",
): "create_new" | "merge" | "skip" {
  if (strategy === "create_new") return "create_new"
  if (!match) return "create_new"
  if (strategy === "skip_high_confidence" && match.confidence >= 0.85) return "skip"
  if (strategy === "merge_empty_fields" && match.confidence >= 0.7) return "merge"
  if (match.confidence >= 0.85) return "skip"
  if (match.confidence >= 0.7) return "merge"
  return "create_new"
}
