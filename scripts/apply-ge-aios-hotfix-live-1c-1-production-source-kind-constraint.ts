/**
 * GE-AIOS-HOTFIX-LIVE-1C-1 — Apply forward source_kind constraint repair to production Supabase.
 *
 * Dry-run (default):
 *   pnpm apply:ge-aios-hotfix-live-1c-1-production-source-kind-constraint
 *
 * Production write (explicit):
 *   pnpm apply:ge-aios-hotfix-live-1c-1-production-source-kind-constraint -- --apply
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const PHASE = "GE-AIOS-HOTFIX-LIVE-1C-1" as const
const PROJECT_REF = "byyfylkklbxcdofaspye"
const HOTFIX_VERSION = "20271010120000"
const HOTFIX_FILE = path.join(
  process.cwd(),
  `supabase/migrations/${HOTFIX_VERSION}_ge_aios_hotfix_live_1c_1_growth_leads_source_kind_acquisition.sql`,
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
  console.log(`[${PHASE}] Production source_kind constraint repair`)
  console.log(`Mode: ${apply ? "APPLY (production DDL write)" : "DRY-RUN (preflight only)"}`)
  console.log(`Target Supabase project: ${PROJECT_REF}.supabase.co`)

  if (!fs.existsSync(HOTFIX_FILE)) {
    console.error(`Missing migration file: ${HOTFIX_FILE}`)
    process.exit(1)
  }

  const before = runQuery(
    "SELECT pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE n.nspname = 'growth' AND t.relname = 'leads' AND c.conname = 'leads_source_kind_check';",
  )
  console.log("\n--- Current Constraint ---")
  console.log(before.trim())

  console.log("\n--- Proposed Migration ---")
  console.log(`  ${HOTFIX_FILE}`)
  console.log(fs.readFileSync(HOTFIX_FILE, "utf8"))

  console.log("\n--- Safety ---")
  console.log("  No lead rows will be deleted or rewritten.")
  console.log("  Only drops/recreates leads_source_kind_check.")
  console.log("  Applies forward migration only (does not db-push unrelated pending migrations).")

  if (!apply) {
    console.log("\n--- Dry Run Complete ---")
    console.log("  Re-run with --apply to execute SQL and record migration ledger entry.")
    process.exit(0)
  }

  console.log("\n--- Applying SQL ---")
  execFileSync("supabase", ["db", "query", "--linked", "-f", HOTFIX_FILE], {
    cwd: process.cwd(),
    stdio: "inherit",
  })

  console.log("\n--- Recording migration ledger ---")
  execFileSync(
    "supabase",
    ["migration", "repair", HOTFIX_VERSION, "--status", "applied", "--linked", "--yes"],
    {
      cwd: process.cwd(),
      stdio: "inherit",
    },
  )

  const after = runQuery(
    "SELECT pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE n.nspname = 'growth' AND t.relname = 'leads' AND c.conname = 'leads_source_kind_check';",
  )
  console.log("\n--- Constraint After ---")
  console.log(after.trim())

  if (!after.includes("acquisition")) {
    console.error("\n[GE-AIOS-HOTFIX-LIVE-1C-1] FAILED — acquisition still not permitted.")
    process.exit(1)
  }

  console.log("\n[GE-AIOS-HOTFIX-LIVE-1C-1] APPLY complete — run inspect + LIVE-1C next.")
}

main()
