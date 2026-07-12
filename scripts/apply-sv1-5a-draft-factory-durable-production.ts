/**
 * SV1-5A — Apply Draft Factory durable migration to Production Supabase.
 *
 * Dry-run (default):
 *   pnpm apply:sv1-5a-draft-factory-durable-production
 *
 * Production write (explicit):
 *   pnpm apply:sv1-5a-draft-factory-durable-production -- --apply
 *
 * Never uses .env.local. Does not deploy the application.
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const PHASE = "SV1-5A" as const
const PROJECT_REF = "byyfylkklbxcdofaspye"
const VERSION = "20271112120000"
const FILE = path.join(
  process.cwd(),
  `supabase/migrations/${VERSION}_growth_draft_factory_durable_sv1_5.sql`,
)

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
  console.log(`[${PHASE}] Draft Factory durable migration`)
  console.log(`Mode: ${apply ? "APPLY (production DDL write)" : "DRY-RUN (preflight only)"}`)
  console.log(`Target Supabase project: ${PROJECT_REF}.supabase.co`)

  if (!fs.existsSync(FILE)) {
    console.error(`Missing migration file: ${FILE}`)
    process.exit(1)
  }

  console.log("\n--- Proposed Migration ---")
  console.log(`  ${FILE}`)
  console.log(fs.readFileSync(FILE, "utf8"))

  console.log("\n--- Safety ---")
  console.log("  Creates growth.draft_factory_lead_states + wake_receipts if missing.")
  console.log("  Idempotent (IF NOT EXISTS). No DROP TABLE. No lead/package row mutation.")
  console.log("  No destructive reset. Does not db-push unrelated pending migrations.")

  const before = runQuery(
    "select to_regclass('growth.draft_factory_lead_states') as states, to_regclass('growth.draft_factory_wake_receipts') as receipts;",
  )
  console.log("\n--- Before ---")
  console.log(before.trim())

  if (!apply) {
    console.log("\n--- Dry Run Complete ---")
    console.log("  Re-run with --apply to execute SQL and record migration ledger entry.")
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

  const after = runQuery(`
select c.relname as table_name,
       pg_get_constraintdef(con.oid) as constraint_def
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_constraint con on con.conrelid = c.oid
where n.nspname = 'growth'
  and c.relname in ('draft_factory_lead_states', 'draft_factory_wake_receipts')
order by c.relname;
`)
  console.log("\n--- After (tables + constraints) ---")
  console.log(after.trim())

  const policies = runQuery(`
select tablename, policyname, roles::text
from pg_policies
where schemaname = 'growth'
  and tablename in ('draft_factory_lead_states', 'draft_factory_wake_receipts');
`)
  console.log("\n--- RLS Policies ---")
  console.log(policies.trim())

  const indexes = runQuery(`
select tablename, indexname
from pg_indexes
where schemaname = 'growth'
  and tablename in ('draft_factory_lead_states', 'draft_factory_wake_receipts')
order by tablename, indexname;
`)
  console.log("\n--- Indexes ---")
  console.log(indexes.trim())

  if (!after.includes("draft_factory_lead_states") || !after.includes("draft_factory_wake_receipts")) {
    console.error(`\n[${PHASE}] FAILED — tables not present after apply.`)
    process.exit(1)
  }

  console.log(`\n[${PHASE}] APPLY complete — durable Draft Factory tables ready.`)
}

main()
