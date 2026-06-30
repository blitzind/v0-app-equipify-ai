import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  normalizeCompanyName,
  normalizeEmail,
  normalizeLinkedIn,
  normalizePhone,
  normalizeWebsiteDomain,
} from "@/lib/growth/import/normalize"
import type { DatamoonNormalizedLeadRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

export type DatamoonAudienceDedupeMatch = {
  leadId: string
  rule: "email" | "linkedin_url" | "phone" | "company_domain"
  confidence: number
  dedupeKey: string
}

type LeadDedupeRow = {
  id: string
  company_name: string
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  metadata: Record<string, unknown> | null
}

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

export async function findDatamoonAudienceDedupeMatch(
  admin: SupabaseClient,
  normalized: DatamoonNormalizedLeadRecord,
): Promise<DatamoonAudienceDedupeMatch | null> {
  const candidates: DatamoonAudienceDedupeMatch[] = []

  const email = normalizeEmail(normalized.email)
  if (email) {
    const { data } = await growthLeadsTable(admin)
      .select("id")
      .ilike("contact_email", email)
      .limit(1)
    const match = (data?.[0] as { id: string } | undefined) ?? null
    if (match) {
      candidates.push({ leadId: match.id, rule: "email", confidence: 0.95, dedupeKey: email })
    }
  }

  const linkedin = normalizeLinkedIn(normalized.linkedin_url)
  if (linkedin) {
    const { data } = await growthLeadsTable(admin)
      .select("id, metadata")
      .contains("metadata", { import: { linkedin } })
      .limit(1)
    const match = (data?.[0] as { id: string } | undefined) ?? null
    if (match) {
      candidates.push({
        leadId: match.id,
        rule: "linkedin_url",
        confidence: 0.9,
        dedupeKey: linkedin,
      })
    } else {
      const { data: metaRows } = await growthLeadsTable(admin)
        .select("id, metadata")
        .not("metadata", "is", null)
        .limit(200)
      for (const row of (metaRows ?? []) as Array<{ id: string; metadata: Record<string, unknown> | null }>) {
        const datamoonMeta = row.metadata?.datamoon as { linkedin_url?: string } | undefined
        if (normalizeLinkedIn(datamoonMeta?.linkedin_url) === linkedin) {
          candidates.push({
            leadId: row.id,
            rule: "linkedin_url",
            confidence: 0.88,
            dedupeKey: linkedin,
          })
          break
        }
      }
    }
  }

  const phone = normalizePhone(normalized.phone)
  if (phone) {
    const { data } = await growthLeadsTable(admin)
      .select("id, contact_phone")
      .not("contact_phone", "is", null)
      .limit(200)
    for (const row of (data ?? []) as LeadDedupeRow[]) {
      if (normalizePhone(row.contact_phone) === phone) {
        candidates.push({ leadId: row.id, rule: "phone", confidence: 0.85, dedupeKey: phone })
        break
      }
    }
  }

  const domain = normalizeWebsiteDomain(normalized.company_domain)
  const company = normalizeCompanyName(normalized.company_name)
  if (domain) {
    const { data } = await growthLeadsTable(admin)
      .select("id, company_name, website")
      .not("website", "is", null)
      .limit(200)
    for (const row of (data ?? []) as LeadDedupeRow[]) {
      if (normalizeWebsiteDomain(row.website) === domain) {
        if (!company || normalizeCompanyName(row.company_name) === company) {
          candidates.push({
            leadId: row.id,
            rule: "company_domain",
            confidence: company ? 0.82 : 0.75,
            dedupeKey: domain,
          })
          break
        }
      }
    }
  }

  if (candidates.length === 0) return null
  return candidates.sort((a, b) => b.confidence - a.confidence)[0]!
}
