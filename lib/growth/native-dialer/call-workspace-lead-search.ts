import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizePhone } from "@/lib/growth/import/normalize"

export type CallWorkspaceLeadSearchResult = {
  leadId: string
  companyName: string
  contactName: string | null
  contactPhone: string | null
}

export async function searchCallWorkspaceLeads(
  admin: SupabaseClient,
  query: string,
): Promise<CallWorkspaceLeadSearchResult[]> {
  const trimmed = query.trim()
  const phoneDigits = normalizePhone(trimmed)

  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, contact_name, contact_phone, status")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(80)
  if (error) throw new Error(error.message)

  const needle = trimmed.toLowerCase()
  const filtered = (data ?? []).filter((row) => {
    const company = String(row.company_name ?? "").toLowerCase()
    const contact = String(row.contact_name ?? "").toLowerCase()
    const phone = normalizePhone(row.contact_phone as string | null)
    if (phoneDigits && phone === phoneDigits) return true
    return company.includes(needle) || contact.includes(needle) || String(row.contact_phone ?? "").includes(trimmed)
  })

  return filtered.slice(0, 12).map((row) => ({
    leadId: row.id as string,
    companyName: row.company_name as string,
    contactName: (row.contact_name as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
  }))
}
