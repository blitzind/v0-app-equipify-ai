/**
 * GE-AIOS-25B — Runtime certification for refined cognitive projections.
 * Run: pnpm test:ge-aios-25b-cognitive-workspace-runtime
 */
import assert from "node:assert/strict"
import {
  buildAvaAssessmentSummaryBullets,
  buildAvaCurrentAssessment,
  buildAvaExecutionProgressTimeline,
  buildAvaWhatsChanged,
  captureAvaVisitSnapshot,
} from "../lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers"
import {
  listAvaRawDomainSlots,
  resolveAvaRawDomainChildren,
} from "../lib/growth/cognitive-workspace/growth-cognitive-raw-domain-resolver"
import { GROWTH_AVA_COGNITIVE_WORKSPACE_REFINEMENT_QA_MARKER } from "../lib/growth/cognitive-workspace/growth-cognitive-workspace-types"
import type { GrowthLead } from "../lib/growth/types"

console.log("[GE-AIOS-25B] Cognitive Workspace runtime certification")

assert.equal(
  GROWTH_AVA_COGNITIVE_WORKSPACE_REFINEMENT_QA_MARKER,
  "ge-aios-25b-ava-cognitive-workspace-refinement-v1",
)

assert.doesNotThrow(() => {
  for (const slot of listAvaRawDomainSlots()) {
    resolveAvaRawDomainChildren(undefined, slot.domainId)
  }
})

const emptyLead = {
  id: "empty",
  companyName: "Empty Co",
  status: "new",
  decisionMakerStatus: null,
  nextBestAction: null,
  website: null,
  contactEmail: null,
  callAttemptCount: 0,
  opportunityBlockers: [],
  opportunityAccelerators: [],
} as unknown as GrowthLead

assert.doesNotThrow(() => {
  const assessment = buildAvaCurrentAssessment({ lead: emptyLead })
  assert.ok(Array.isArray(assessment.summaryBullets))
  assert.ok(assessment.summaryBullets.length >= 1)
  assert.ok(Array.isArray(buildAvaAssessmentSummaryBullets({ lead: emptyLead })))
  const steps = buildAvaExecutionProgressTimeline({ lead: emptyLead })
  assert.equal(steps.length, 8)
  assert.ok(steps.every((s) => s.status === "done" || s.status === "current" || s.status === "upcoming"))
  const snap = captureAvaVisitSnapshot({ lead: emptyLead })
  const delta = buildAvaWhatsChanged({ current: snap, previous: null })
  assert.equal(delta.isFirstVisit, true)
  assert.ok(delta.bullets.length >= 1)
})

const researched = {
  ...emptyLead,
  id: "researched",
  status: "enriched",
  website: "https://example.com",
  lastProspectResearchedAt: new Date().toISOString(),
  latestProspectResearchRunId: "run-1",
  decisionMakerStatus: "none",
  nextBestAction: "find_decision_maker",
  score: 55,
} as unknown as GrowthLead

const timeline = buildAvaExecutionProgressTimeline({ lead: researched })
assert.equal(timeline.find((s) => s.id === "researched")?.status, "done")
assert.equal(timeline.find((s) => s.id === "decision_maker")?.status, "current")

console.log("  ✓ refined projections execute without throw")
console.log("[GE-AIOS-25B-RUNTIME] PASS")
