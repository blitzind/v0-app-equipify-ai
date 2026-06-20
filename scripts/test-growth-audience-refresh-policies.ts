/**
 * GS-RG-2B — Refresh policy metadata certification (local static).
 * Run: pnpm test:growth-audience-refresh-policies
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeSuggestedNextRefreshAt,
  GROWTH_AUDIENCE_REFRESH_POLICIES,
  GROWTH_AUDIENCE_REFRESH_POLICY_INTERVALS,
  normalizeAudienceRefreshPolicy,
  resolveRefreshIntervalDays,
} from "../lib/growth/audiences/growth-audience-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2B Refresh Policies Certification ===\n")

  assert.deepEqual([...GROWTH_AUDIENCE_REFRESH_POLICIES], ["manual", "daily", "weekly"])
  assert.equal(resolveRefreshIntervalDays("manual"), null)
  assert.equal(resolveRefreshIntervalDays("daily"), GROWTH_AUDIENCE_REFRESH_POLICY_INTERVALS.daily)
  assert.equal(resolveRefreshIntervalDays("weekly"), GROWTH_AUDIENCE_REFRESH_POLICY_INTERVALS.weekly)
  assert.equal(normalizeAudienceRefreshPolicy("manual_only"), "manual")
  assert.ok(computeSuggestedNextRefreshAt("daily"))
  assert.equal(computeSuggestedNextRefreshAt("manual"), null)

  const migration = readSource("supabase/migrations/20270901150000_growth_dynamic_audiences_gs_rg_2b.sql")
  assert.match(migration, /refresh_interval_days/)
  assert.match(migration, /next_refresh_at/)

  const repo = readSource("lib/growth/audiences/growth-audience-repository.ts")
  assert.match(repo, /last_refresh_at/)
  assert.match(migration, /informational only/i)

  const route = readSource("app/api/platform/growth/audiences/[audienceId]/route.ts")
  assert.match(route, /updateGrowthAudienceRefreshPolicy/)
  assert.match(route, /PATCH/)

  const detail = readSource("components/growth/audiences/growth-audience-detail.tsx")
  assert.match(detail, /informational/)
  assert.match(detail, /updateRefreshPolicy/)
  assert.doesNotMatch(detail, /setInterval/)
  assert.doesNotMatch(detail, /cron/i)

  console.log("  ✓ Informational refresh policies — no auto execution")
  console.log("\nGS-RG-2B refresh policies certification passed.\n")
}

main()
