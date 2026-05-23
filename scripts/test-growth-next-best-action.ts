/**
 * Regression checks for Growth Engine next-best-action engine.
 * Run: pnpm test:growth-next-best-action
 */
import assert from "node:assert/strict"
import { computeGrowthLeadNextBestAction } from "../lib/growth/next-best-action"

const now = new Date("2026-05-18T12:00:00.000Z")

assert.equal(
  computeGrowthLeadNextBestAction({
    status: "call_ready",
    score: 85,
    website: "https://example.com",
    websiteFetchStatus: "blocked",
    lastResearchedAt: "2026-05-17T12:00:00.000Z",
    latestResearchRunId: "run-id",
    contactPhone: "555-0100",
    callDisposition: null,
    followUpAt: null,
    recommendedNextAction: "Verify operations on a call.",
    decisionMakerStatus: "none",
    primaryDecisionMakerPhone: null,
    now,
  }).action,
  "call_primary_contact",
)

assert.equal(
  computeGrowthLeadNextBestAction({
    status: "qualified",
    score: 72,
    website: "https://example.com",
    websiteFetchStatus: "ok",
    lastResearchedAt: "2026-05-17T12:00:00.000Z",
    latestResearchRunId: "run-id",
    contactPhone: "555-0100",
    callDisposition: null,
    followUpAt: null,
    recommendedNextAction: null,
    decisionMakerStatus: "none",
    primaryDecisionMakerPhone: null,
    now,
  }).action,
  "call_primary_contact",
)

assert.equal(
  computeGrowthLeadNextBestAction({
    status: "qualified",
    score: 72,
    website: "https://example.com",
    websiteFetchStatus: "ok",
    lastResearchedAt: "2026-05-17T12:00:00.000Z",
    latestResearchRunId: "run-id",
    contactPhone: "555-0100",
    callDisposition: null,
    followUpAt: null,
    recommendedNextAction: null,
    decisionMakerStatus: "confirmed",
    primaryDecisionMakerPhone: "555-0200",
    now,
  }).action,
  "call_decision_maker",
)

assert.equal(
  computeGrowthLeadNextBestAction({
    status: "qualified",
    score: 72,
    website: "https://example.com",
    websiteFetchStatus: "ok",
    lastResearchedAt: "2026-05-17T12:00:00.000Z",
    latestResearchRunId: "run-id",
    contactPhone: null,
    callDisposition: null,
    followUpAt: null,
    recommendedNextAction: null,
    decisionMakerStatus: "none",
    primaryDecisionMakerPhone: null,
    now,
  }).action,
  "find_decision_maker",
)

console.log("growth next best action tests passed")
