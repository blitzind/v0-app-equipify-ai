/**
 * GE-AIOS-SUPERVISED-SEQUENCE-RECOMMENDATION-HANDOFF-FIX-1F — certification.
 * Run: pnpm test:ge-aios-supervised-sequence-handoff-1f
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateAvaOutreachPackageReadiness,
  GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
  mapApprovedPackageCadenceToPatternKeyCandidates,
  resolveApprovedPackageSequencePattern,
} from "../lib/growth/mission-center/growth-ava-outreach-sequence-handoff-1f"
import {
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_EVENT,
  GROWTH_AVA_OUTREACH_EXECUTION_RETRY_EVENT,
} from "../lib/growth/mission-center/growth-ava-outreach-execution-request-types"

const PHASE = "GE-AIOS-SUPERVISED-SEQUENCE-HANDOFF-1F" as const

const MOCK_PATTERNS = [
  { id: "pat-cold", key: "cold_email_only", isActive: true, confidenceScore: 0 },
  { id: "pat-email-call", key: "email_then_call", isActive: true, confidenceScore: 0 },
  { id: "pat-call-email", key: "call_then_email", isActive: true, confidenceScore: 0 },
]

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Supervised sequence handoff certification`)

  assert.equal(GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER, "ge-aios-supervised-sequence-handoff-1f-v1")

  const handoff = readSource("lib/growth/mission-center/growth-ava-outreach-sequence-handoff-1f.ts")
  assert.match(handoff, /email_first_multichannel/)
  assert.match(handoff, /approved_package_projection/)

  const service = readSource("lib/growth/mission-center/growth-ava-outreach-sequence-handoff-service-1f.ts")
  assert.match(service, /ensureApprovedPackageSequenceHandoffForLead/)
  assert.match(service, /runSequenceEnrollmentPreflight/)

  const executionService = readSource("lib/growth/mission-center/growth-ava-outreach-execution-request-service.ts")
  assert.match(executionService, /ensureApprovedPackageSequenceHandoffForLead/)
  assert.match(executionService, /retryAvaOutreachExecutionRequestFulfillment/)
  assert.match(executionService, /evaluateAvaOutreachExecutionReadinessForPackage/)
  assert.doesNotMatch(executionService, /\.catch\(\(\) => undefined\)/)

  const fulfillment = readSource(
    "lib/growth/mission-center/growth-ava-outreach-execution-request-fulfillment-service.ts",
  )
  assert.match(fulfillment, /patternId: sequencePatternId/)
  assert.doesNotMatch(fulfillment, /executeTransportSend|sendSms|runSequenceExecutionJob/)

  const registry = readSource("lib/growth/aios/ai-event-registry.ts")
  assert.match(registry, new RegExp(GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_EVENT))
  assert.match(registry, new RegExp(GROWTH_AVA_OUTREACH_EXECUTION_RETRY_EVENT))

  const retryRoute = readSource(
    "app/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/execution-requests/[requestId]/retry/route.ts",
  )
  assert.match(retryRoute, /retryAvaOutreachExecutionRequestFulfillment/)

  const completedWorkRoute = readSource(
    "app/api/platform/growth/ai-os/completed-work/packages/[packageId]/route.ts",
  )
  assert.match(
    completedWorkRoute,
    /evaluateAvaOutreachExecutionReadinessForPackage[\s\S]*growth-ava-outreach-sequence-handoff-service-1f/,
  )
  assert.doesNotMatch(
    completedWorkRoute,
    /evaluateAvaOutreachExecutionReadinessForPackage[\s\S]*growth-ava-outreach-execution-request-service/,
  )

  const card = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")
  assert.match(card, /executionReadiness/)
  assert.match(card, /Retry fulfillment/)
  assert.match(card, /authorizeBlocked/)

  // A — approved package with valid sequence recommendation
  const resolved = resolveApprovedPackageSequencePattern({
    recommendedSequence: "email_first_multichannel",
    recommendedChannel: "email",
    patterns: MOCK_PATTERNS,
  })
  assert.equal(resolved.patternKey, "email_then_call")
  assert.equal(resolved.patternId, "pat-email-call")

  const readyA = evaluateAvaOutreachPackageReadiness({
    recommendedSequence: "email_first_multichannel",
    recommendedChannel: "email",
    patterns: MOCK_PATTERNS,
  })
  assert.equal(readyA.approvalReady, true)
  assert.equal(readyA.executionReady, true)
  assert.equal(readyA.confidenceSource, "approved_package_projection")

  // B — missing sequence recommendation / unmapped cadence
  const readyB = evaluateAvaOutreachPackageReadiness({
    recommendedSequence: "unknown_custom_cadence",
    recommendedChannel: "email",
    patterns: MOCK_PATTERNS,
  })
  assert.equal(readyB.executionReady, false)
  assert.equal(readyB.blockCode, "no_sequence_pattern")

  // C — low-confidence canonical lead recommendation without pattern id
  const readyC = evaluateAvaOutreachPackageReadiness({
    recommendedSequence: "email_first_multichannel",
    recommendedChannel: "email",
    leadRecommendedSequenceConfidence: 12,
    leadRecommendedSequencePatternId: null,
    patterns: MOCK_PATTERNS,
  })
  assert.equal(readyC.executionReady, true)
  assert.equal(readyC.confidenceSource, "approved_package_projection")

  const blockedLeadOnly = evaluateAvaOutreachPackageReadiness({
    recommendedSequence: "unknown_custom_cadence",
    recommendedChannel: "email",
    leadRecommendedSequenceConfidence: 12,
    leadRecommendedSequencePatternId: null,
    patterns: MOCK_PATTERNS,
  })
  assert.equal(blockedLeadOnly.executionReady, false)

  // D/E — retry/idempotency wiring (source-level)
  assert.match(executionService, /execution_request_not_retryable/)
  assert.match(executionService, /retryHistory/)
  assert.match(fulfillment, /findActiveSequenceExecutionJob/)

  // F — approval persistence
  const repository = readSource(
    "lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-repository.ts",
  )
  assert.match(repository, /pendingHumanApproval: input.decision === "approved" \? false/)

  // G — outbound safety
  assert.doesNotMatch(executionService, /executeTransportSend|autonomy_outbound_enabled\s*=\s*true/)

  // H — multi-tenant (no org-specific branching)
  assert.doesNotMatch(handoff, /00757488|Block Imaging|equipify/i)
  assert.doesNotMatch(service, /00757488|Block Imaging|equipify/i)

  const candidates = mapApprovedPackageCadenceToPatternKeyCandidates(
    "email_first_multichannel",
    "email",
  )
  assert.deepEqual(candidates, ["email_then_call", "cold_email_only"])

  console.log(`[${PHASE}] passed`)
}

void main()
