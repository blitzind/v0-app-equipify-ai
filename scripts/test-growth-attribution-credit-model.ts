/**
 * Phase 6.33A — Multi-touch attribution credit model regression.
 * Run: pnpm test:growth-attribution-credit-model
 */
import assert from "node:assert/strict"
import {
  computeTouchAttributionCredits,
  GROWTH_ATTRIBUTION_CREDIT_MODEL_QA_MARKER,
  GROWTH_ATTRIBUTION_MODELS,
  GROWTH_ATTRIBUTION_TIME_DECAY_HALF_LIFE_DAYS,
} from "../lib/growth/revenue-attribution/attribution-credit-model"
import { buildAttributionPathFromTouches } from "../lib/growth/revenue-attribution/attribution-path-utils"
import type { GrowthAttributionTouch } from "../lib/growth/revenue-attribution/attribution-touch-types"
import { defaultChannelForTouchType } from "../lib/growth/revenue-attribution/attribution-touch-types"

function touch(
  partial: Partial<GrowthAttributionTouch> & Pick<GrowthAttributionTouch, "id" | "touchType" | "touchedAt">,
): GrowthAttributionTouch {
  return {
    leadId: "lead-1",
    opportunityId: null,
    channel: defaultChannelForTouchType(partial.touchType),
    sequenceId: null,
    sequenceStepId: null,
    sequenceEnrollmentId: null,
    senderAccountId: null,
    repUserId: null,
    campaignId: null,
    deliveryAttemptId: null,
    revenueAttributionEventId: null,
    attributionSource: "test",
    attributionConfidence: 1,
    metadata: {},
    createdAt: new Date().toISOString(),
    ...partial,
  }
}

function sumWeights(credits: { attributionWeight: number }[]): number {
  return Math.round(credits.reduce((s, c) => s + c.attributionWeight, 0) * 10000) / 10000
}

function main(): void {
  assert.equal(GROWTH_ATTRIBUTION_CREDIT_MODEL_QA_MARKER, "growth-attribution-credit-model-v1")
  assert.equal(GROWTH_ATTRIBUTION_MODELS.length, 4)
  assert.equal(GROWTH_ATTRIBUTION_TIME_DECAY_HALF_LIFE_DAYS, 14)

  const touches = [
    touch({ id: "a", touchType: "lead_import", touchedAt: "2026-01-01T00:00:00Z" }),
    touch({ id: "b", touchType: "email_send", touchedAt: "2026-01-08T00:00:00Z", channel: "email" }),
    touch({ id: "c", touchType: "meeting", touchedAt: "2026-01-14T00:00:00Z" }),
    touch({ id: "d", touchType: "opportunity_won", touchedAt: "2026-01-15T00:00:00Z" }),
  ]
  const anchor = "2026-01-15T00:00:00Z"

  const first = computeTouchAttributionCredits("first_touch", touches, anchor)
  assert.equal(first[0]?.touchId, "a")
  assert.equal(sumWeights(first), 1)

  const last = computeTouchAttributionCredits("last_touch", touches, anchor)
  assert.equal(last[last.length - 1]?.touchId, "d")
  assert.equal(sumWeights(last), 1)

  const linear = computeTouchAttributionCredits("linear", touches, anchor)
  assert.equal(linear.length, 4)
  assert.equal(sumWeights(linear), 1)
  assert.ok(Math.abs(linear[0]!.attributionWeight - 0.25) < 0.01)

  const decay = computeTouchAttributionCredits("time_decay", touches, anchor)
  assert.equal(sumWeights(decay), 1)
  const decayById = new Map(decay.map((c) => [c.touchId, c.attributionWeight]))
  assert.ok(decayById.get("d")! > decayById.get("a")!)

  const path = buildAttributionPathFromTouches(touches, {
    leadId: "lead-1",
    opportunityId: null,
    pathScope: "lead",
  })
  const stored = path.pathSummary.touch_credits_by_model as Record<string, unknown>
  assert.ok(stored?.linear)
  assert.ok(stored?.time_decay)

  console.log("growth attribution credit model tests passed")
}

main()
