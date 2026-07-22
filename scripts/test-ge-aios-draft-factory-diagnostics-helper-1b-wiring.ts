/**
 * GE-AIOS-DRAFT-FACTORY-DIAGNOSTICS-HELPER-1B — wiring certification.
 * Run: pnpm test:ge-aios-draft-factory-diagnostics-helper-1b-wiring
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AIOS_DRAFT_FACTORY_DIAGNOSTICS_HELPER_1A_QA_MARKER } from "@/lib/growth/training/draft-factory-diagnostics-latest-production-validation-1a"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[GE-AIOS-DRAFT-FACTORY-DIAGNOSTICS-HELPER-1B] wiring certification")

assert.equal(
  GROWTH_AIOS_DRAFT_FACTORY_DIAGNOSTICS_HELPER_1A_QA_MARKER,
  "ge-aios-draft-factory-diagnostics-helper-1a-v1",
)

const diagnostics = readSource(
  "lib/growth/training/draft-factory-diagnostics-latest-production-validation-1a.ts",
)
assert.match(diagnostics, /probeGrowthTablePostgrestAccessible/)
assert.match(diagnostics, /isGrowthPostgrestMissingTableError/)
assert.doesNotMatch(diagnostics, /head:\s*true,\s*count:\s*["']exact["']/)
assert.match(diagnostics, /buildDraftFactoryWakeDiagnosticTimeline/)
console.log("  ✓ diagnostics helper uses canonical PostgREST select probe (not head/count false positive)")

const observability = readSource(
  "lib/growth/training/draft-factory-wake-observability-production-validation-1a.ts",
)
assert.match(observability, /probeGrowthTablePostgrestAccessible/)
assert.doesNotMatch(observability, /head:\s*true,\s*count:\s*["']exact["'].*tableExists/)
console.log("  ✓ observability validator uses same canonical PostgREST probe")

const probe = readSource("lib/growth/schema-health/growth-postgrest-table-probe.ts")
assert.match(probe, /export async function probeGrowthTablePostgrestAccessible/)
assert.match(probe, /export function isGrowthPostgrestMissingTableError/)
assert.match(probe, /head\/count probes can false-positive/)
console.log("  ✓ shared growth PostgREST probe helper exported")

assert.ok(
  fs.existsSync(path.join(ROOT, "scripts/validate-ge-aios-draft-factory-diagnostics-latest-production.ts")),
)
console.log("  ✓ production validator script present")

console.log("GE-AIOS-DRAFT-FACTORY-DIAGNOSTICS-HELPER-1B wiring certification passed")
