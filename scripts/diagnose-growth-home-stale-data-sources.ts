/**
 * GE-AVA-FRESH-SLATE-1B — Diagnose /growth Home stale data sources vs operational reset inventory.
 *
 *   pnpm tsx scripts/diagnose-growth-home-stale-data-sources.ts
 */
import { createClient } from "@supabase/supabase-js"
import {
  GROWTH_HOME_STALE_DATA_DIAGNOSTIC_QA_MARKER,
  PRECISION_BIOMEDICAL_AI_OS_ORG_ID,
} from "../lib/growth/reset/growth-engine-operational-reset-constants"
import {
  GROWTH_ENGINE_OPERATIONAL_RESET_PRESERVED_TABLES,
  getGrowthEngineOperationalResetTableEntries,
} from "../lib/growth/reset/growth-engine-operational-reset-table-inventory"
import {
  GROWTH_HOME_STALE_DATA_SOURCES,
  listGrowthHomeStaleDataSourceTables,
} from "../lib/growth/reset/growth-home-stale-data-source-map"
import { resolveGrowthResetSupabaseConfig } from "../lib/growth/reset/growth-test-data-reset-credentials"

async function countTable(admin: ReturnType<typeof createClient>, table: string): Promise<number | null> {
  const { count, error } = await admin.schema("growth").from(table).select("id", { count: "exact", head: true })
  if (error) return null
  return count ?? 0
}

async function main(): Promise<void> {
  const inventoryTables = new Set(getGrowthEngineOperationalResetTableEntries().map((entry) => entry.table))
  const preservedSet = new Set<string>(GROWTH_ENGINE_OPERATIONAL_RESET_PRESERVED_TABLES)
  const sourceTables = listGrowthHomeStaleDataSourceTables()

  console.log(`\n=== ${GROWTH_HOME_STALE_DATA_DIAGNOSTIC_QA_MARKER} ===\n`)
  console.log("UI metric → source trace:\n")

  for (const source of GROWTH_HOME_STALE_DATA_SOURCES) {
    console.log(`• ${source.ui_label}`)
    console.log(`  id: ${source.id}`)
    console.log(`  component: ${source.ui_component}`)
    console.log(`  api: ${source.api_route ?? "(client-side computed)"}`)
    console.log(`  service: ${source.service}`)
    console.log(`  kind: ${source.kind}`)
    if (source.tables.length > 0) {
      console.log(`  tables: ${source.tables.map((t) => `growth.${t}`).join(", ")}`)
    }
    if (source.notes) console.log(`  notes: ${source.notes}`)
    console.log("")
  }

  const uncovered = sourceTables.filter((table) => !inventoryTables.has(table) && !preservedSet.has(table))
  const covered = sourceTables.filter((table) => inventoryTables.has(table) || preservedSet.has(table))

  console.log("Reset inventory coverage for Home source tables:")
  console.log(`  covered: ${covered.length}/${sourceTables.length}`)
  if (uncovered.length > 0) {
    console.log(`  MISSING from reset inventory: ${uncovered.join(", ")}`)
  } else {
    console.log("  all Home source tables are in operational reset inventory")
  }
  console.log("")

  let config
  try {
    config = await resolveGrowthResetSupabaseConfig({ allowPrompt: !process.argv.includes("--no-prompt") })
  } catch (e) {
    console.log("Skipping live counts (no Supabase credentials).")
    console.log(e instanceof Error ? e.message : String(e))
    return
  }

  const admin = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false } })
  const orgId = process.env.GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID?.trim() || PRECISION_BIOMEDICAL_AI_OS_ORG_ID

  console.log(`Live row counts (org context ${orgId}):\n`)

  for (const table of sourceTables) {
    const count = await countTable(admin, table)
    const inInventory = inventoryTables.has(table) ? "RESET" : preservedSet.has(table) ? "PRESERVED" : "MISSING"
    console.log(`  growth.${table}: ${count ?? "n/a"} [${inInventory}]`)
  }

  console.log("\nLive Home API aggregates (direct table probes):\n")

  const [
    jobsRes,
    threadsRes,
    repliesRes,
    leadInboxRes,
    opportunitiesRes,
    leadsRes,
    cadenceRes,
  ] = await Promise.all([
    admin.schema("growth").from("sequence_execution_jobs").select("status", { count: "exact" }),
    admin
      .schema("growth")
      .from("inbox_threads")
      .select("id", { count: "exact", head: true })
      .in("thread_status", ["open", "needs_review"]),
    admin
      .schema("growth")
      .from("outbound_replies")
      .select("id", { count: "exact", head: true })
      .eq("unanswered", true),
    admin.schema("growth").from("lead_inbox").select("id", { count: "exact", head: true }),
    admin.schema("growth").from("opportunities").select("id", { count: "exact", head: true }),
    admin.schema("growth").from("leads").select("id", { count: "exact", head: true }),
    admin
      .schema("growth")
      .from("cadence_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ])

  const jobs = jobsRes.data ?? []
  const jobCounts = {
    draft: jobs.filter((row) => row.status === "draft").length,
    pending_approval: jobs.filter((row) => row.status === "pending_approval").length,
    blocked: jobs.filter((row) => row.status === "blocked").length,
    running: jobs.filter((row) => row.status === "running").length,
    total: jobs.length,
  }

  console.log(
    JSON.stringify(
      {
        sequence_execution_jobs: jobCounts,
        inbox_threads_open_or_needs_review: threadsRes.count ?? 0,
        outbound_replies_unanswered: repliesRes.count ?? 0,
        lead_inbox_rows: leadInboxRes.count ?? 0,
        opportunities_rows: opportunitiesRes.count ?? 0,
        leads_rows: leadsRes.count ?? 0,
        cadence_tasks_open: cadenceRes.count ?? 0,
        derived_home_signals: {
          pending_approvals_estimate: jobCounts.draft + jobCounts.pending_approval,
          blocked_jobs_estimate: jobCounts.blocked,
          qualified_prospects_estimate:
            (leadInboxRes.count ?? 0) + (cadenceRes.count ?? 0),
          replies_waiting_estimate: threadsRes.count ?? 0,
        },
      },
      null,
      2,
    ),
  )

  console.log("")
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
