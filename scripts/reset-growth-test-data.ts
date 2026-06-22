/**
 * GS-GROWTH-OPS-7B — Reset Growth Engine test/demo data (production baseline).
 *
 *   pnpm growth:reset-test-data --dry-run
 *   GROWTH_RESET_TEST_DATA_CONFIRM=yes pnpm growth:reset-test-data --confirm
 *   pnpm growth:reset-test-data --report
 *   pnpm growth:reset-test-data --dry-run --help
 *
 * Credentials (no .env.local, no Vercel env files):
 *   1) NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   2) SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN
 *   3) Interactive prompt (TTY)
 */
import { createClient } from "@supabase/supabase-js"
import { formatGrowthProductionTargetBanner } from "../lib/growth/canonical-companies/load-growth-production-supabase-env"
import {
  GROWTH_RESET_CONFIRM_ENV,
  GROWTH_RESET_CONFIRM_VALUE,
  GROWTH_TEST_DATA_RESET_QA_MARKER,
} from "../lib/growth/reset/growth-test-data-reset-constants"
import {
  GROWTH_RESET_CREDENTIALS_HELP,
  resolveGrowthResetSupabaseConfig,
} from "../lib/growth/reset/growth-test-data-reset-credentials"
import {
  buildGrowthResetTableCatalog,
  extractGrowthTablesFromMigrations,
  getGrowthResetDependencyGraph,
} from "../lib/growth/reset/growth-test-data-reset-table-inventory"
import {
  formatGrowthResetReportSummary,
  runGrowthTestDataReset,
} from "../lib/growth/reset/growth-test-data-reset-service"

function resolveMode(argv: string[]): "dry_run" | "confirm" | "report" | null {
  if (argv.includes("--confirm")) return "confirm"
  if (argv.includes("--report")) return "report"
  if (argv.includes("--dry-run") || argv.includes("--dryRun")) return "dry_run"
  return null
}

function wantsHelp(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h")
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)

  if (wantsHelp(argv)) {
    console.log(GROWTH_RESET_CREDENTIALS_HELP)
    return
  }

  const allowLocal = argv.includes("--local")
  const allowPrompt = !argv.includes("--no-prompt")

  if (argv.includes("--inventory-only")) {
    const catalog = buildGrowthResetTableCatalog()
    console.log(
      JSON.stringify(
        {
          qa_marker: GROWTH_TEST_DATA_RESET_QA_MARKER,
          inventory_only: true,
          migration_tables: extractGrowthTablesFromMigrations().length,
          catalog_tables: catalog.length,
          classifications: {
            keep: catalog.filter((t) => t.classification === "KEEP").length,
            delete: catalog.filter((t) => t.classification === "DELETE").length,
            manual_review: catalog.filter((t) => t.classification === "MANUAL_REVIEW").length,
          },
          dependency_graph: getGrowthResetDependencyGraph(catalog),
          catalog,
        },
        null,
        2,
      ),
    )
    return
  }

  const mode = resolveMode(argv)

  if (!mode) {
    console.error(
      JSON.stringify({
        error: "missing_mode",
        qa_marker: GROWTH_TEST_DATA_RESET_QA_MARKER,
        usage: [
          "pnpm growth:reset-test-data --dry-run",
          `${GROWTH_RESET_CONFIRM_ENV}=${GROWTH_RESET_CONFIRM_VALUE} pnpm growth:reset-test-data --confirm`,
          "pnpm growth:reset-test-data --report",
          "pnpm growth:reset-test-data --dry-run --help",
        ],
      }),
    )
    process.exit(1)
  }

  let config
  try {
    config = await resolveGrowthResetSupabaseConfig({ allowLocal, allowPrompt })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ error: "growth_reset_supabase_config", message }))
    process.exit(1)
  }

  console.error(
    JSON.stringify(
      formatGrowthProductionTargetBanner(config, mode === "confirm" ? "apply" : "dry_run"),
    ),
  )

  const admin = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false },
  })

  const result = await runGrowthTestDataReset(admin, { mode })
  const payload = formatGrowthResetReportSummary(result)

  console.log(JSON.stringify(payload, null, 2))

  if (mode === "confirm" && !result.summary.verification.ok) {
    process.exitCode = 2
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
