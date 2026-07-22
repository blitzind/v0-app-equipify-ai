/**
 * GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A — Apply observability migration to Production Supabase.
 *
 * Dry-run (default):
 *   pnpm apply:ge-aios-draft-factory-observability-1a-production
 *
 * Production write (explicit):
 *   pnpm apply:ge-aios-draft-factory-observability-1a-production -- --apply
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const PHASE = "GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A" as const
const PROJECT_REF = "byyfylkklbxcdofaspye"
const VERSION = "20271122130000"
const FILE = path.join(
  process.cwd(),
  `supabase/migrations/${VERSION}_growth_draft_factory_wake_observability_1a.sql`,
)

const OBSERVABILITY_TABLES = [
  "draft_factory_wake_attempts",
  "draft_factory_wake_attempt_transitions",
  "ai_os_event_handler_telemetry",
  "draft_factory_wake_subscriber_telemetry",
] as const

function wantsApply(argv: string[]): boolean {
  return argv.includes("--apply")
}

function runQuery(sql: string): string {
  return execFileSync("supabase", ["db", "query", "--linked", sql], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
}

function main(): void {
  const apply = wantsApply(process.argv)
  console.log(`[${PHASE}] Draft Factory wake observability migration`)
  console.log(`Mode: ${apply ? "APPLY (production DDL write)" : "DRY-RUN (preflight only)"}`)
  console.log(`Target Supabase project: ${PROJECT_REF}.supabase.co`)

  if (!fs.existsSync(FILE)) {
    console.error(`Missing migration file: ${FILE}`)
    process.exit(1)
  }

  const ledger = runQuery(
    `SELECT version, name FROM supabase_migrations.schema_migrations WHERE version = '${VERSION}';`,
  )
  console.log("\n--- Migration Ledger (before) ---")
  console.log(ledger.trim() || "(not applied)")

  const before = runQuery(`
select c.relname as table_name,
       pg_catalog.pg_get_userbyid(c.relowner) as owner,
       n.nspname as schema,
       c.reltuples::bigint as estimated_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'growth'
  and c.relname in (${OBSERVABILITY_TABLES.map((t) => `'${t}'`).join(", ")})
order by c.relname;
`)
  console.log("\n--- PostgreSQL Tables (before) ---")
  console.log(before.trim() || "(none present)")

  console.log("\n--- Proposed Migration ---")
  console.log(`  ${FILE}`)

  console.log("\n--- Safety ---")
  console.log("  Creates four growth observability tables if missing.")
  console.log("  Idempotent (IF NOT EXISTS). No DROP TABLE. No runtime data mutation.")
  console.log("  Applies forward migration only (does not db-push unrelated pending migrations).")

  if (!apply) {
    console.log("\n--- Dry Run Complete ---")
    console.log("  Re-run with --apply to execute SQL, record migration ledger entry, and reload PostgREST schema cache.")
    process.exit(0)
  }

  console.log("\n--- Applying SQL ---")
  execFileSync("supabase", ["db", "query", "--linked", "-f", FILE], {
    cwd: process.cwd(),
    stdio: "inherit",
  })

  console.log("\n--- Recording migration ledger ---")
  execFileSync(
    "supabase",
    ["migration", "repair", VERSION, "--status", "applied", "--linked", "--yes"],
    { cwd: process.cwd(), stdio: "inherit" },
  )

  console.log("\n--- Reloading PostgREST schema cache ---")
  runQuery("NOTIFY pgrst, 'reload schema';")

  const after = runQuery(`
select c.relname as table_name,
       pg_catalog.pg_get_userbyid(c.relowner) as owner,
       n.nspname as schema,
       c.reltuples::bigint as estimated_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'growth'
  and c.relname in (${OBSERVABILITY_TABLES.map((t) => `'${t}'`).join(", ")})
order by c.relname;
`)
  console.log("\n--- PostgreSQL Tables (after) ---")
  console.log(after.trim())

  for (const table of OBSERVABILITY_TABLES) {
    if (!after.includes(table)) {
      console.error(`\n[${PHASE}] FAILED — growth.${table} not present after apply.`)
      process.exit(1)
    }
  }

  console.log(`\n[${PHASE}] APPLY complete — run observability + diagnostics production validators.`)
}

main()
