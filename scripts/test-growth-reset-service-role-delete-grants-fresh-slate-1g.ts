/**
 * GE-AVA-FRESH-SLATE-1G — Certification for service_role DELETE grants migration.
 *
 * Run: pnpm test:growth-reset-service-role-delete-grants-fresh-slate-1g
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_RESET_SERVICE_ROLE_DELETE_GRANTS_MIGRATION,
  GROWTH_RESET_SERVICE_ROLE_DELETE_GRANTS_QA_MARKER,
  GROWTH_RESET_SERVICE_ROLE_DELETE_GRANT_TABLES,
} from "../lib/growth/reset/growth-engine-operational-reset-constants"

const ROOT = process.cwd()

function extractGrowthTablesFromMigration(sql: string): string[] {
  const tables: string[] = []
  const re = /'growth\.([a-z0-9_]+)'/g
  let match: RegExpExecArray | null
  while ((match = re.exec(sql)) !== null) {
    tables.push(match[1])
  }
  return [...new Set(tables)]
}

function runStructureCertification(): void {
  console.log(`\n=== ${GROWTH_RESET_SERVICE_ROLE_DELETE_GRANTS_QA_MARKER} (structure) ===\n`)

  const migrationPath = path.join(ROOT, GROWTH_RESET_SERVICE_ROLE_DELETE_GRANTS_MIGRATION)
  assert.ok(fs.existsSync(migrationPath), `missing migration: ${GROWTH_RESET_SERVICE_ROLE_DELETE_GRANTS_MIGRATION}`)

  const sql = fs.readFileSync(migrationPath, "utf8")
  const tables = extractGrowthTablesFromMigration(sql)

  assert.deepEqual(
    [...GROWTH_RESET_SERVICE_ROLE_DELETE_GRANT_TABLES].sort(),
    [...tables].sort(),
    "migration must grant DELETE on exactly the 11 listed growth tables",
  )

  assert.match(sql, /grant delete on table %s to service_role/i, "must grant DELETE to service_role only")
  assert.doesNotMatch(sql, /grant\s+select/i, "must not grant SELECT")
  assert.doesNotMatch(sql, /grant\s+insert/i, "must not grant INSERT")
  assert.doesNotMatch(sql, /grant\s+update/i, "must not grant UPDATE")
  assert.doesNotMatch(sql, /grant\s+all\s+on\s+schema/i, "must not grant schema-wide privileges")
  assert.doesNotMatch(sql, /create\s+policy/i, "must not change RLS policies")
  assert.doesNotMatch(sql, /alter\s+table.*row\s+level\s+security/i, "must not change RLS enablement")

  console.log("  ✓ migration file present")
  console.log("  ✓ exactly 11 growth tables with DELETE grants")
  console.log("  ✓ no broader schema-wide or non-DELETE grants")
  console.log("  ✓ no RLS policy changes")
}

runStructureCertification()
console.log(`\n${GROWTH_RESET_SERVICE_ROLE_DELETE_GRANTS_QA_MARKER} structure certification passed.\n`)
