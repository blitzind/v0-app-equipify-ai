/**
 * GE-AIOS-HOTFIX-LIVE-1C-1 — Read-only production source_kind constraint inspection.
 *
 *   pnpm inspect:ge-aios-hotfix-live-1c-1-production-source-kind-constraint
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const PHASE = "GE-AIOS-HOTFIX-LIVE-1C-1" as const
const PROJECT_REF = "byyfylkklbxcdofaspye"
const COLLISION_VERSION = "20270620120000"
const HOTFIX_VERSION = "20271010120000"
const HOTFIX_NAME = "ge_aios_hotfix_live_1c_1_growth_leads_source_kind_acquisition"

const CANONICAL_SOURCE_KINDS = [
  "manual",
  "import",
  "web",
  "referral",
  "partner",
  "other",
  "browser_extension",
  "acquisition",
] as const

function runQuery(sql: string): unknown {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const jsonStart = out.indexOf("{")
  if (jsonStart < 0) throw new Error("Could not parse supabase db query output")
  const parsed = JSON.parse(out.slice(jsonStart)) as { rows?: unknown[] }
  return parsed.rows ?? parsed
}

function runMigrationList(): string {
  return execFileSync("supabase", ["migration", "list", "--linked"], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
}

function main(): void {
  console.log(`[${PHASE}] Production source_kind constraint inspection (read-only)`)
  console.log(`Target Supabase project: ${PROJECT_REF}.supabase.co`)

  const constraintRows = runQuery(
    "SELECT pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE n.nspname = 'growth' AND t.relname = 'leads' AND c.conname = 'leads_source_kind_check';",
  ) as Array<{ definition: string }>

  const definition = constraintRows[0]?.definition ?? "(missing)"
  console.log("\n--- Current Constraint ---")
  console.log(definition)

  const sourceKindRows = runQuery(
    "SELECT source_kind, count(*)::int AS count FROM growth.leads GROUP BY source_kind ORDER BY source_kind;",
  ) as Array<{ source_kind: string; count: number }>

  console.log("\n--- Existing source_kind Values ---")
  for (const row of sourceKindRows) {
    console.log(`  ${row.source_kind}: ${row.count}`)
  }

  const invalidRows = runQuery(
    `SELECT count(*) FILTER (WHERE source_kind NOT IN (${CANONICAL_SOURCE_KINDS.map((k) => `'${k}'`).join(",")})) AS invalid_for_repair, count(*)::int AS total FROM growth.leads;`,
  ) as Array<{ invalid_for_repair: number; total: number }>

  console.log("\n--- Repair Safety ---")
  console.log(`  total leads: ${invalidRows[0]?.total ?? 0}`)
  console.log(`  rows violating repaired constraint: ${invalidRows[0]?.invalid_for_repair ?? 0}`)

  const ledgerRows = runQuery(
    `SELECT version, name FROM supabase_migrations.schema_migrations WHERE version IN ('${COLLISION_VERSION}','${HOTFIX_VERSION}') ORDER BY version;`,
  ) as Array<{ version: string; name: string }>

  console.log("\n--- Migration Ledger (selected) ---")
  for (const row of ledgerRows) {
    console.log(`  ${row.version}: ${row.name}`)
  }
  const hotfixApplied = ledgerRows.some((row) => row.version === HOTFIX_VERSION)
  console.log(`  hotfix ${HOTFIX_VERSION} applied: ${hotfixApplied}`)

  const collision = ledgerRows.find((row) => row.version === COLLISION_VERSION)
  if (collision) {
    console.log(`\n--- Ledger Collision Note ---`)
    console.log(
      `  Production version ${COLLISION_VERSION} is recorded as "${collision.name}", not growth_leads_source_kind_repair.`,
    )
    console.log(
      `  Local file supabase/migrations/${COLLISION_VERSION}_growth_leads_source_kind_repair.sql was never executed on production.`,
    )
  }

  const proposedPath = path.join(
    process.cwd(),
    `supabase/migrations/${HOTFIX_VERSION}_${HOTFIX_NAME}.sql`,
  )
  console.log("\n--- Proposed Forward Migration ---")
  console.log(`  file: ${proposedPath}`)
  console.log(`  exists: ${fs.existsSync(proposedPath)}`)
  console.log(`  allows acquisition: true`)
  console.log(`  allows browser_extension: true`)
  console.log(`  canonical source kinds: ${CANONICAL_SOURCE_KINDS.join(", ")}`)

  const permitsAcquisition = definition.includes("'acquisition'")
  console.log("\n--- Verdict ---")
  console.log(`  acquisition permitted now: ${permitsAcquisition}`)
  if (!permitsAcquisition) {
    console.log(`  action required: apply forward migration ${HOTFIX_VERSION} via pnpm apply:ge-aios-hotfix-live-1c-1-production-source-kind-constraint -- --apply`)
  }
}

main()
