/**
 * GS-RG-1B — Media rollup certification (read/write amplification model).
 * Run: pnpm test:growth-runtime-media-cert
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

type IngestModel = {
  events: number
  readsPerEvent: number
  writesPerEvent: number
  totalReads: number
  totalWrites: number
}

function beforeGuardrails(events: number): IngestModel {
  const readsPerEvent = 1 + 2000
  const writesPerEvent = 1 + 1
  return {
    events,
    readsPerEvent,
    writesPerEvent,
    totalReads: events * readsPerEvent,
    totalWrites: events * writesPerEvent,
  }
}

function afterGuardrails(events: number): IngestModel {
  const sessionCap = GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_MEDIA_EVENTS_PER_SESSION
  const readsPerEvent = 1 + sessionCap + 1 + 1
  const writesPerEvent = 1 + 1 + 1
  return {
    events,
    readsPerEvent,
    writesPerEvent,
    totalReads: events * readsPerEvent,
    totalWrites: events * writesPerEvent,
  }
}

function main(): void {
  console.log("\n=== GS-RG-1B Media Rollup Certification ===\n")

  const mediaService = readSource("lib/growth/media/media-asset-analytics-service.ts")
  const rollupService = readSource("lib/growth/runtime-guardrails/growth-media-rollup-service.ts")

  assert.match(mediaService, /incrementMediaAssetEventRollup/)
  assert.doesNotMatch(mediaService, /recomputeMediaAssetEventRollup/)
  assert.match(rollupService, /computeIncrementalMediaRollupDelta/)
  assert.match(rollupService, /MAX_MEDIA_ROLLUP_BATCH/)
  console.log("  ✓ Ingest path uses incremental rollups (not full recompute)")

  const eventCounts = [100, 1000, 10000]
  console.log("\n  events | before reads | after reads | reduction | before writes | after writes")
  for (const events of eventCounts) {
    const before = beforeGuardrails(events)
    const after = afterGuardrails(events)
    const reduction = ((1 - after.totalReads / before.totalReads) * 100).toFixed(1)
    console.log(
      `  ${String(events).padStart(6)} | ${String(before.totalReads).padStart(12)} | ${String(after.totalReads).padStart(11)} | ${reduction.padStart(8)}% | ${String(before.totalWrites).padStart(13)} | ${String(after.totalWrites).padStart(12)}`,
    )
    assert.ok(after.totalReads < before.totalReads)
  }

  const rebuildBatch = GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_MEDIA_ROLLUP_BATCH
  assert.equal(rebuildBatch, 500)
  console.log(`\n  ✓ Admin rebuild bounded to ${rebuildBatch} assets per request`)

  console.log("\nGS-RG-1B media certification passed.\n")
}

main()
