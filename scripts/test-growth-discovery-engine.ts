/**
 * Regression checks for Continuous Discovery Engine.
 * Run: pnpm test:growth-discovery-engine
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_DISCOVERY_ENGINE_PRIVACY_NOTE,
  GROWTH_DISCOVERY_ENGINE_QA_MARKER,
  GROWTH_DISCOVERY_SOURCE_TYPES,
} from "../lib/growth/discovery-engine/discovery-engine-types"
import { GROWTH_DISCOVERY_ENGINE_SCHEMA_MIGRATION } from "../lib/growth/discovery-engine/discovery-engine-schema-health"
import { GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS } from "../lib/growth/discovery-engine/discovery-segments"
import {
  applyDiscoveryPriorityBoost,
  buildDiscoveryPatternKey,
  computeDiscoveryPriorityBoost,
} from "../lib/growth/market-intelligence/discovery-feedback-loop"

async function main(): Promise<void> {
  assert.equal(GROWTH_DISCOVERY_ENGINE_QA_MARKER, "growth-discovery-engine-v1")
  assert.match(GROWTH_DISCOVERY_ENGINE_PRIVACY_NOTE, /provider-backed|evidence/i)
  assert.equal(GROWTH_DISCOVERY_SOURCE_TYPES.length, 8)
  assert.equal(GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS.length, 7)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_DISCOVERY_ENGINE_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.discovery_runs/)
  assert.match(migration, /discovery_candidates/)
  assert.match(migration, /discovery_sources/)
  assert.match(migration, /discovery_statistics/)
  assert.match(migration, /discovery_refresh_queue/)
  assert.match(migration, /dedupe_hash/)
  assert.match(migration, /reason_discovered/)
  assert.match(migration, /source_confidence/)

  const cronSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/cron/growth-discovery-worker/route.ts"),
    "utf8",
  )
  assert.match(cronSource, /CRON_SECRET/)
  assert.match(cronSource, /queueNightlyDiscoverySegments/)
  assert.match(cronSource, /processDiscoveryRefreshQueue/)

  const repoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/discovery-engine/discovery-repository.ts"),
    "utf8",
  )
  assert.match(repoSource, /runRealWorldCompanyDiscovery/)
  assert.match(repoSource, /dedupe_hash/)
  assert.match(repoSource, /isSuppressed/)
  assert.match(repoSource, /new_companies_found/)
  assert.doesNotMatch(repoSource, /fabricat|fake company/i)

  const boost = computeDiscoveryPriorityBoost({
    pattern_key: buildDiscoveryPatternKey({ industry: "HVAC", employee_band: "26-100", technology: "servicetitan" }),
    industry: "HVAC",
    employee_band: "26-100",
    technology: "servicetitan",
    won_count: 3,
    lost_count: 1,
    meetings_booked: 2,
    positive_replies: 4,
    negative_replies: 1,
    closed_deals: 2,
    evidence_excerpt: "Won 3, lost 1",
  })
  assert.ok(boost > 0)
  assert.ok(applyDiscoveryPriorityBoost(60, boost) > 60)
  assert.ok(applyDiscoveryPriorityBoost(60, boost) <= 100)

  for (const segment of GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS) {
    assert.ok(segment.key)
    assert.ok(segment.query)
    assert.ok(segment.industry)
    assert.ok(GROWTH_DISCOVERY_SOURCE_TYPES.includes(segment.discovery_source_type))
  }

  console.log("growth-discovery-engine: all checks passed")
}

void main()
