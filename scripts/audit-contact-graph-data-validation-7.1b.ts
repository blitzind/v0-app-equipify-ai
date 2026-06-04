/**
 * Phase 7.1B/7.1C — Contact Graph data validation + production certification (read-only).
 * Run: pnpm tsx scripts/audit-contact-graph-data-validation-7.1b.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or .env.local.active JWT / sb_secret).
 */
import { readFileSync } from "node:fs"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { normalizeDomain } from "../lib/growth/company-identification/company-identification-normalize"
import {
  normalizeCompanyName,
  normalizeEmail,
  normalizeLinkedIn,
  normalizePhone,
  normalizeWebsiteDomain,
} from "../lib/growth/import/normalize"
import {
  normalizeContactIdentityEmail,
  normalizeContactIdentityLinkedIn,
  normalizeContactIdentityPhone,
} from "../lib/growth/prospect-search/prospect-search-contact-identity-normalize"

function loadEnvFile(path: string): void {
  try {
    const raw = readFileSync(path, "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq)
      let value = trimmed.slice(eq + 1)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    /* optional */
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function pct(n: number, d: number): string {
  if (d === 0) return "0.0%"
  return `${((100 * n) / d).toFixed(1)}%`
}

function normCompanyImport(name: string | null | undefined): string | null {
  return normalizeCompanyName(name)
}

function normCompanyId(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, 200)
}

type CompanyRow = {
  id: string
  company_name: string
  website: string | null
  domain: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  dedupe_hash: string | null
}

async function fetchAll<T extends Record<string, unknown>>(
  admin: SupabaseClient,
  table: string,
  select: string,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await admin
      .schema("growth")
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function fetchAllPublic<T extends Record<string, unknown>>(
  admin: SupabaseClient,
  table: string,
  select: string,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await admin.from(table).select(select).range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

function companyFieldStats(rows: CompanyRow[], label: string) {
  const total = rows.length
  const withDomain = rows.filter((r) => normalizeDomain(r.domain) || normalizeWebsiteDomain(r.website)).length
  const withWebsite = rows.filter((r) => asString(r.website)).length
  const withPhone = rows.filter((r) => asString(r.phone)).length
  const withAddress = rows.filter((r) => asString(r.address) || asString(r.city)).length
  return { label, total, withDomain, withWebsite, withPhone, withAddress }
}

function collapseByKey<T>(rows: T[], keyFn: (r: T) => string | null): { groups: number; singletons: number } {
  const map = new Map<string, number>()
  let nullKey = 0
  for (const r of rows) {
    const k = keyFn(r)
    if (!k) {
      nullKey++
      continue
    }
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  const groups = map.size
  const recordsInGroups = [...map.values()].reduce((a, b) => a + b, 0)
  const duplicateRecords = recordsInGroups - groups
  return {
    groups,
    recordsWithKey: recordsInGroups,
    nullKey,
    duplicateRecords,
    duplicatePct: recordsInGroups > 0 ? duplicateRecords / recordsInGroups : 0,
  }
}

function loadActiveSupabaseCredentials(): void {
  try {
    const raw = readFileSync(".env.local.active", "utf8")
    const jwtKeys: string[] = []
    let sbSecret = ""
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
        let value = trimmed.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim()
        value = value.replace(/^['"]+|['"]+$/g, "").replace(/\\$/g, "")
        if (value.startsWith("eyJ")) jwtKeys.push(value)
        else if (value.startsWith("sb_secret_")) sbSecret = value
      }
    }
    const jwt = jwtKeys
      .map((k) => k.replace(/\\+$/g, "").replace(/^['"]+|['"]+$/g, ""))
      .sort((a, b) => b.length - a.length)[0]
    const key = jwt ?? sbSecret.replace(/\\+$/g, "")
    const currentKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""
    const keyUsable = currentKey.startsWith("eyJ") || currentKey.startsWith("sb_secret_")
    if (key && (!keyUsable || currentKey.length < key.length)) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = key
    }
    if (jwt) {
      try {
        const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()) as {
          ref?: string
        }
        const currentUrl = (
          process.env.NEXT_PUBLIC_SUPABASE_URL ??
          process.env.SUPABASE_URL ??
          ""
        ).trim()
        if (payload.ref && !currentUrl.includes("supabase.co")) {
          process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${payload.ref}.supabase.co`
        }
      } catch {
        /* optional */
      }
    }
  } catch {
    /* optional */
  }
}

async function main() {
  for (const path of [".env.local", ".env.vercel.production", ".vercel/.env.production.local"]) {
    loadEnvFile(path)
  }
  loadActiveSupabaseCredentials()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(JSON.stringify({ error: "missing_supabase_credentials" }))
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const report: Record<string, unknown> = {
    qa_marker: "growth-contact-graph-data-validation-7.1c",
    generated_at: new Date().toISOString(),
    supabase_project_ref: url.replace(/^https?:\/\//, "").split(".")[0],
    supabase_url_host: url.replace(/^https?:\/\//, "").split(".")[0],
  }

  // --- Company inventories ---
  const ext = await fetchAll<CompanyRow>(
    admin,
    "external_company_candidates",
    "id, company_name, website, domain, phone, address, city, state, dedupe_hash",
  )
  const rw = await fetchAll<CompanyRow>(
    admin,
    "real_world_company_candidates",
    "id, company_name, website, domain, phone, address, city, state, dedupe_hash",
  )

  report.external_company_candidates = companyFieldStats(ext, "external")
  report.real_world_company_candidates = companyFieldStats(rw, "real_world")

  const psi = await fetchAll<{
    id: string
    source_type: string
    source_id: string
    company_name: string
    domain: string | null
    website: string | null
    phone: string | null
    city: string | null
    state: string | null
    normalized_company_name: string
    is_active: boolean
  }>(
    admin,
    "prospect_search_index",
    "id, source_type, source_id, company_name, domain, website, phone, city, state, normalized_company_name, is_active",
  )
  const psiActive = psi.filter((r) => r.is_active !== false)
  const psiBySource: Record<string, number> = {}
  for (const r of psiActive) {
    psiBySource[r.source_type] = (psiBySource[r.source_type] ?? 0) + 1
  }
  report.prospect_search_index = {
    total: psi.length,
    active: psiActive.length,
    by_source_type: psiBySource,
    with_domain: psiActive.filter((r) => normalizeDomain(r.domain) || normalizeWebsiteDomain(r.website))
      .length,
    with_website: psiActive.filter((r) => asString(r.website)).length,
    with_phone: psiActive.filter((r) => asString(r.phone)).length,
    with_address: psiActive.filter((r) => asString(r.city) || asString(r.state)).length,
  }

  const rels = await fetchAll<{
    id: string
    company_id: string
    related_company_id: string
    relationship_type: string
    relationship_strength: number
  }>(admin, "company_relationships", "id, company_id, related_company_id, relationship_type, relationship_strength")

  const relTypes: Record<string, number> = {}
  const companiesInRels = new Set<string>()
  for (const r of rels) {
    relTypes[r.relationship_type] = (relTypes[r.relationship_type] ?? 0) + 1
    companiesInRels.add(r.company_id)
    companiesInRels.add(r.related_company_id)
  }
  report.company_relationships = {
    total_edges: rels.length,
    unique_company_ids_touched: companiesInRels.size,
    by_type: relTypes,
    avg_edges_per_company:
      companiesInRels.size > 0 ? (rels.length * 2) / companiesInRels.size : 0,
  }

  // --- Domain / name duplication (per source) ---
  const domainNorm = (r: CompanyRow) =>
    normalizeDomain(r.domain) ?? normalizeWebsiteDomain(r.website)

  report.duplicate_analysis = {
    external: {
      exact_domain: collapseByKey(ext, (r) => asString(r.domain) || null),
      normalized_domain: collapseByKey(ext, domainNorm),
      normalized_name: collapseByKey(ext, (r) => normCompanyImport(r.company_name)),
      name_city: collapseByKey(
        ext,
        (r) =>
          `${normCompanyImport(r.company_name) ?? ""}|${asString(r.city).toLowerCase()}` || null,
      ),
      name_state: collapseByKey(
        ext,
        (r) =>
          `${normCompanyImport(r.company_name) ?? ""}|${asString(r.state).toLowerCase()}` || null,
      ),
      dedupe_hash_unique: new Set(ext.map((r) => r.dedupe_hash).filter(Boolean)).size,
      dedupe_hash_total: ext.filter((r) => r.dedupe_hash).length,
    },
    real_world: {
      exact_domain: collapseByKey(rw, (r) => asString(r.domain) || null),
      normalized_domain: collapseByKey(rw, domainNorm),
      normalized_name: collapseByKey(rw, (r) => normCompanyImport(r.company_name)),
      name_city: collapseByKey(
        rw,
        (r) =>
          `${normCompanyImport(r.company_name) ?? ""}|${asString(r.city).toLowerCase()}` || null,
      ),
      name_state: collapseByKey(
        rw,
        (r) =>
          `${normCompanyImport(r.company_name) ?? ""}|${asString(r.state).toLowerCase()}` || null,
      ),
      dedupe_hash_unique: new Set(rw.map((r) => r.dedupe_hash).filter(Boolean)).size,
      dedupe_hash_total: rw.filter((r) => r.dedupe_hash).length,
    },
  }

  // Cross-source overlap by normalized domain
  const extDomainMap = new Map<string, string[]>()
  for (const r of ext) {
    const d = domainNorm(r)
    if (!d) continue
    const list = extDomainMap.get(d) ?? []
    list.push(r.id)
    extDomainMap.set(d, list)
  }
  const rwDomainMap = new Map<string, string[]>()
  for (const r of rw) {
    const d = domainNorm(r)
    if (!d) continue
    const list = rwDomainMap.get(d) ?? []
    list.push(r.id)
    rwDomainMap.set(d, list)
  }
  let crossExtRw = 0
  let extDomains = 0
  for (const [d, ids] of extDomainMap) {
    extDomains++
    if ((rwDomainMap.get(d)?.length ?? 0) > 0) crossExtRw++
  }

  const leads = await fetchAll<{
    id: string
    company_name: string
    website: string | null
    contact_email: string | null
    contact_phone: string | null
    city: string | null
    state: string | null
    address_line1: string | null
  }>(
    admin,
    "leads",
    "id, company_name, website, contact_email, contact_phone, city, state, address_line1",
  )

  const leadRows = leads.map((l) => ({
    company_name: l.company_name,
    website: l.website,
    domain: normalizeWebsiteDomain(l.website) ?? (l.contact_email ? normalizeDomain(l.contact_email.split("@")[1]) : null),
    phone: l.contact_phone,
    address: l.address_line1,
    city: l.city,
    state: l.state,
  }))
  report.growth_leads = {
    label: "growth.leads",
    total: leads.length,
    withDomain: leadRows.filter((r) => r.domain).length,
    withWebsite: leadRows.filter((r) => asString(r.website)).length,
    withPhone: leadRows.filter((r) => asString(r.phone)).length,
    withAddress: leadRows.filter((r) => asString(r.address) || asString(r.city)).length,
  }

  const leadDomainMap = new Map<string, number>()
  for (const l of leads) {
    const d =
      normalizeWebsiteDomain(l.website) ??
      (l.contact_email ? normalizeDomain(l.contact_email.split("@")[1]) : null)
    if (!d) continue
    leadDomainMap.set(d, (leadDomainMap.get(d) ?? 0) + 1)
  }
  let crossLeadExt = 0
  for (const d of extDomainMap.keys()) {
    if (leadDomainMap.has(d)) crossLeadExt++
  }
  let crossLeadRw = 0
  for (const d of rwDomainMap.keys()) {
    if (leadDomainMap.has(d)) crossLeadRw++
  }

  const psiDomainSet = new Set(
    psiActive.map((r) => normalizeDomain(r.domain)).filter(Boolean) as string[],
  )
  let crossPsiExt = 0
  for (const d of extDomainMap.keys()) {
    if (psiDomainSet.has(d)) crossPsiExt++
  }
  let crossPsiRw = 0
  for (const d of rwDomainMap.keys()) {
    if (psiDomainSet.has(d)) crossPsiRw++
  }
  let crossLeadPsi = 0
  for (const d of leadDomainMap.keys()) {
    if (psiDomainSet.has(d)) crossLeadPsi++
  }

  report.cross_source_overlap = {
    external_domains_with_normalized_domain: extDomains,
    real_world_domains_with_normalized_domain: rwDomainMap.size,
    domains_in_both_ext_and_rw: crossExtRw,
    pct_ext_domains_also_in_rw: pct(crossExtRw, extDomains),
    leads_with_normalized_domain: leadDomainMap.size,
    ext_domains_also_in_leads: crossLeadExt,
    pct_ext_domains_also_in_leads: pct(crossLeadExt, extDomains),
    rw_domains_also_in_leads: crossLeadRw,
    psi_active_domains: psiDomainSet.size,
    ext_domains_also_in_psi: crossPsiExt,
    rw_domains_also_in_psi: crossPsiRw,
    pct_rw_domains_also_in_psi: pct(crossPsiRw, rwDomainMap.size),
    lead_domains_also_in_psi: crossLeadPsi,
    pct_lead_domains_also_in_psi: pct(crossLeadPsi, leadDomainMap.size),
    estimated_canonical_companies_by_normalized_domain: new Set([
      ...extDomainMap.keys(),
      ...rwDomainMap.keys(),
      ...leadDomainMap.keys(),
      ...psiDomainSet,
    ]).size,
    raw_company_rows_ext_plus_rw: ext.length + rw.length,
    compression_ratio_domain_union:
      ext.length + rw.length > 0
        ? new Set([...extDomainMap.keys(), ...rwDomainMap.keys()]).size / (ext.length + rw.length)
        : 0,
  }

  // --- Contacts ---
  const cc = await fetchAll<{
    id: string
    company_id: string
    full_name: string
    title: string | null
    email: string | null
    phone: string | null
    linkedin_url: string | null
    growth_lead_id: string | null
    contact_candidate_id: string | null
    lead_decision_maker_id: string | null
  }>(
    admin,
    "company_contacts",
    "id, company_id, full_name, title, email, phone, linkedin_url, growth_lead_id, contact_candidate_id, lead_decision_maker_id",
  )

  const cand = await fetchAll<{
    id: string
    company_candidate_id: string
    full_name: string
    job_title: string | null
    email: string | null
    phone: string | null
    linkedin_url: string | null
  }>(
    admin,
    "contact_candidates",
    "id, company_candidate_id, full_name, job_title, email, phone, linkedin_url",
  )

  const dm = await fetchAll<{
    id: string
    lead_id: string
    full_name: string
    title: string | null
    email: string | null
    phone: string | null
    linkedin_url: string | null
    status: string
  }>(admin, "lead_decision_makers", "id, lead_id, full_name, title, email, phone, linkedin_url, status")

  function contactStats(
    rows: Array<{
      email: string | null
      phone: string | null
      linkedin_url: string | null
      title?: string | null
      job_title?: string | null
    }>,
    label: string,
  ) {
    const total = rows.length
    return {
      label,
      total,
      with_email: rows.filter((r) => asString(r.email)).length,
      with_phone: rows.filter((r) => asString(r.phone)).length,
      with_linkedin: rows.filter((r) => asString(r.linkedin_url)).length,
      with_title: rows.filter((r) => asString(r.title ?? r.job_title)).length,
    }
  }

  report.contacts = {
    company_contacts: contactStats(cc, "company_contacts"),
    contact_candidates: contactStats(
      cand.map((r) => ({ ...r, title: r.job_title })),
      "contact_candidates",
    ),
    lead_decision_makers: contactStats(
      dm.filter((r) => r.status !== "rejected"),
      "lead_decision_makers",
    ),
  }

  // Email / phone / linkedin quality
  function channelQuality(
    emails: (string | null)[],
    phones: (string | null)[],
    linkedins: (string | null)[],
    normalizeEmailFn: (e: string | null) => string | null,
    normalizePhoneFn: (p: string | null) => string | null,
    normalizeLiFn: (l: string | null) => string | null,
  ) {
    const emailNorm = emails.map(normalizeEmailFn).filter(Boolean) as string[]
    const phoneNorm = phones.map(normalizePhoneFn).filter(Boolean) as string[]
    const liNorm = linkedins.map(normalizeLiFn).filter(Boolean) as string[]
    const emailSet = new Set(emailNorm)
    const phoneSet = new Set(phoneNorm)
    const liSet = new Set(liNorm)
    const totalRows = emails.length
    return {
      email_null: totalRows - emails.filter((e) => asString(e)).length,
      email_present: emails.filter((e) => asString(e)).length,
      email_unique_normalized: emailSet.size,
      email_duplicate_normalized: emailNorm.length - emailSet.size,
      phone_present: phones.filter((p) => asString(p)).length,
      phone_unique_normalized: phoneSet.size,
      phone_duplicate_normalized: phoneNorm.length - phoneSet.size,
      linkedin_present: linkedins.filter((l) => asString(l)).length,
      linkedin_unique_normalized: liSet.size,
      linkedin_duplicate_normalized: liNorm.length - liSet.size,
    }
  }

  report.contact_quality = {
    company_contacts: channelQuality(
      cc.map((r) => r.email),
      cc.map((r) => r.phone),
      cc.map((r) => r.linkedin_url),
      normalizeEmail,
      normalizePhone,
      (l) => normalizeLinkedIn(l) ?? normalizeContactIdentityLinkedIn(l),
    ),
    contact_candidates: channelQuality(
      cand.map((r) => r.email),
      cand.map((r) => r.phone),
      cand.map((r) => r.linkedin_url),
      normalizeContactIdentityEmail,
      normalizeContactIdentityPhone,
      normalizeContactIdentityLinkedIn,
    ),
    lead_decision_makers: channelQuality(
      dm.map((r) => r.email),
      dm.map((r) => r.phone),
      dm.map((r) => r.linkedin_url),
      normalizeEmail,
      normalizePhone,
      (l) => normalizeLinkedIn(l) ?? normalizeContactIdentityLinkedIn(l),
    ),
  }

  // Cross-store email overlap
  const ccEmails = new Set(
    cc.map((r) => normalizeEmail(r.email)).filter(Boolean) as string[],
  )
  const candEmails = new Set(
    cand.map((r) => normalizeContactIdentityEmail(r.email)).filter(Boolean) as string[],
  )
  const dmEmails = new Set(
    dm.map((r) => normalizeEmail(r.email)).filter(Boolean) as string[],
  )
  let candInCc = 0
  for (const e of candEmails) if (ccEmails.has(e)) candInCc++
  let dmInCc = 0
  for (const e of dmEmails) if (ccEmails.has(e)) dmInCc++

  report.contact_cross_store = {
    company_contacts_unique_emails: ccEmails.size,
    contact_candidates_unique_emails: candEmails.size,
    decision_makers_unique_emails: dmEmails.size,
    candidate_emails_also_in_company_contacts: candInCc,
    pct_candidate_emails_in_cc: pct(candInCc, candEmails.size),
    dm_emails_also_in_company_contacts: dmInCc,
    pct_dm_emails_in_cc: pct(dmInCc, dmEmails.size),
  }

  // --- Identity resolution simulation (companies) ---
  const canonicalByDomain = new Map<string, string>()
  let canonicalCounter = 0
  function resolveCompanyId(r: CompanyRow): string | null {
    const d = domainNorm(r)
    if (d) {
      if (!canonicalByDomain.has(d)) canonicalByDomain.set(d, `c-${++canonicalCounter}`)
      return canonicalByDomain.get(d)!
    }
    return null
  }

  type CompanyResolutionBucket = {
    exact_domain: number
    normalized_domain: number
    name_city_review: number
    name_state_review: number
    unresolved: number
  }

  function simulateCompanyResolution(rows: CompanyRow[]): CompanyResolutionBucket {
    const out: CompanyResolutionBucket = {
      exact_domain: 0,
      normalized_domain: 0,
      name_city_review: 0,
      name_state_review: 0,
      unresolved: 0,
    }
    for (const r of rows) {
      const exactDom = asString(r.domain)
      const normDom = domainNorm(r)
      if (exactDom) {
        out.exact_domain++
        if (normDom) out.normalized_domain++
        resolveCompanyId(r)
      } else if (normDom) {
        out.normalized_domain++
        resolveCompanyId(r)
      } else if (normCompanyImport(r.company_name) && asString(r.city)) {
        out.name_city_review++
      } else if (normCompanyImport(r.company_name) && asString(r.state)) {
        out.name_state_review++
      } else {
        out.unresolved++
      }
    }
    return out
  }

  const extRes = simulateCompanyResolution(ext)
  const rwRes = simulateCompanyResolution(rw)
  const combinedTotal = ext.length + rw.length
  const combined = {
    exact_domain: extRes.exact_domain + rwRes.exact_domain,
    normalized_domain: extRes.normalized_domain + rwRes.normalized_domain,
    name_city_review: extRes.name_city_review + rwRes.name_city_review,
    name_state_review: extRes.name_state_review + rwRes.name_state_review,
    unresolved: extRes.unresolved + rwRes.unresolved,
  }

  function resolutionPct(n: number, d: number) {
    return { count: n, pct: pct(n, d) }
  }

  report.company_resolution_certification = {
    external: { total: ext.length, ...extRes },
    real_world: { total: rw.length, ...rwRes },
    combined_ext_rw: {
      total: combinedTotal,
      exact_domain: resolutionPct(combined.exact_domain, combinedTotal),
      normalized_domain: resolutionPct(combined.normalized_domain, combinedTotal),
      automatic_merge_normalized_domain: resolutionPct(combined.normalized_domain, combinedTotal),
      review_queue_name_city: resolutionPct(combined.name_city_review, combinedTotal),
      review_queue_name_state: resolutionPct(combined.name_state_review, combinedTotal),
      review_queue_total: resolutionPct(
        combined.name_city_review + combined.name_state_review,
        combinedTotal,
      ),
      unresolved: resolutionPct(combined.unresolved, combinedTotal),
      canonical_companies_after_domain_merge: canonicalByDomain.size,
    },
  }

  const extResolved = {
    domain: extRes.normalized_domain,
    name_city: extRes.name_city_review,
    name_state: extRes.name_state_review,
    unresolved: extRes.unresolved,
  }
  const rwResolved = {
    domain: rwRes.normalized_domain,
    name_city: rwRes.name_city_review,
    name_state: rwRes.name_state_review,
    unresolved: rwRes.unresolved,
  }

  report.company_resolution_simulation = {
    external: {
      total: ext.length,
      by_domain: extResolved.domain,
      by_name_city_fallback: extResolved.name_city,
      by_name_state_fallback: extResolved.name_state,
      unresolved: extResolved.unresolved,
      pct_resolved_by_domain: pct(extResolved.domain, ext.length),
      pct_any_resolution: pct(
        ext.length - extResolved.unresolved,
        ext.length,
      ),
      canonical_companies_after_domain_merge: canonicalByDomain.size,
    },
    real_world: {
      total: rw.length,
      by_domain: rwResolved.domain,
      by_name_city_fallback: rwResolved.name_city,
      by_name_state_fallback: rwResolved.name_state,
      unresolved: rwResolved.unresolved,
      pct_resolved_by_domain: pct(rwResolved.domain, rw.length),
      pct_any_resolution: pct(rw.length - rwResolved.unresolved, rw.length),
    },
    combined_ext_rw_canonical_by_domain_only: canonicalByDomain.size,
  }

  // Person resolution simulation — pool all contacts
  type PersonRow = {
    source: string
    email: string | null
    phone: string | null
    linkedin: string | null
    name: string
    company_id: string | null
  }
  const people: PersonRow[] = []
  for (const r of cc) {
    people.push({
      source: "company_contacts",
      email: r.email,
      phone: r.phone,
      linkedin: r.linkedin_url,
      name: r.full_name,
      company_id: r.company_id,
    })
  }
  for (const r of cand) {
    people.push({
      source: "contact_candidates",
      email: r.email,
      phone: r.phone,
      linkedin: r.linkedin_url,
      name: r.full_name,
      company_id: r.company_candidate_id,
    })
  }
  for (const r of dm.filter((d) => d.status !== "rejected")) {
    people.push({
      source: "lead_decision_makers",
      email: r.email,
      phone: r.phone,
      linkedin: r.linkedin_url,
      name: r.full_name,
      company_id: null,
    })
  }

  const personByEmail = new Map<string, number>()
  const personByLi = new Map<string, number>()
  const personByPhone = new Map<string, number>()
  let autoMerge = 0
  let review = 0
  let unresolved = 0
  let resolvedByEmail = 0
  let resolvedByLinkedIn = 0
  let resolvedByPhone = 0
  let reviewQueue = 0

  for (const p of people) {
    const e = normalizeContactIdentityEmail(p.email) ?? normalizeEmail(p.email)
    const li = normalizeContactIdentityLinkedIn(p.linkedin) ?? normalizeLinkedIn(p.linkedin)
    const ph = normalizeContactIdentityPhone(p.phone) ?? normalizePhone(p.phone)

    if (e) {
      const prev = personByEmail.get(e) ?? 0
      personByEmail.set(e, prev + 1)
      if (prev > 0) {
        autoMerge++
      } else {
        resolvedByEmail++
        if (li && personByLi.has(li) && personByLi.get(li)! > 0) {
          review++
          reviewQueue++
        }
      }
    } else if (li) {
      const prev = personByLi.get(li) ?? 0
      personByLi.set(li, prev + 1)
      if (prev > 0) autoMerge++
      else resolvedByLinkedIn++
    } else if (ph) {
      const prev = personByPhone.get(ph) ?? 0
      personByPhone.set(ph, prev + 1)
      if (prev > 0) autoMerge++
      else resolvedByPhone++
    } else {
      unresolved++
    }
  }

  const uniquePersonsEstimate = new Set([
    ...personByEmail.keys(),
    ...personByLi.keys(),
    ...personByPhone.keys(),
  ]).size

  const personTotal = people.length
  report.person_resolution_certification = {
    total_person_rows: personTotal,
    resolved_by_email: { count: resolvedByEmail, pct: pct(resolvedByEmail, personTotal) },
    resolved_by_linkedin: { count: resolvedByLinkedIn, pct: pct(resolvedByLinkedIn, personTotal) },
    resolved_by_phone: { count: resolvedByPhone, pct: pct(resolvedByPhone, personTotal) },
    review_queue: { count: reviewQueue, pct: pct(reviewQueue, personTotal) },
    automatic_merge_duplicate_key: { count: autoMerge, pct: pct(autoMerge, personTotal) },
    unresolved: { count: unresolved, pct: pct(unresolved, personTotal) },
    unique_emails: personByEmail.size,
    unique_linkedin: personByLi.size,
    unique_phones: personByPhone.size,
    estimated_unique_persons_upper_bound: uniquePersonsEstimate,
    compression_ratio_person_rows:
      personTotal > 0 ? uniquePersonsEstimate / personTotal : 0,
  }

  report.person_resolution_simulation = {
    total_person_rows: people.length,
    unique_emails: personByEmail.size,
    unique_linkedin: personByLi.size,
    unique_phones: personByPhone.size,
    rows_auto_mergeable_duplicate_key: autoMerge,
    pct_auto_merge_of_rows: pct(autoMerge, people.length),
    estimated_unique_persons_upper_bound: uniquePersonsEstimate,
    compression_ratio_person_rows:
      people.length > 0 ? uniquePersonsEstimate / people.length : 0,
    unresolved_name_only_rows: unresolved,
    pct_unresolved: pct(unresolved, people.length),
  }

  // --- Orphans ---
  const extIds = new Set(ext.map((r) => r.id))
  const rwIds = new Set(rw.map((r) => r.id))
  const companyIdsWithContacts = new Set(cc.map((r) => r.company_id))
  const candCompanyIds = new Set(cand.map((r) => r.company_candidate_id))

  const extWithoutContacts = [...extIds].filter(
    (id) => !companyIdsWithContacts.has(id) && !candCompanyIds.has(id),
  ).length
  const rwWithoutContacts = [...rwIds].filter(
    (id) => !companyIdsWithContacts.has(id) && !candCompanyIds.has(id),
  ).length

  const ccOrphanCompanyId = cc.filter(
    (r) => !extIds.has(r.company_id) && !rwIds.has(r.company_id),
  ).length

  const leadsNoDomain = leads.filter(
    (l) => !normalizeWebsiteDomain(l.website) && !normalizeEmail(l.contact_email),
  ).length

  const dmNotInCc = dm.filter((d) => {
    const e = normalizeEmail(d.email)
    return e && !ccEmails.has(e)
  }).length
  const dmTotal = dm.filter((d) => d.status !== "rejected").length

  const ccCompanyIdsInStaging = cc.filter(
    (r) => extIds.has(r.company_id) || rwIds.has(r.company_id),
  ).length

  report.orphans = {
    external_candidates_without_any_contact: extWithoutContacts,
    pct_ext_without_contacts: pct(extWithoutContacts, ext.length),
    real_world_candidates_without_any_contact: rwWithoutContacts,
    pct_rw_without_contacts: pct(rwWithoutContacts, rw.length),
    company_contacts_whose_company_id_not_in_staging: ccOrphanCompanyId,
    pct_cc_orphan_company_id: pct(ccOrphanCompanyId, cc.length),
    company_contacts_company_id_in_staging: ccCompanyIdsInStaging,
    leads_without_domain_or_email: leadsNoDomain,
    pct_leads_no_domain: pct(leadsNoDomain, leads.length),
    decision_makers_not_in_company_contacts_by_email: dmNotInCc,
    pct_dm_not_in_cc: pct(dmNotInCc, dmTotal),
  }

  // company_id universe for company_contacts
  const uniqueCcCompanyIds = new Set(cc.map((r) => r.company_id)).size
  const ccCompanyInExt = [...new Set(cc.map((r) => r.company_id))].filter((id) => extIds.has(id)).length
  const ccCompanyInRw = [...new Set(cc.map((r) => r.company_id))].filter((id) => rwIds.has(id)).length

  report.company_contacts_company_id_alignment = {
    unique_company_id_values: uniqueCcCompanyIds,
    company_ids_matching_external_candidate: ccCompanyInExt,
    company_ids_matching_real_world_candidate: ccCompanyInRw,
    company_ids_in_neither_staging_table: uniqueCcCompanyIds - new Set([
      ...cc.filter((r) => extIds.has(r.company_id) || rwIds.has(r.company_id)).map((r) => r.company_id),
    ]).size,
  }

  // Schema readiness flags
  const tables = [
    "external_company_candidates",
    "real_world_company_candidates",
    "company_contacts",
    "contact_candidates",
    "lead_decision_makers",
    "prospect_search_index",
    "company_relationships",
    "company_confidence_scores",
  ]
  const schemaReady: Record<string, boolean> = {}
  for (const t of tables) {
    const { error } = await admin.schema("growth").from(t).select("id").limit(1)
    schemaReady[t] = !error
  }
  report.schema_tables_readable = schemaReady

  // Phase 7.1C certification (thresholds from 7.1B)
  const domainResolutionPct =
    combinedTotal > 0 ? (combined.normalized_domain / combinedTotal) * 100 : 0
  const orphanCcPct = cc.length > 0 ? (ccOrphanCompanyId / cc.length) * 100 : 0
  const rwOrphanContactPct = rw.length > 0 ? (rwWithoutContacts / rw.length) * 100 : 0
  const personAutoMergePct = personTotal > 0 ? (autoMerge / personTotal) * 100 : 0
  const personUnresolvedPct = personTotal > 0 ? (unresolved / personTotal) * 100 : 0
  const compressionDomain = report.cross_source_overlap as { compression_ratio_domain_union: number }

  const blockers: string[] = []
  const cautions: string[] = []
  if (domainResolutionPct < 40) blockers.push(`domain_resolution_${domainResolutionPct.toFixed(1)}pct`)
  else if (domainResolutionPct < 60) cautions.push(`domain_resolution_${domainResolutionPct.toFixed(1)}pct`)
  if (orphanCcPct > 15) blockers.push(`cc_orphan_company_id_${orphanCcPct.toFixed(1)}pct`)
  else if (orphanCcPct > 5) cautions.push(`cc_orphan_company_id_${orphanCcPct.toFixed(1)}pct`)
  if (compressionDomain.compression_ratio_domain_union > 0.7) {
    blockers.push(`domain_compression_${compressionDomain.compression_ratio_domain_union.toFixed(3)}`)
  } else if (compressionDomain.compression_ratio_domain_union > 0.5) {
    cautions.push(`domain_compression_${compressionDomain.compression_ratio_domain_union.toFixed(3)}`)
  }
  if (personUnresolvedPct > 55) blockers.push(`person_unresolved_${personUnresolvedPct.toFixed(1)}pct`)
  else if (personUnresolvedPct > 40) cautions.push(`person_unresolved_${personUnresolvedPct.toFixed(1)}pct`)
  if (personAutoMergePct < 10 && personTotal >= 20) {
    cautions.push(`person_auto_merge_${personAutoMergePct.toFixed(1)}pct`)
  }
  if (rwOrphanContactPct > 90) {
    cautions.push(`rw_without_contacts_${rwOrphanContactPct.toFixed(1)}pct`)
  }
  if (ext.length === 0) cautions.push("external_company_candidates_empty")
  if (psiActive.length === 0) cautions.push("prospect_search_index_empty")

  let verdict: "GO" | "CONDITIONAL GO" | "NO GO" = "GO"
  if (blockers.length > 0) verdict = "NO GO"
  else if (cautions.length > 0) verdict = "CONDITIONAL GO"

  report.certification_7_1c = {
    verdict,
    blockers,
    cautions,
    metrics_evaluated: {
      domain_resolution_pct: Number(domainResolutionPct.toFixed(1)),
      person_auto_merge_pct: Number(personAutoMergePct.toFixed(1)),
      person_unresolved_pct: Number(personUnresolvedPct.toFixed(1)),
      cc_orphan_company_id_pct: Number(orphanCcPct.toFixed(1)),
      rw_without_contacts_pct: Number(rwOrphanContactPct.toFixed(1)),
      domain_compression_ratio: compressionDomain.compression_ratio_domain_union,
    },
    acceptable_merge_accuracy:
      verdict !== "NO GO" &&
      domainResolutionPct >= 60 &&
      orphanCcPct <= 15 &&
      personUnresolvedPct <= 55,
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
