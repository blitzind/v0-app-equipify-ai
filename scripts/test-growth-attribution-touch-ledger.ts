/**
 * Phase 6.32B-1 — Attribution touch ledger regression.
 * Run: pnpm test:growth-attribution-touch-ledger
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAttributionPathFromTouches } from "../lib/growth/revenue-attribution/attribution-path-utils"
import {
  defaultChannelForTouchType,
  GROWTH_ATTRIBUTION_TOUCH_LEDGER_MIGRATION,
  GROWTH_ATTRIBUTION_TOUCH_LEDGER_QA_MARKER,
  GROWTH_ATTRIBUTION_TOUCH_TYPES,
} from "../lib/growth/revenue-attribution/attribution-touch-types"
import type { GrowthAttributionTouch } from "../lib/growth/revenue-attribution/attribution-touch-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function touch(partial: Partial<GrowthAttributionTouch> & Pick<GrowthAttributionTouch, "id" | "touchType" | "touchedAt">): GrowthAttributionTouch {
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

async function main(): Promise<void> {
  assert.equal(GROWTH_ATTRIBUTION_TOUCH_LEDGER_QA_MARKER, "growth-attribution-touch-ledger-v1")
  assert.equal(GROWTH_ATTRIBUTION_TOUCH_TYPES.length, 10)

  const migration = readSource(`supabase/migrations/${GROWTH_ATTRIBUTION_TOUCH_LEDGER_MIGRATION}`)
  assert.match(migration, /growth\.attribution_touches/)
  assert.match(migration, /growth\.attribution_paths/)
  assert.match(migration, /opportunity_won/)
  assert.match(migration, /attribution_confidence/)
  assert.match(migration, /service_role/)

  const touches = [
    touch({ id: "t1", touchType: "lead_import", touchedAt: "2026-06-01T10:00:00.000Z" }),
    touch({ id: "t2", touchType: "email_send", touchedAt: "2026-06-02T10:00:00.000Z", channel: "email" }),
    touch({ id: "t3", touchType: "reply", touchedAt: "2026-06-03T10:00:00.000Z" }),
    touch({ id: "t4", touchType: "opportunity_won", touchedAt: "2026-06-04T10:00:00.000Z", opportunityId: "opp-1" }),
  ]

  const path = buildAttributionPathFromTouches(touches, {
    leadId: "lead-1",
    opportunityId: "opp-1",
    pathScope: "lead",
  })
  assert.equal(path.firstTouchId, "t1")
  assert.equal(path.lastTouchId, "t4")
  assert.equal(path.touchCount, 4)
  assert.deepEqual(path.touchIds, ["t1", "t2", "t3", "t4"])
  assert.ok(path.channels.includes("email"))

  const mutateSource = readSource("lib/growth/opportunity-pipeline/mutate-opportunity.ts")
  assert.match(mutateSource, /recordRevenueAttributionEvent/)
  assert.match(mutateSource, /opportunity_created/)
  assert.match(mutateSource, /opportunity_won/)
  assert.match(mutateSource, /resolveAttributionContextForLead/)

  const revenueSource = readSource("lib/growth/revenue-intelligence/revenue-attribution.ts")
  assert.match(revenueSource, /recordAttributionTouchFromRevenueEvent/)

  const transportSource = readSource("lib/growth/providers/transport/transport-repository.ts")
  assert.match(transportSource, /recordSendAttributionTouchForDeliveryAttempt/)

  assert.equal(defaultChannelForTouchType("sms_send"), "sms")
  assert.equal(defaultChannelForTouchType("call"), "call")

  console.log("growth attribution touch ledger tests passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
