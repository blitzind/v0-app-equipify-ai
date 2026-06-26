/**
 * GE-AIOS-RUNTIME-1 — Mission Planning route guard certification.
 * Run: pnpm test:ge-aios-runtime-1-mission-planning-route-guard-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_RUNTIME_1_PHASE,
  GROWTH_AI_OS_MISSION_ID_INVALID_ERROR,
  GROWTH_AI_OS_SAFE_INDEX_HREF,
  buildAiOsMissionPlanningHref,
  isAiOsRouteParamPlaceholder,
  resolveAiOsMissionIdParam,
} from "../lib/growth/aios/ai-os-mission-route-params"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_RUNTIME_1_PHASE}] Mission Planning route guard certification`)

assert.equal(GROWTH_AI_OS_SAFE_INDEX_HREF, "/growth/objectives")
assert.equal(isAiOsRouteParamPlaceholder("[missionId]"), true)
assert.equal(isAiOsRouteParamPlaceholder("[leadId]"), true)
assert.equal(isAiOsRouteParamPlaceholder("d702724e-6565-4db7-a2f0-d686fea7623a"), false)

const placeholder = resolveAiOsMissionIdParam("[missionId]")
assert.equal(placeholder.ok, false)
if (!placeholder.ok) {
  assert.equal(placeholder.error, GROWTH_AI_OS_MISSION_ID_INVALID_ERROR)
  assert.equal(placeholder.reason, "placeholder")
}

const invalid = resolveAiOsMissionIdParam("not-a-uuid")
assert.equal(invalid.ok, false)
if (!invalid.ok) assert.equal(invalid.reason, "invalid")

const valid = resolveAiOsMissionIdParam("d702724e-6565-4db7-a2f0-d686fea7623a")
assert.equal(valid.ok, true)
if (valid.ok) {
  assert.equal(
    buildAiOsMissionPlanningHref(valid.missionId),
    "/growth/os/missions/d702724e-6565-4db7-a2f0-d686fea7623a/planning",
  )
}

assert.equal(buildAiOsMissionPlanningHref("[missionId]"), null)
assert.equal(buildAiOsMissionPlanningHref(null), null)

const guardedFiles = [
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/route.ts",
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/preview/route.ts",
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/approve/route.ts",
  "app/(growth)/growth/os/missions/[missionId]/planning/page.tsx",
  "components/growth/ai-os/growth-ai-os-mission-planning-review-panel.tsx",
  "components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx",
  "lib/growth/aios/ai-executive-mission-planning-review-service.ts",
]

for (const file of guardedFiles) {
  const source = readSource(file)
  const hasGuard =
    source.includes("resolveAiOsMissionIdParam") ||
    source.includes("resolveAiOsMissionIdFromRouteParam") ||
    source.includes("buildAiOsMissionPlanningHref")
  assert.ok(hasGuard, file)
}

const readRoute = readSource("app/api/platform/growth/ai-os/missions/[missionId]/planning/route.ts")
assert.ok(readRoute.includes("resolveAiOsMissionIdFromRouteParam"))
assert.ok(readRoute.includes("aiOsInvalidMissionIdResponse"))
assert.ok(readRoute.includes("aiOsPlanningReviewErrorStatus"))

const reviewService = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.ok(reviewService.includes("assertResolvableAiOsMissionId"))
assert.ok(reviewService.includes("resolveAiOsMissionIdParam"))

const pilotPanel = readSource("components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx")
assert.ok(pilotPanel.includes("buildAiOsMissionPlanningHref"))
assert.equal(pilotPanel.includes("/growth/ai-os/missions/${observation.missionId}/planning"), false)

const forbiddenPlaceholderLinks = [
  'href="/growth/ai-os/missions/[missionId]/planning"',
  "href={`/growth/ai-os/missions/[missionId]/planning`}",
  'href="/growth/ai-os/missions/${`[missionId]`}/planning"',
]

for (const file of ["components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx"]) {
  const source = readSource(file)
  for (const pattern of forbiddenPlaceholderLinks) {
    assert.equal(source.includes(pattern), false, `${file} must not expose placeholder planning href`)
  }
}

console.log(`[${GROWTH_AIOS_RUNTIME_1_PHASE}] PASS — Mission Planning route guard certified (local)`)
