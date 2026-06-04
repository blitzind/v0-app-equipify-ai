import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_EMAIL_DISCOVERY_ROLE_PAIRS_QA_MARKER =
  "growth-email-discovery-role-pairs-7.3a-v1" as const

export type EmailDiscoveryRolePairRow = {
  role_id: string
  company_id: string
  person_id: string
  company_name: string
  person_name: string
  title: string
  domain: string
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function displayPersonName(row: {
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
}): string {
  const full = asString(row.full_name)
  if (full) return full
  const parts = [asString(row.first_name), asString(row.last_name)].filter(Boolean)
  return parts.join(" ") || "Unknown person"
}

function normalizeSearchToken(value: string): string {
  return value.trim().toLowerCase()
}

function rowMatchesQuery(row: EmailDiscoveryRolePairRow, q: string): boolean {
  const needle = normalizeSearchToken(q)
  if (!needle) return true
  const haystack = [
    row.company_name,
    row.person_name,
    row.title,
    row.domain,
    row.company_id,
    row.person_id,
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(needle)
}

export async function loadEmailDiscoveryRolePairs(
  admin: SupabaseClient,
  input: {
    q?: string
    limit?: number
    company_id?: string
    person_id?: string
  } = {},
): Promise<EmailDiscoveryRolePairRow[]> {
  const limit = Math.min(Math.max(input.limit ?? 250, 1), 500)
  const companyId = asString(input.company_id)
  const personId = asString(input.person_id)

  let rolesQuery = admin
    .schema("growth")
    .from("person_company_roles")
    .select("id, company_id, person_id, title")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (companyId) rolesQuery = rolesQuery.eq("company_id", companyId)
  if (personId) rolesQuery = rolesQuery.eq("person_id", personId)

  const { data: roles, error: rolesErr } = await rolesQuery
  if (rolesErr) {
    throw new Error(`loadEmailDiscoveryRolePairs roles: ${rolesErr.message}`)
  }

  const roleRows = roles ?? []
  if (roleRows.length === 0) return []

  const companyIds = [...new Set(roleRows.map((r) => asString((r as { company_id: string }).company_id)).filter(Boolean))]
  const personIds = [...new Set(roleRows.map((r) => asString((r as { person_id: string }).person_id)).filter(Boolean))]

  const companyById = new Map<string, { display_name: string; primary_domain: string }>()
  if (companyIds.length > 0) {
    const { data: companies, error: cErr } = await admin
      .schema("growth")
      .from("companies")
      .select("id, display_name, primary_domain")
      .in("id", companyIds)
    if (cErr) throw new Error(`loadEmailDiscoveryRolePairs companies: ${cErr.message}`)
    for (const c of companies ?? []) {
      const id = asString((c as { id: string }).id)
      companyById.set(id, {
        display_name: asString((c as { display_name: string }).display_name) || "Unknown company",
        primary_domain: asString((c as { primary_domain: string | null }).primary_domain),
      })
    }
  }

  const personById = new Map<string, string>()
  if (personIds.length > 0) {
    const { data: persons, error: pErr } = await admin
      .schema("growth")
      .from("persons")
      .select("id, full_name, first_name, last_name")
      .in("id", personIds)
    if (pErr) throw new Error(`loadEmailDiscoveryRolePairs persons: ${pErr.message}`)
    for (const p of persons ?? []) {
      const id = asString((p as { id: string }).id)
      personById.set(id, displayPersonName(p as { full_name?: string; first_name?: string; last_name?: string }))
    }
  }

  const merged: EmailDiscoveryRolePairRow[] = roleRows.map((r) => {
    const role = r as { id: string; company_id: string; person_id: string; title?: string | null }
    const cid = asString(role.company_id)
    const pid = asString(role.person_id)
    const company = companyById.get(cid)
    return {
      role_id: asString(role.id),
      company_id: cid,
      person_id: pid,
      company_name: company?.display_name ?? "Unknown company",
      person_name: personById.get(pid) ?? "Unknown person",
      title: asString(role.title),
      domain: company?.primary_domain ?? "",
    }
  })

  const q = asString(input.q)
  if (!q) return merged
  return merged.filter((row) => rowMatchesQuery(row, q))
}

export function findEmailDiscoveryRolePair(
  pairs: readonly EmailDiscoveryRolePairRow[],
  companyId: string,
  personId: string,
): EmailDiscoveryRolePairRow | null {
  const cid = asString(companyId)
  const pid = asString(personId)
  if (!cid || !pid) return null
  return pairs.find((r) => r.company_id === cid && r.person_id === pid) ?? null
}
