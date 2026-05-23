/**
 * Regression checks for Growth Engine call priority engine.
 * Run: pnpm test:growth-call-priority
 */
import assert from "node:assert/strict"
import {
  computeGrowthCallPriority,
  hasUsableResearch,
  isNeedsWebsiteResearch,
  matchesCallQueueFilter,
} from "../lib/growth/call-priority"

const now = new Date("2026-05-18T12:00:00.000Z")

assert.equal(
  computeGrowthCallPriority({
    researchPriority: "normal",
    score: 80,
    status: "call_ready",
    lastResearchedAt: "2026-05-17T12:00:00.000Z",
    recommendedNextAction: "Schedule a discovery call.",
    leadNotes: null,
    manualResearchNotes: null,
    callDisposition: null,
    followUpAt: null,
    callPriorityOverride: null,
    now,
  }).effectiveScore,
  computeGrowthCallPriority({
    researchPriority: "normal",
    score: 80,
    status: "call_ready",
    lastResearchedAt: "2026-05-17T12:00:00.000Z",
    recommendedNextAction: "Schedule a discovery call.",
    leadNotes: null,
    manualResearchNotes: null,
    callDisposition: null,
    followUpAt: null,
    callPriorityOverride: null,
    now,
  }).computedScore,
)

assert.equal(
  computeGrowthCallPriority({
    researchPriority: "normal",
    score: 40,
    status: "qualified",
    lastResearchedAt: "2026-05-17T12:00:00.000Z",
    recommendedNextAction: null,
    leadNotes: null,
    manualResearchNotes: null,
    callDisposition: null,
    followUpAt: null,
    callPriorityOverride: 92,
    now,
  }).effectiveScore,
  92,
)

assert.equal(
  computeGrowthCallPriority({
    researchPriority: "high",
    score: 75,
    status: "call_ready",
    lastResearchedAt: "2026-05-17T12:00:00.000Z",
    recommendedNextAction: null,
    leadNotes: null,
    manualResearchNotes: null,
    callDisposition: null,
    followUpAt: null,
    callPriorityOverride: 55,
    now,
  }).effectiveScore,
  55,
)

assert.equal(
  computeGrowthCallPriority({
    researchPriority: "normal",
    score: 80,
    status: "call_ready",
    lastResearchedAt: "2026-05-17T12:00:00.000Z",
    recommendedNextAction: null,
    leadNotes: null,
    manualResearchNotes: null,
    callDisposition: "follow_up_later",
    followUpAt: "2026-05-25T12:00:00.000Z",
    callPriorityOverride: null,
    now,
  }).excludedFromQueue,
  true,
)

assert.equal(hasUsableResearch("2026-05-01T00:00:00.000Z", "run-id"), true)
assert.equal(hasUsableResearch(null, "run-id"), false)

assert.equal(
  isNeedsWebsiteResearch({ website: null, websiteFetchStatus: null, hasUsableResearch: false }),
  true,
)

assert.equal(
  isNeedsWebsiteResearch({ website: "https://example.com", websiteFetchStatus: "blocked", hasUsableResearch: true }),
  true,
)

assert.equal(
  isNeedsWebsiteResearch({ website: "https://example.com", websiteFetchStatus: "error", hasUsableResearch: true }),
  true,
)

assert.equal(
  isNeedsWebsiteResearch({ website: "https://example.com", websiteFetchStatus: "ok", hasUsableResearch: true }),
  false,
)

assert.equal(
  matchesCallQueueFilter(
    "call_ready",
    {
      status: "call_ready",
      score: 72,
      lastResearchedAt: "2026-05-01T00:00:00.000Z",
      latestResearchRunId: "run-id",
      callDisposition: null,
      followUpAt: null,
      website: "https://example.com",
      websiteFetchStatus: "ok",
    },
    now,
  ),
  true,
)

assert.equal(
  matchesCallQueueFilter(
    "needs_website_research",
    {
      status: "qualified",
      score: 72,
      lastResearchedAt: "2026-05-01T00:00:00.000Z",
      latestResearchRunId: "run-id",
      callDisposition: null,
      followUpAt: null,
      website: null,
      websiteFetchStatus: null,
    },
    now,
  ),
  true,
)

console.log("growth call priority tests passed")
