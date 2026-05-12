/**
 * BlitzPay Phase 7A.4 — performance, scale & reporting efficiency guardrails.
 * Run: pnpm test:blitzpay-phase-7a4-performance
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  BLITZPAY_PLATFORM_OBSERVABILITY_MAX_ORGS,
  BLITZPAY_PLATFORM_OBSERVABILITY_QUEUE_SNAPSHOT_ROW_CAP,
} from "../lib/blitzpay/blitzpay-platform-observability-rollup"
import { shapeBlitzpayObservabilityFinancialEventListItem } from "../lib/blitzpay/blitzpay-payload-sanitization"
import {
  BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH,
  clampBlitzpayReportingNestingDepth,
  resolveBlitzpayReportingSnapshotNestedSkipState,
} from "../lib/blitzpay/blitzpay-reporting-snapshot-nesting"
import { BLITZPAY_SCHEMA_HEALTH_PROBE_CONCURRENCY } from "../lib/blitzpay/blitzpay-schema-health"
import {
  BLITZPAY_MULTI_ENTITY_MAX_DISTINCT_ORGS,
  BLITZPAY_MULTI_ENTITY_SNAPSHOT_FETCH_CONCURRENCY,
} from "../lib/blitzpay/blitzpay-multi-entity-finance"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function read(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

async function main(): Promise<void> {
  assert.equal(BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH, 3)
  assert.equal(clampBlitzpayReportingNestingDepth(99), 3)
  assert.equal(clampBlitzpayReportingNestingDepth(-2), 0)
  assert.equal(clampBlitzpayReportingNestingDepth(Number.NaN), 0)

  const deep = resolveBlitzpayReportingSnapshotNestedSkipState({
    nestingDepth: 3,
    skipMultiEntity: false,
    skipSupplierNetwork: false,
    skipClaimsWarranty: false,
    skipMobilePhase6a: false,
    skipObservabilityPhase6b: false,
  })
  assert.equal(deep.atDepthCap, true)
  assert.equal(deep.skipObservabilityPhase6b, true)

  const shallow = resolveBlitzpayReportingSnapshotNestedSkipState({
    nestingDepth: 1,
    skipMultiEntity: true,
    skipObservabilityPhase6b: false,
  })
  assert.equal(shallow.skipMultiEntity, true)
  assert.equal(shallow.skipObservabilityPhase6b, false)

  assert.ok(BLITZPAY_SCHEMA_HEALTH_PROBE_CONCURRENCY >= 4 && BLITZPAY_SCHEMA_HEALTH_PROBE_CONCURRENCY <= 16)
  const schemaSrc = read("lib/blitzpay/blitzpay-schema-health.ts")
  assert.match(schemaSrc, /BLITZPAY_SCHEMA_HEALTH_PROBE_CONCURRENCY/)
  assert.match(schemaSrc, /Promise\.all\(slice\.map\(\(t\)/)

  assert.equal(BLITZPAY_MULTI_ENTITY_SNAPSHOT_FETCH_CONCURRENCY, 4)
  assert.ok(BLITZPAY_MULTI_ENTITY_MAX_DISTINCT_ORGS >= BLITZPAY_MULTI_ENTITY_SNAPSHOT_FETCH_CONCURRENCY)
  const me = read("lib/blitzpay/blitzpay-multi-entity-finance.ts")
  assert.match(me, /Promise\.all\(\s*chunk\.map/)

  assert.equal(BLITZPAY_PLATFORM_OBSERVABILITY_QUEUE_SNAPSHOT_ROW_CAP, 400)
  assert.equal(BLITZPAY_PLATFORM_OBSERVABILITY_MAX_ORGS, 60)
  const obs = read("lib/blitzpay/blitzpay-platform-observability-rollup.ts")
  assert.match(obs, /BLITZPAY_PLATFORM_OBSERVABILITY_QUEUE_SNAPSHOT_ROW_CAP/)

  const fcc = read("lib/blitzpay/blitzpay-financial-command-center.ts")
  assert.match(fcc, /precomputedReporting/)
  assert.match(fcc, /precomputedCollections/)

  const ev = shapeBlitzpayObservabilityFinancialEventListItem({
    id: "e1",
    event_type: "t",
    event_status: "s",
    event_hash: "a".repeat(64),
    event_payload: { a: 1, b: 2 },
    metadata: { z: 9 },
  })
  const keys = Object.keys(ev)
  assert.ok(keys.length <= 20, "list row shaping should not explode key count")

  const snap = read("lib/blitzpay/blitzpay-reporting-snapshot.ts")
  assert.match(snap, /clampBlitzpayReportingNestingDepth/)

  // eslint-disable-next-line no-console
  console.log("blitzpay phase 7a4 performance checks ok")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
