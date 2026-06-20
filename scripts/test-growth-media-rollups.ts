/**
 * GS-RG-1 — incremental media rollup regression checks.
 * Run: pnpm test:growth-media-rollups
 */
import assert from "node:assert/strict"
import {
  applyIncrementalMediaRollupDelta,
  computeIncrementalMediaRollupDelta,
  emptyIncrementalMediaRollupState,
  mapVideoPageEventToRollupDelta,
} from "../lib/growth/runtime-guardrails/growth-media-incremental-rollups"

async function main(): Promise<void> {
  const base = emptyIncrementalMediaRollupState()
  const viewDelta = computeIncrementalMediaRollupDelta(
    {
      eventType: "video_viewed",
      sessionId: "s1",
      progressSeconds: null,
      eventTimestamp: "2026-06-19T10:00:00.000Z",
    },
    { sessionAlreadyViewed: false },
  )
  const afterView = applyIncrementalMediaRollupDelta(base, viewDelta)
  assert.equal(afterView.views, 1)
  assert.equal(afterView.uniqueViews, 1)

  const repeatView = computeIncrementalMediaRollupDelta(
    {
      eventType: "video_viewed",
      sessionId: "s1",
      progressSeconds: null,
      eventTimestamp: "2026-06-19T10:01:00.000Z",
    },
    { sessionAlreadyViewed: true },
  )
  const afterRepeat = applyIncrementalMediaRollupDelta(afterView, repeatView)
  assert.equal(afterRepeat.views, 2)
  assert.equal(afterRepeat.uniqueViews, 1)

  const playDelta = computeIncrementalMediaRollupDelta({
    eventType: "video_play_started",
    sessionId: "s1",
    progressSeconds: null,
    eventTimestamp: "2026-06-19T10:02:00.000Z",
  })
  const afterPlay = applyIncrementalMediaRollupDelta(afterRepeat, playDelta)
  assert.equal(afterPlay.playStarts, 1)

  const completeDelta = computeIncrementalMediaRollupDelta(
    {
      eventType: "video_completed",
      sessionId: "s1",
      progressSeconds: 90,
      eventTimestamp: "2026-06-19T10:05:00.000Z",
    },
    { sessionPriorMaxProgress: 30 },
  )
  const afterComplete = applyIncrementalMediaRollupDelta(afterPlay, completeDelta)
  assert.equal(afterComplete.completions, 1)
  assert.equal(afterComplete.completionRate, 1)

  const pageDelta = mapVideoPageEventToRollupDelta("page_viewed", { sessionAlreadySeen: false })
  assert.equal(pageDelta.views, 1)
  assert.equal(pageDelta.uniqueViewers, 1)

  console.log("GS-RG-1 media rollup regression checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
