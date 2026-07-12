/**
 * GE-AIOS-HOTFIX-25A-2A — Cognitive Workspace runtime crash regression.
 * Executes the production mapping path (not source-string-only).
 * Run: pnpm test:ge-aios-hotfix-25a-2a-cognitive-workspace-runtime
 */
import assert from "node:assert/strict"
import {
  listAvaRawDomainSlots,
  resolveAvaRawDomainChildren,
  resolveAvaRawDomainPersistKey,
  resolveCognitiveDomainFromFocus,
} from "../lib/growth/cognitive-workspace/growth-cognitive-raw-domain-resolver"
import {
  buildAvaBeliefs,
  buildAvaCurrentAssessment,
  buildAvaEvidenceFacts,
} from "../lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers"
import { GROWTH_AVA_RAW_DOMAIN_ORDER } from "../lib/growth/cognitive-workspace/growth-cognitive-workspace-types"
import { applyGrowthCommandLeadFocusExpand, resolveAvaRawDomainForFocus } from "../lib/growth/command/command-lead-focus"
import type { GrowthLead } from "../lib/growth/types"

console.log("[GE-AIOS-HOTFIX-25A-2A] Cognitive Workspace runtime certification")

// --- Exact crash path: rawDomains undefined + domainId 'research' ---
assert.doesNotThrow(() => {
  for (const domainId of GROWTH_AVA_RAW_DOMAIN_ORDER) {
    resolveAvaRawDomainChildren(undefined, domainId)
    resolveAvaRawDomainChildren(null, domainId)
  }
})
assert.equal(resolveAvaRawDomainChildren(undefined, "research"), null)
assert.equal(resolveAvaRawDomainChildren(null, "research"), null)
assert.equal(resolveAvaRawDomainChildren({}, "research"), null)
console.log("  ✓ undefined/null rawDomains never throws on .research lookup")

const slots = listAvaRawDomainSlots()
assert.equal(slots.length, 6)
assert.equal(slots[0]?.domainId, "research")
assert.ok(slots.every((s) => s.elementId && s.title && s.persistKey))
console.log("  ✓ listAvaRawDomainSlots returns 6 valid slots")

// Simulate collapsed Raw render loop with missing domains (production crash repro)
assert.doesNotThrow(() => {
  for (const slot of listAvaRawDomainSlots()) {
    const children = resolveAvaRawDomainChildren(undefined, slot.domainId)
    assert.equal(children, null)
  }
})
console.log("  ✓ collapsed Raw render loop safe without rawDomains")

// Valid domains with sparse map
const partial = { research: "ok" as const }
assert.equal(resolveAvaRawDomainChildren(partial, "research"), "ok")
assert.equal(resolveAvaRawDomainChildren(partial, "revenue"), null)
console.log("  ✓ partial domain map resolves present keys only")

// Focus resolution — valid + invalid must never throw
const focusCases = [
  null,
  undefined,
  "",
  "   ",
  "research",
  "decision-makers",
  "company-intelligence",
  "meeting",
  "meetings",
  "sequence",
  "timeline",
  "unknown-value",
  "revenue",
  "execution",
]
for (const focus of focusCases) {
  assert.doesNotThrow(() => resolveCognitiveDomainFromFocus(focus as string | null | undefined))
  assert.doesNotThrow(() => resolveAvaRawDomainForFocus(focus as string | null | undefined))
}
assert.equal(resolveCognitiveDomainFromFocus("research"), "research")
assert.equal(resolveCognitiveDomainFromFocus("decision-makers"), "research")
assert.equal(resolveCognitiveDomainFromFocus("meetings"), "communication")
assert.equal(resolveCognitiveDomainFromFocus("company-intelligence"), null)
assert.equal(resolveCognitiveDomainFromFocus("timeline"), null)
assert.equal(resolveCognitiveDomainFromFocus("unknown-value"), null)
assert.equal(resolveCognitiveDomainFromFocus(""), null)
console.log("  ✓ focus resolver fail-closed for invalid/stale values")

assert.equal(resolveAvaRawDomainPersistKey("research"), "ava-raw-domain-research")
assert.equal(resolveAvaRawDomainPersistKey(null), null)
console.log("  ✓ persist key resolver safe")

// applyGrowthCommandLeadFocusExpand must not throw without window/localStorage side effects failing hard
assert.doesNotThrow(() => applyGrowthCommandLeadFocusExpand(null))
assert.doesNotThrow(() => applyGrowthCommandLeadFocusExpand(""))
assert.doesNotThrow(() => applyGrowthCommandLeadFocusExpand("unknown-value"))
assert.doesNotThrow(() => applyGrowthCommandLeadFocusExpand("research"))
console.log("  ✓ focus expand helpers fail-closed")

// Sparse production-like lead — mappers must not throw
const sparseLead = {
  id: "sparse",
  companyName: "Sparse Co",
  status: "new",
  decisionMakerStatus: null,
  nextBestAction: null,
  opportunityAccelerators: [],
  opportunityBlockers: [],
  opportunityReadinessTopSignals: [],
} as unknown as GrowthLead

assert.doesNotThrow(() => {
  buildAvaCurrentAssessment({ lead: sparseLead, prospectRun: null })
  buildAvaBeliefs({ lead: sparseLead, prospectRun: null })
  buildAvaEvidenceFacts({ lead: sparseLead, prospectRun: null })
})
const sparseAssessment = buildAvaCurrentAssessment({ lead: sparseLead })
assert.ok(sparseAssessment.briefingParagraphs.length >= 1)
console.log("  ✓ sparse lead projections do not throw")

console.log("[GE-AIOS-HOTFIX-25A-2A] PASS")
