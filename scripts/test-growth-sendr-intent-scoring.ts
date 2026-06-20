/**
 * GS-SENDR-2E — Intent scoring certification.
 * Run: pnpm test:growth-sendr-intent-scoring
 */
import assert from "node:assert/strict"
import {
  calculateSendrEngagementRates,
  calculateSendrIntentScore,
  emptySendrIntentSignals,
  resolveSendrIntentLevel,
} from "../lib/growth/sendr/growth-sendr-intent-scoring"
import { GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS } from "../lib/growth/sendr/growth-sendr-config"

function main(): void {
  console.log("\n=== GS-SENDR-2E Intent Scoring Certification ===\n")

  const empty = calculateSendrIntentScore(emptySendrIntentSignals())
  assert.equal(empty.intentScore, 0)
  assert.equal(empty.intentLevel, "low")

  const high = calculateSendrIntentScore({
    ...emptySendrIntentSignals(),
    bookingCompletes: 2,
    videoCompletes: 1,
    ctaClicks: 2,
  })
  assert.equal(high.intentLevel, "high")
  assert.ok(high.intentScore >= 67)
  assert.ok(high.intentScore <= 100)

  const again = calculateSendrIntentScore({
    ...emptySendrIntentSignals(),
    bookingCompletes: 2,
    videoCompletes: 1,
    ctaClicks: 2,
  })
  assert.deepEqual(
    { score: again.intentScore, level: again.intentLevel },
    { score: high.intentScore, level: high.intentLevel },
  )

  assert.equal(resolveSendrIntentLevel(33), "low")
  assert.equal(resolveSendrIntentLevel(50), "medium")
  assert.equal(resolveSendrIntentLevel(80), "high")

  const rates = calculateSendrEngagementRates({
    pageViews: 100,
    uniqueVisitors: 80,
    repeatVisitors: 20,
    ctaClicks: 10,
    bookingCompletes: 5,
    videoStarts: 40,
    videoCompletes: 20,
  })
  assert.equal(rates.ctaRate, 10)
  assert.equal(rates.bookingRate, 5)
  assert.equal(rates.completionRate, 50)
  assert.equal(rates.repeatEngagementRate, 25)

  assert.ok(GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS.booking_completed > 0)

  console.log("  ✓ Deterministic intent scoring without AI")
  console.log("\nGS-SENDR-2E intent scoring certification passed.\n")
}

main()
