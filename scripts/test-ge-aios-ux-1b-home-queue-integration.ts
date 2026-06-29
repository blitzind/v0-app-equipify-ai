/**
 * GE-AIOS-UX-1B — Canonical Daily Work Queue home integration certification.
 * Run: pnpm test:ge-aios-ux-1b-home-queue-integration
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthHomeExecutiveBriefingCertDashboard,
  buildGrowthHomeExecutiveBriefingCertFixture,
  synthesizeGrowthHomeExecutiveBriefing,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import {
  buildAiOsUxViewModel,
  buildDailyWorkQueueItems,
} from "../lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"
import { mapCanonicalQueueDisplayToHomeItems } from "../lib/growth/workspace/executive-briefing/growth-home-canonical-queue-mapper"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

console.log("\n=== GE-AIOS-UX-1B Home Queue Integration Certification ===\n")

const hookSource = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
assert.match(hookSource, /daily-revenue-work-queue/)
assert.match(hookSource, /Promise\.all\(/)
assert.match(hookSource, /growth-workspace-dashboard-fetch-batch-v2/)
const batchEndpointCount = (hookSource.match(/"\/api\/platform\/growth\//g) ?? []).length
assert.equal(batchEndpointCount, 12, "batch should include 12 parallel endpoint fetches")
assert.match(hookSource, /"\/api\/platform\/growth\/daily-revenue-work-queue"/)
console.log("  ✓ Dashboard batch includes canonical queue in one Promise.all (12 endpoints)")

const synthesizerSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer.ts")
assert.match(synthesizerSource, /mapCanonicalQueueDisplayToHomeItems/)
assert.match(synthesizerSource, /mapCanonicalQueueToWaitingOnYou/)
assert.match(synthesizerSource, /pickTopCanonicalQueueActionItem/)
const dailyWorkQueueFn = synthesizerSource.match(
  /export function buildDailyWorkQueueItems[\s\S]*?^}/m,
)?.[0] ?? ""
assert.match(dailyWorkQueueFn, /mapCanonicalQueueDisplayToHomeItems/)
assert.doesNotMatch(dailyWorkQueueFn, /leadInboxHighlights|sortLeadInboxQueue/)
console.log("  ✓ Home UX synthesizer consumes canonical queue, not inbox ordering")

const ownershipSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ownership-synthesizer.ts")
assert.match(ownershipSource, /pickTopCanonicalQueueActionItem/)
console.log("  ✓ Executive recommendation derives from canonical queue")

const dashboard = buildGrowthHomeExecutiveBriefingCertDashboard()
assert.equal(dashboard.dailyRevenueWorkQueueEnabled, true)
assert.ok(dashboard.dailyRevenueWorkQueueDisplay)
const queueItems = buildDailyWorkQueueItems(dashboard)
assert.equal(queueItems.length, 1)
assert.equal(queueItems[0]?.companyName, "Precision Biomedical")
assert.equal(queueItems[0]?.requiresHumanApproval, true)
console.log("  ✓ Daily work queue section renders canonical queue items")

const fixture = buildGrowthHomeExecutiveBriefingCertFixture()
assert.ok(fixture.aiOsUx.dailyWorkQueueBuckets)
assert.equal(fixture.aiOsUx.dailyWorkQueueBuckets?.critical, 1)
assert.ok(fixture.aiOsUx.dailyWorkQueue.length > 0)
assert.ok(fixture.aiOsUx.waitingOnYou.length >= 0)
assert.match(fixture.executiveRecommendation?.sentence ?? "", /Precision Biomedical|send email/i)
assert.match(fixture.recommendation?.headline ?? "", /Precision Biomedical/)
console.log("  ✓ Waiting On You, buckets, and recommendation use queue evidence")

const emptyDashboard = buildGrowthHomeExecutiveBriefingCertDashboard()
emptyDashboard.dailyRevenueWorkQueueEnabled = false
emptyDashboard.dailyRevenueWorkQueue = null
emptyDashboard.dailyRevenueWorkQueueDisplay = null
const emptyQueue = buildDailyWorkQueueItems(emptyDashboard)
assert.deepEqual(emptyQueue, [])
console.log("  ✓ No inbox heuristic fallback when canonical queue unavailable")

const ux = buildAiOsUxViewModel({
  dashboard,
  executiveBrief: fixture.executiveBrief,
  waitingOnYou: fixture.waitingOnYou,
  waitingOnYouOverflow: 0,
  needsReview: fixture.needsReview,
})
assert.ok(ux.hero.introLine.includes("canonical revenue queue"))
assert.ok(ux.dailyWorkQueueBuckets)
console.log("  ✓ Executive hero briefing uses queue-backed narrative")

const mapped = mapCanonicalQueueDisplayToHomeItems(dashboard.dailyRevenueWorkQueueDisplay!)
assert.equal(mapped[0]?.channelLabel, "Email")
assert.equal(mapped[0]?.estimatedMinutes, 10)
console.log("  ✓ Queue mapper exposes channel, reason, confidence, and timing fields")

const noQueueBriefing = synthesizeGrowthHomeExecutiveBriefing({ dashboard: emptyDashboard })
assert.equal(noQueueBriefing.aiOsUx.dailyWorkQueue.length, 0)
console.log("  ✓ Disabled queue produces empty home queue without duplicate ordering")

console.log("\nGE-AIOS-UX-1B home queue integration certification PASSED\n")
