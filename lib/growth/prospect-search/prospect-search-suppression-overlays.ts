import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeEmail } from "@/lib/growth/import/normalize"

export const GROWTH_PROSPECT_SEARCH_SUPPRESSION_QA_MARKER =
  "growth-prospect-search-suppression-v1" as const

export type ProspectSearchSuppressionOverlay = {
  is_suppressed: boolean
  suppression_reason: string | null
  suppression_scope: string | null
  suppressed_at: string | null
}

export type ProspectSearchSuppressionLookup = {
  matchForIdentifiers(input: {
    website?: string | null
    company_name?: string | null
    growth_lead_id?: string | null
    email?: string | null
    phone?: string | null
  }): ProspectSearchSuppressionOverlay | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeDomain(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const raw = value.trim().toLowerCase()
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`)
    return url.hostname.replace(/^www\./, "") || null
  } catch {
    return raw.replace(/^www\./, "").split("/")[0] || null
  }
}

function emailDomain(email: string): string | null {
  const at = email.indexOf("@")
  if (at <= 0) return null
  return email.slice(at + 1).toLowerCase() || null
}

function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function overlayFromRow(row: {
  reason?: unknown
  suppressed_at?: unknown
  scope: string
}): ProspectSearchSuppressionOverlay {
  return {
    is_suppressed: true,
    suppression_reason: asString(row.reason) || null,
    suppression_scope: row.scope,
    suppressed_at: asString(row.suppressed_at) || null,
  }
}

export async function loadProspectSearchSuppressionLookup(
  admin: SupabaseClient,
): Promise<ProspectSearchSuppressionLookup> {
  const byEmail = new Map<string, ProspectSearchSuppressionOverlay>()
  const byDomain = new Map<string, ProspectSearchSuppressionOverlay>()
  const byLeadId = new Map<string, ProspectSearchSuppressionOverlay>()
  const byCompanyName = new Map<string, ProspectSearchSuppressionOverlay>()

  try {
    const { data } = await admin
      .schema("growth")
      .from("suppression_entries")
      .select("email, reason, lead_id, suppressed_at")
      .order("suppressed_at", { ascending: false })
      .limit(500)

    const leadIds = new Set<string>()
    for (const raw of data ?? []) {
      const row = raw as Record<string, unknown>
      const email = normalizeEmail(asString(row.email))
      if (!email) continue
      const overlay = overlayFromRow({ reason: row.reason, suppressed_at: row.suppressed_at, scope: "email" })
      if (!byEmail.has(email)) byEmail.set(email, overlay)

      const domain = emailDomain(email)
      if (domain && !byDomain.has(domain)) byDomain.set(domain, overlay)

      const leadId = asString(row.lead_id)
      if (leadId) {
        leadIds.add(leadId)
        if (!byLeadId.has(leadId)) byLeadId.set(leadId, overlay)
      }
    }

    if (leadIds.size > 0) {
      const { data: leads } = await admin
        .schema("growth")
        .from("leads")
        .select("id, company_name, website, contact_temperature")
        .in("id", [...leadIds].slice(0, 200))

      for (const raw of leads ?? []) {
        const row = raw as Record<string, unknown>
        const leadId = asString(row.id)
        const overlay = byLeadId.get(leadId)
        if (!overlay) continue

        const name = normalizeCompanyName(asString(row.company_name))
        if (name && !byCompanyName.has(name)) byCompanyName.set(name, overlay)

        const domain = normalizeDomain(asString(row.website))
        if (domain && !byDomain.has(domain)) byDomain.set(domain, overlay)

        if (row.contact_temperature === "suppressed" && leadId && !byLeadId.has(leadId)) {
          byLeadId.set(
            leadId,
            overlayFromRow({
              reason: "manual",
              suppressed_at: null,
              scope: "lead",
            }),
          )
        }
      }
    }
  } catch {
    /* optional table */
  }

  return {
    matchForIdentifiers(input) {
      const email = normalizeEmail(input.email ?? undefined)
      if (email && byEmail.has(email)) return byEmail.get(email)!

      const domain = normalizeDomain(input.website)
      if (domain && byDomain.has(domain)) return byDomain.get(domain)!

      const leadId = asString(input.growth_lead_id)
      if (leadId && byLeadId.has(leadId)) return byLeadId.get(leadId)!

      const name = normalizeCompanyName(asString(input.company_name))
      if (name && byCompanyName.has(name)) return byCompanyName.get(name)!

      return null
    },
  }
}

export function applyProspectSearchSuppressionOverlay<
  T extends {
    website: string | null
    company_name: string
    growth_lead_id: string | null
    is_suppressed?: boolean
    suppression_reason?: string | null
    suppression_scope?: string | null
    suppressed_at?: string | null
  },
>(row: T, lookup: ProspectSearchSuppressionLookup): T {
  const match = lookup.matchForIdentifiers({
    website: row.website,
    company_name: row.company_name,
    growth_lead_id: row.growth_lead_id,
  })
  if (!match) {
    return {
      ...row,
      is_suppressed: row.is_suppressed ?? false,
      suppression_reason: row.suppression_reason ?? null,
      suppression_scope: row.suppression_scope ?? null,
      suppressed_at: row.suppressed_at ?? null,
    }
  }
  return {
    ...row,
    is_suppressed: true,
    suppression_reason: match.suppression_reason,
    suppression_scope: match.suppression_scope,
    suppressed_at: match.suppressed_at,
  }
}
