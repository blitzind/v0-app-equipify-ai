/**
 * One-off audit: contact discovery for processed companies on a bulk acquisition run.
 * Run: pnpm tsx scripts/audit-acquisition-contact-discovery.ts <runId>
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

function loadEnvFile(path: string): void {
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
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function companyContactsProcessed(metadata: Record<string, unknown>): boolean {
  const acq = metadata.acquisition
  if (!acq || typeof acq !== "object") return false
  return Boolean(asString((acq as Record<string, unknown>).contacts_processed_at))
}

async function main() {
  for (const path of [".vercel/.env.production.local", ".env.vercel.production"]) {
    try {
      loadEnvFile(path)
    } catch {
      /* optional */
    }
  }

  const runId = process.argv[2] ?? "28259a5c-09e9-4d90-99d0-4ea1538a3127"
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing Supabase URL or service role key in .env.vercel.production")
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })

  const { data: runRow, error: runErr } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .select("id, status, metadata, created_at, updated_at")
    .eq("id", runId)
    .maybeSingle()
  if (runErr) throw runErr
  if (!runRow) {
    console.log(JSON.stringify({ error: "run_not_found", runId }))
    return
  }

  const metadata =
    (runRow as { metadata: unknown }).metadata &&
    typeof (runRow as { metadata: unknown }).metadata === "object"
      ? ((runRow as { metadata: Record<string, unknown> }).metadata as Record<string, unknown>)
      : {}
  const acquisition =
    metadata.acquisition && typeof metadata.acquisition === "object"
      ? (metadata.acquisition as Record<string, unknown>)
      : null
  if (!acquisition || asString(acquisition.qa_marker) !== "growth-bulk-acquisition-v1") {
    console.log(JSON.stringify({ error: "not_bulk_acquisition_run", runId }))
    return
  }

  const state = acquisition
  const childIds = Array.isArray(state.child_run_ids) ? state.child_run_ids.map(String) : []

  const processed: Array<Record<string, unknown>> = []
  let cursor: { created_at: string; id: string } | null = null

  while (childIds.length > 0) {
    let q = admin
      .schema("growth")
      .from("real_world_company_candidates")
      .select("id, company_name, website, domain, metadata, created_at, growth_lead_id")
      .in("run_id", childIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(200)

    if (cursor) {
      q = q.or(
        `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`,
      )
    }

    const { data, error } = await q
    if (error) throw error
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const r = row as Record<string, unknown>
      const md =
        r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {}
      if (companyContactsProcessed(md)) processed.push(r)
    }

    const last = rows[rows.length - 1] as Record<string, unknown>
    cursor = { created_at: asString(last.created_at), id: asString(last.id) }
    if (rows.length < 200) break
  }

  const last10 = processed.slice(-10)

  const companies: Array<Record<string, unknown>> = []

  for (const company of last10) {
    const id = asString(company.id)
    const md =
      company.metadata && typeof company.metadata === "object"
        ? (company.metadata as Record<string, unknown>)
        : {}
    const acq =
      md.acquisition && typeof md.acquisition === "object"
        ? (md.acquisition as Record<string, unknown>)
        : {}

    const { data: runs } = await admin
      .schema("growth")
      .from("contact_discovery_runs")
      .select(
        "id, provider_names, status, candidate_count, error_message, metadata, created_at, updated_at",
      )
      .eq("company_candidate_id", id)
      .order("created_at", { ascending: false })
      .limit(5)

    const { data: candidates } = await admin
      .schema("growth")
      .from("contact_candidates")
      .select("id, provider_name, provider_type, full_name, email, job_title, created_at, run_id")
      .eq("company_candidate_id", id)
      .order("created_at", { ascending: false })
      .limit(100)

    const byProvider: Record<string, number> = {}
    for (const c of candidates ?? []) {
      const pn = asString((c as Record<string, unknown>).provider_name) || "unknown"
      byProvider[pn] = (byProvider[pn] ?? 0) + 1
    }

    const latestRunId = runs?.[0] ? asString((runs[0] as Record<string, unknown>).id) : ""
    const insertedThisRun = (candidates ?? []).filter(
      (c) => asString((c as Record<string, unknown>).run_id) === latestRunId,
    ).length

    const { data: cc } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("id, full_name, email, contact_status, metadata, created_at")
      .eq("company_id", id)
      .neq("contact_status", "archived")
      .limit(30)

    companies.push({
      company_id: id,
      company_name: asString(company.company_name),
      website: asString(company.website) || null,
      domain: asString(company.domain) || null,
      growth_lead_id: asString(company.growth_lead_id) || null,
      contacts_processed_at: asString(acq.contacts_processed_at) || null,
      contact_discovery_runs: runs ?? [],
      contact_candidates_total: (candidates ?? []).length,
      contact_candidates_by_provider: byProvider,
      contact_candidates_inserted_on_latest_run: insertedThisRun,
      company_contacts_count: (cc ?? []).length,
      company_contacts_sample: (cc ?? []).slice(0, 5).map((r) => {
        const row = r as Record<string, unknown>
        return {
          full_name: asString(row.full_name),
          email: asString(row.email) || null,
          contact_status: asString(row.contact_status),
        }
      }),
    })
  }

  console.log(
    JSON.stringify(
      {
        run_id: runId,
        status: (runRow as { status: string }).status,
        phase: state.phase,
        stats: state.stats,
        metrics: state.metrics,
        last_tick: state.last_tick,
        recent_ticks: state.recent_ticks,
        last_error: state.last_error,
        processed_company_count: processed.length,
        audited_companies: companies,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
