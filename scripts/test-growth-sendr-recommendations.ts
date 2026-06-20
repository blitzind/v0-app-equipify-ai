/**
 * GS-SENDR-2E — Recommendations certification.
 * Run: pnpm test:growth-sendr-recommendations
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import {
  generateSendrPageAttentionRecommendations,
  generateSendrRecommendations,
} from "../lib/growth/sendr/growth-sendr-recommendation-service"
import { emptySendrIntentSignals } from "../lib/growth/sendr/growth-sendr-intent-scoring"

function main(): void {
  console.log("\n=== GS-SENDR-2E Recommendations Certification ===\n")

  const highIntent = generateSendrRecommendations({
    intentScore: 85,
    intentLevel: "high",
    signals: { ...emptySendrIntentSignals(), bookingCompletes: 1 },
    lastSendrActivityAt: new Date().toISOString(),
  })
  assert.ok(highIntent.some((r) => r.title === "Book meeting immediately"))

  const repeatView = generateSendrRecommendations({
    intentScore: 25,
    intentLevel: "low",
    signals: { ...emptySendrIntentSignals(), pageViews: 3, repeatSessions: 1 },
    lastSendrActivityAt: new Date().toISOString(),
  })
  assert.ok(repeatView.some((r) => r.title === "Send follow-up email"))

  const abandonedBooking = generateSendrRecommendations({
    intentScore: 40,
    intentLevel: "medium",
    signals: { ...emptySendrIntentSignals(), bookingStarts: 1 },
    lastSendrActivityAt: new Date().toISOString(),
  })
  assert.ok(abandonedBooking.some((r) => r.title === "Send reminder"))

  const stale = generateSendrRecommendations({
    intentScore: 10,
    intentLevel: "low",
    signals: { ...emptySendrIntentSignals(), pageViews: 1 },
    lastSendrActivityAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
    now: new Date(),
  })
  assert.ok(stale.some((r) => r.title === "Archive or retry"))

  const pageAttention = generateSendrPageAttentionRecommendations({
    pageViews: 50,
    ctaRate: 2,
    bookingRate: 0,
    title: "Demo Page",
  })
  assert.ok(pageAttention?.attentionReason.includes("low CTA"))

  const service = fs.readFileSync("lib/growth/sendr/growth-sendr-recommendation-service.ts", "utf8")
  assert.doesNotMatch(service, /openai|anthropic|llm/i)

  console.log("  ✓ Deterministic operator recommendations, no autonomous execution")
  console.log("\nGS-SENDR-2E recommendations certification passed.\n")
}

main()
