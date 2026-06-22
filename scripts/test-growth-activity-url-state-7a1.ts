/**
 * GS-GROWTH-OPS-7A.1 — Activity center URL state persistence certification.
 * Run: pnpm test:growth-activity-url-state-7a1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthActivityWorkspaceHref,
  GROWTH_ACTIVITY_FILTER_URL_PARAM,
  GROWTH_ACTIVITY_RANGE_URL_PARAM,
  GROWTH_ACTIVITY_SEARCH_URL_PARAM,
  GROWTH_OPS_URL_STATE_7A1_QA_MARKER,
  readGrowthActivityUrlState,
} from "../lib/growth/navigation/growth-workspace-url-state-7a1"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-7A.1 Activity URL State Certification ===\n")
  assert.ok(GROWTH_OPS_URL_STATE_7A1_QA_MARKER)

  const workspace = readSource("components/growth/activity/growth-activity-workspace.tsx")
  assert.match(workspace, /readGrowthActivityUrlState/)
  assert.match(workspace, /buildGrowthActivityWorkspaceHref/)
  assert.match(workspace, /router\.replace/)
  assert.match(workspace, /focusedRailQueue/)
  console.log("  ✓ activity workspace syncs filter/search/range/rail to URL")

  const rail = readSource("components/growth/activity/growth-activity-high-intent-rail.tsx")
  assert.match(rail, /focusedQueueId/)
  assert.match(rail, /onFocusQueue/)
  console.log("  ✓ activity rail queue focus persists via URL param")

  const href = buildGrowthActivityWorkspaceHref({
    filter: "high-intent",
    search: "acme",
    range: "today",
    rail: "hot-prospects",
  })
  assert.match(href, new RegExp(`${GROWTH_ACTIVITY_FILTER_URL_PARAM}=high-intent`))
  assert.match(href, new RegExp(`${GROWTH_ACTIVITY_SEARCH_URL_PARAM}=acme`))
  assert.match(href, new RegExp(`${GROWTH_ACTIVITY_RANGE_URL_PARAM}=today`))
  assert.match(href, /rail=hot-prospects/)

  const parsed = readGrowthActivityUrlState({
    get(name: string) {
      const params = new URLSearchParams(href.split("?")[1] ?? "")
      return params.get(name)
    },
  })
  assert.equal(parsed.filterId, "high-intent")
  assert.equal(parsed.search, "acme")
  assert.equal(parsed.range, "today")
  assert.equal(parsed.railQueue, "hot-prospects")
  console.log("  ✓ activity URL builders round-trip filter/search/range/rail")

  console.log("\nGS-GROWTH-OPS-7A.1 activity URL state certification passed.\n")
}

main()
