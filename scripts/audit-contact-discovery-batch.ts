import { createClient } from "@supabase/supabase-js"
import { OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES } from "@/lib/growth/contact-discovery/contact-discovery-operator-providers"
import { runContactDiscoveryProviders } from "@/lib/growth/contact-discovery/contact-discovery-registry"
import { resolveCompanyCandidateContext } from "@/lib/growth/contact-discovery/contact-repository"

const RUN_ID = process.argv[2] ?? "28259a5c-09e9-4d90-99d0-4ea1538a3127"
const LIMIT = Number(process.argv[3] ?? 10)

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing Supabase env")
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })

  const { data: runRow } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .select("metadata")
    .eq("id", RUN_ID)
    .maybeSingle()

  const metadata =
    runRow?.metadata && typeof runRow.metadata === "object"
      ? (runRow.metadata as Record<string, unknown>)
      : {}
  const acquisition =
    metadata.acquisition && typeof metadata.acquisition === "object"
      ? (metadata.acquisition as Record<string, unknown>)
      : {}
  const childIds = Array.isArray(acquisition.child_run_ids)
    ? acquisition.child_run_ids.map(String)
    : []

  const { data: companies } = await admin
    .schema("growth")
    .from("real_world_company_candidates")
    .select("id, company_name, website, domain")
    .in("run_id", childIds)
    .not("metadata->acquisition->>contacts_processed_at", "is", null)
    .order("metadata->acquisition->>contacts_processed_at", { ascending: false })
    .limit(LIMIT)

  const rows: Array<Record<string, unknown>> = []

  for (const company of companies ?? []) {
    const id = asString((company as Record<string, unknown>).id)
    const ctx = await resolveCompanyCandidateContext(admin, id)
    if (!ctx) continue

    const results = await runContactDiscoveryProviders(
      admin,
      {
        company_candidate_id: ctx.company_candidate_id,
        company_name: ctx.company_name,
        domain: ctx.domain,
        website_url: ctx.website_url,
        growth_lead_id: ctx.growth_lead_id,
        industry: ctx.industry,
        limit: 20,
      },
      { provider_types: [...OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES] },
    )

    for (const r of results) {
      rows.push({
        company_id: id,
        company_name: ctx.company_name,
        website: ctx.website_url,
        growth_lead_id: ctx.growth_lead_id,
        provider: r.provider_name,
        status: r.status,
        message: r.message,
        contacts_returned: r.contacts.length,
      })
    }
  }

  console.log(JSON.stringify(rows, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
