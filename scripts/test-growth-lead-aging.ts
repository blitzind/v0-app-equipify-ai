/**
 * Regression checks for Growth Engine lead aging buckets.
 * Run: pnpm test:growth-lead-aging
 */
import assert from "node:assert/strict"
import { computeGrowthLeadAging } from "../lib/growth/lead-aging"

const now = new Date("2026-05-18T12:00:00.000Z")

assert.deepEqual(computeGrowthLeadAging("2026-05-17T12:00:00.000Z", now), {
  agingDays: 1,
  agingBucket: "new",
})

assert.deepEqual(computeGrowthLeadAging("2026-04-20T12:00:00.000Z", now), {
  agingDays: 28,
  agingBucket: "active",
})

assert.deepEqual(computeGrowthLeadAging("2026-05-01T12:00:00.000Z", now), {
  agingDays: 17,
  agingBucket: "warming",
})

assert.deepEqual(computeGrowthLeadAging("2026-02-01T12:00:00.000Z", now), {
  agingDays: 106,
  agingBucket: "critical",
})

console.log("growth lead aging tests passed")
