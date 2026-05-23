/**
 * Regression checks for Growth Engine workflow health engine.
 * Run: pnpm test:growth-workflow-health
 */
import assert from "node:assert/strict"
import { computeGrowthLeadWorkflowHealth } from "../lib/growth/workflow-health"

const now = new Date("2026-05-18T12:00:00.000Z")

assert.equal(
  computeGrowthLeadWorkflowHealth({
    status: "qualified",
    score: 80,
    contactPhone: "555-0100",
    primaryDecisionMakerPhone: null,
    decisionMakerStatus: "none",
    lastResearchedAt: "2026-05-01T00:00:00.000Z",
    latestResearchRunId: "run-id",
    lastHumanTouchAt: "2026-03-01T00:00:00.000Z",
    followUpAt: null,
    websiteFetchStatus: "ok",
    website: "https://example.com",
    nextBestAction: "call_primary_contact",
    agingBucket: "critical",
    voicemailCount45d: 0,
    now,
  }).status,
  "stalled",
)

assert.equal(
  computeGrowthLeadWorkflowHealth({
    status: "call_ready",
    score: 72,
    contactPhone: "555-0100",
    primaryDecisionMakerPhone: null,
    decisionMakerStatus: "confirmed",
    lastResearchedAt: "2026-05-17T00:00:00.000Z",
    latestResearchRunId: "run-id",
    lastHumanTouchAt: "2026-05-17T00:00:00.000Z",
    followUpAt: null,
    websiteFetchStatus: "ok",
    website: "https://example.com",
    nextBestAction: "call_primary_contact",
    agingBucket: "new",
    voicemailCount45d: 0,
    now,
  }).status,
  "healthy",
)

console.log("growth workflow health tests passed")
