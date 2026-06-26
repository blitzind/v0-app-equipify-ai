/**
 * GE-AIOS-3E — Mission Planning Review Surface certification.
 * Run: pnpm test:ge-aios-3e-executive-mission-planning-review-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AI_EXECUTIVE_MISSION_PLANNING_REVIEW_RUNTIME_RULE,
  GROWTH_AIOS_3E_PHASE,
  GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER,
} from "../lib/growth/aios/ai-executive-mission-planning-review-types"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"
import { isAiWorkOrderActiveStatus } from "../lib/growth/aios/ai-work-order-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_3E_PHASE}] Mission Planning Review Surface certification`)

assert.equal(
  GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER,
  "growth-aios-3e-executive-mission-planning-review-v1",
)

assert.ok(AI_EXECUTIVE_MISSION_PLANNING_REVIEW_RUNTIME_RULE.includes("dry-run previews"))
assert.ok(AI_EXECUTIVE_MISSION_PLANNING_REVIEW_RUNTIME_RULE.includes("explicit operator approval"))
assert.ok(AI_EXECUTIVE_MISSION_PLANNING_REVIEW_RUNTIME_RULE.includes("never executes"))

assert.ok(isAiWorkOrderActiveStatus("executing"))
assert.equal(isAiWorkOrderActiveStatus("completed"), false)

const reviewServiceSource = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.ok(reviewServiceSource.includes("fetchExecutiveMissionPlanningReviewReadModel"))
assert.ok(reviewServiceSource.includes("previewExecutiveMissionPlanningReview"))
assert.ok(reviewServiceSource.includes("approveExecutiveMissionPlanningReview"))
assert.ok(reviewServiceSource.includes('mode: "dry_run"'))
assert.ok(reviewServiceSource.includes('mode: "create"'))
assert.ok(reviewServiceSource.includes("executive.planning_review_created"))
assert.ok(reviewServiceSource.includes("executive.planning_review_approved"))
assert.ok(reviewServiceSource.includes("runExecutiveMissionPlanningTick"))
for (const pattern of [
  "claimAiOsWorkOrder",
  "transitionAiWorkOrder",
  'toStatus: "executing"',
  "invokeAiOsProviderWithContextPackage",
]) {
  assert.equal(reviewServiceSource.includes(pattern), false, `review service must not reference ${pattern}`)
}

const previewRouteSource = readSource(
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/preview/route.ts",
)
assert.ok(previewRouteSource.includes("previewExecutiveMissionPlanningReview"))
assert.equal(previewRouteSource.includes("approveExecutiveMissionPlanningReview"), false)

const approveRouteSource = readSource(
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/approve/route.ts",
)
assert.ok(approveRouteSource.includes("approveExecutiveMissionPlanningReview"))
assert.equal(approveRouteSource.includes("previewExecutiveMissionPlanningReview"), false)

const readRouteSource = readSource("app/api/platform/growth/ai-os/missions/[missionId]/planning/route.ts")
assert.ok(readRouteSource.includes("fetchExecutiveMissionPlanningReviewReadModel"))
assert.equal(readRouteSource.includes("runExecutiveMissionPlanningTick"), false)

const uiSource = readSource("components/growth/ai-os/growth-ai-os-mission-planning-review-panel.tsx")
const approvalUi = readSource(
  "components/growth/ai-os/executive-planning-review/growth-ai-os-approval-action-card.tsx",
)
assert.ok(uiSource.includes("/planning/preview"))
assert.ok(uiSource.includes("/planning/approve"))
assert.ok(uiSource.includes("Run dry-run preview") || approvalUi.includes("Run dry-run preview"))
assert.ok(uiSource.includes("prepareDecision") || approvalUi.includes("prepareDecision"))

const reviewFiles = [
  "lib/growth/aios/ai-executive-mission-planning-review-types.ts",
  "lib/growth/aios/ai-executive-mission-planning-review-service.ts",
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/route.ts",
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/preview/route.ts",
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/approve/route.ts",
  "components/growth/ai-os/growth-ai-os-mission-planning-review-panel.tsx",
  "app/(growth)/growth/os/missions/[missionId]/planning/page.tsx",
]
for (const file of reviewFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

assert.ok(lookupAiEventRegistryEntry("executive.planning_review_created"))
assert.ok(lookupAiEventRegistryEntry("executive.planning_review_approved"))
assert.ok(lookupAiEventRegistryEntry("executive.planning_tick_started"))
assert.ok(lookupAiEventRegistryEntry("executive.work_order_proposed"))
assert.ok(lookupAiEventRegistryEntry("executive.planning_tick_completed"))

console.log(`[${GROWTH_AIOS_3E_PHASE}] PASS — Mission Planning Review Surface certified (local)`)
