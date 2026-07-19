/**
 * GE-AIOS-OPERATOR-UX-1C — Decouple package authorization from transport execution readiness.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateAvaOutreachPackageReadiness,
} from "../lib/growth/mission-center/growth-ava-outreach-sequence-handoff-1f"
import {
  resolvePackageAuthorizationReadiness,
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS_PENDING_EXECUTION,
  GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_DETAIL,
} from "../lib/growth/workspace/ux-1a/review/growth-operator-package-review-copy-1a"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[ge-aios-operator-ux-1c-package-transport-decouple-v1] Operator UX 1C certification")

const MOCK_PATTERNS = [
  { id: "pat-email-call", key: "email_then_call", isActive: true, confidenceScore: 0 },
]

const unresolvedSequence = evaluateAvaOutreachPackageReadiness({
  recommendedSequence: "unknown_custom_cadence",
  recommendedChannel: "email",
  patterns: MOCK_PATTERNS,
})
assert.equal(unresolvedSequence.approvalReady, true)
assert.equal(unresolvedSequence.executionReady, false)
console.log("  ✓ unresolved sequence keeps approvalReady true and executionReady false")

const completePackage = resolvePackageAuthorizationReadiness({
  packageId: "outreach-prep:lead-1:2026",
  leadId: "lead-1",
  generatedAssetCount: 2,
})
assert.equal(completePackage.ready, true)
console.log("  ✓ complete package passes authorization readiness")

const incompletePackage = resolvePackageAuthorizationReadiness({
  packageId: "outreach-prep:lead-1:2026",
  leadId: "lead-1",
  generatedAssetCount: 0,
})
assert.equal(incompletePackage.ready, false)
console.log("  ✓ incomplete package remains authorization-blocked")

const card = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")
const layout = readSource("components/growth/ai-os/approvals/growth-ava-package-progressive-review-layout.tsx")
assert.match(card, /resolvePackageAuthorizationReadiness/)
assert.match(card, /transportExecutionReady/)
assert.doesNotMatch(card, /Authorize is blocked until sequence enrollment readiness/)
assert.doesNotMatch(card, /Review-ready only/)
assert.doesNotMatch(card, /Authorize would fail fulfillment preflight/)
assert.match(card, /GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_TITLE/)
assert.match(card, /GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS_PENDING_EXECUTION/)
console.log("  ✓ canonical card gates Authorize on package readiness, not sequence readiness")

const executionService = readSource("lib/growth/mission-center/growth-ava-outreach-execution-request-service.ts")
assert.match(executionService, /pending_execution_setup/)
assert.match(executionService, /if \(!readiness\.executionReady\)/)
assert.doesNotMatch(
  executionService,
  /if \(!readiness\.executionReady\) \{\s*throw new Error\(readiness\.blockCode \?\? "execution_not_ready"\)/,
)
assert.match(executionService, /executionRequestId: null/)
console.log("  ✓ backend records package authorization without execution fulfillment when transport is not ready")

const actionRoute = readSource(
  "app/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages/[packageId]/action/route.ts",
)
assert.match(actionRoute, /Transport setup remains pending/)
assert.match(actionRoute, /package_incomplete/)
console.log("  ✓ action route messaging distinguishes authorization from execution setup")

assert.doesNotMatch(card, /executeTransportSend|autonomy_outbound_enabled\s*=\s*true/)
assert.match(card, /Transport setup incomplete|Outbound transport is currently blocked|transportSummary/)
assert.match(layout, /Transport readiness/)
console.log("  ✓ presentation preserves transport block without implying send on authorize")

assert.match(
  GROWTH_OPERATOR_PACKAGE_AUTHORIZE_SUCCESS_PENDING_EXECUTION,
  /execution setup is complete/,
)
assert.match(GROWTH_OPERATOR_PACKAGE_TRANSPORT_SETUP_INCOMPLETE_DETAIL, /can be authorized/)
console.log("  ✓ operator copy separates package authorization from transport execution")

console.log("\nAll operator UX 1C decoupling tests passed.")
