/**
 * Debug script: reproduce acquisition tick failure with full stack traces.
 * Run: NODE_OPTIONS='--require ./scripts/mock-server-only.cjs' pnpm tsx scripts/repro-acquisition-tick-debug.ts [runId]
 */
import { createClient } from "@supabase/supabase-js"

async function main() {
  const runId = process.argv[2]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })

  console.log("=== import chain probe ===")
  const modules = [
    "@/lib/growth/real-world-discovery/live-provider-query-expansion",
    "@/lib/growth/contact-discovery/contact-discovery-registry",
    "@/lib/growth/contact-discovery/contact-repository",
    "@/lib/growth/acquisition/sync-contact-candidates-to-company-contacts",
    "@/lib/growth/acquisition/verify-company-contact-for-acquisition",
    "@/lib/growth/acquisition/promote-verified-contact-to-lead",
    "@/lib/growth/acquisition/bulk-acquisition-runner",
  ] as const

  for (const mod of modules) {
    try {
      await import(mod)
      console.log(`OK import ${mod}`)
    } catch (err) {
      console.error(`FAIL import ${mod}`)
      console.error(err instanceof Error ? err.stack ?? err.message : err)
      process.exit(1)
    }
  }

  const { loadBulkAcquisitionRun, tickBulkAcquisitionRun } = await import(
    "@/lib/growth/acquisition/bulk-acquisition-runner"
  )

  let targetRunId = runId
  if (!targetRunId) {
    const { data, error } = await admin
      .schema("growth")
      .from("bulk_acquisition_runs")
      .select("id, status, state, last_error")
      .order("created_at", { ascending: false })
      .limit(5)
    if (error) throw error
    console.log("\n=== recent runs ===")
    for (const row of data ?? []) {
      const r = row as { id: string; status: string; last_error?: string | null; state?: { phase?: string } }
      console.log(r.id, r.status, r.state?.phase, r.last_error ?? "")
    }
    targetRunId = (data?.[0] as { id: string } | undefined)?.id
    if (!targetRunId) {
      console.error("No acquisition runs found")
      process.exit(1)
    }
  }

  const loaded = await loadBulkAcquisitionRun(admin, targetRunId)
  if (!loaded) {
    console.error("Run not found:", targetRunId)
    process.exit(1)
  }

  console.log("\n=== run state ===")
  console.log(JSON.stringify({
    id: loaded.id,
    status: loaded.status,
    phase: loaded.state.phase,
    query_index: loaded.state.query_index,
    use_fallback_queries: loaded.state.use_fallback_queries,
    discovery_exhausted: loaded.state.discovery_exhausted,
    primary_queries: loaded.state.query_plan.primary.length,
    fallback_queries: loaded.state.query_plan.fallback.length,
    companies_discovered: loaded.state.stats.companies_discovered,
    companies_contacts_processed: loaded.state.stats.companies_contacts_processed,
    last_error: loaded.state.last_error,
  }, null, 2))

  console.log("\n=== tick with step logging ===")
  try {
    const result = await tickBulkAcquisitionRun(admin, targetRunId)
    console.log("tick ok", {
      phase: result?.phase,
      actions: result?.tick_actions,
      last_error: result?.run.state.last_error,
    })
  } catch (err) {
    console.error("tick threw (unexpected — runner catches internally)")
    console.error(err instanceof Error ? err.stack ?? err.message : err)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
