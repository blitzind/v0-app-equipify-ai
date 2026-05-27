/**
 * Regression checks for Sender Pool Intelligence + Rotation Engine (Phase 2Q).
 * Run: pnpm test:growth-sender-pools
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateSenderPoolMemberEligibility,
  filterEligibleSenderPoolMembers,
} from "../lib/growth/sender-pools/sender-eligibility"
import {
  detectSenderFatigueSignals,
  fatigueSeverityRank,
} from "../lib/growth/sender-pools/sender-fatigue"
import {
  computeRotationHealthScore,
  explainIneligibleMembers,
  selectSenderFromPool,
} from "../lib/growth/sender-pools/sender-rotation"
import {
  GROWTH_SENDER_FATIGUE_TYPES,
  GROWTH_SENDER_POOL_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_SENDER_POOL_INTELLIGENCE_QA_MARKER,
  GROWTH_SENDER_POOL_MEMBER_STATUSES,
  GROWTH_SENDER_POOL_ROTATION_STRATEGIES,
  GROWTH_SENDER_POOL_STATUSES,
  GROWTH_SENDER_ROTATION_DECISION_REASONS,
  maskSenderLabel,
} from "../lib/growth/sender-pools/sender-pool-types"
import type { GrowthSenderPoolMemberContext } from "../lib/growth/sender-pools/sender-pool-types"

const GROWTH_SENDER_POOL_INTELLIGENCE_SCHEMA_MIGRATION =
  "20270422120000_growth_sender_pool_intelligence.sql" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseMember(overrides: Partial<GrowthSenderPoolMemberContext> = {}): GrowthSenderPoolMemberContext {
  return {
    memberId: "m1",
    senderAccountId: "s1",
    senderLabel: "Alice",
    senderEmail: "alice@example.com",
    memberStatus: "eligible",
    priorityWeight: 100,
    manualPriority: 100,
    lastSelectedAt: null,
    cooldownUntil: null,
    senderConnected: true,
    mailboxConnected: true,
    suppressed: false,
    disabled: false,
    warmupHealthCritical: false,
    senderReputationCritical: false,
    domainDeliverabilityCritical: false,
    dailyCapRemaining: 50,
    providerRouteAvailable: true,
    complianceScore: 90,
    healthScore: 85,
    reputationScore: 88,
    recentVolume: 20,
    bounceRisk: 2,
    complaintRisk: 0,
    providerHealthScore: 80,
    domainHealthScore: 82,
    warmupProgress: 100,
    ...overrides,
  }
}

async function main(): Promise<void> {
  assert.equal(GROWTH_SENDER_POOL_INTELLIGENCE_QA_MARKER, "growth-sender-pool-intelligence-v1")
  assert.match(GROWTH_SENDER_POOL_INTELLIGENCE_PRIVACY_NOTE, /Human approval required/i)
  assert.match(GROWTH_SENDER_POOL_INTELLIGENCE_PRIVACY_NOTE, /no autonomous bypass/i)
  assert.match(GROWTH_SENDER_POOL_INTELLIGENCE_PRIVACY_NOTE, /no compliance bypass/i)
  assert.equal(GROWTH_SENDER_POOL_STATUSES.length, 4)
  assert.equal(GROWTH_SENDER_POOL_ROTATION_STRATEGIES.length, 6)
  assert.equal(GROWTH_SENDER_POOL_MEMBER_STATUSES.length, 6)
  assert.equal(GROWTH_SENDER_ROTATION_DECISION_REASONS.length, 10)
  assert.equal(GROWTH_SENDER_FATIGUE_TYPES.length, 7)

  const migration = readSource(`supabase/migrations/${GROWTH_SENDER_POOL_INTELLIGENCE_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.sender_pools/)
  assert.match(migration, /growth\.sender_pool_members/)
  assert.match(migration, /growth\.sender_rotation_decisions/)
  assert.match(migration, /growth\.sender_fatigue_events/)
  assert.match(migration, /growth\.sender_pool_performance_snapshots/)
  assert.match(migration, /sender_pool_id/)
  assert.match(migration, /allow_auto_rotation/)
  assert.match(migration, /service role only/i)

  const eligible = evaluateSenderPoolMemberEligibility(baseMember(), 60, true)
  assert.equal(eligible.eligible, true)

  const blocked = evaluateSenderPoolMemberEligibility(
    baseMember({ dailyCapRemaining: 0, senderConnected: false }),
    60,
    true,
  )
  assert.equal(blocked.eligible, false)
  assert.ok(blocked.blockedReasons.length >= 2)

  const members = [
    baseMember({ senderAccountId: "s1", recentVolume: 400, lastSelectedAt: "2026-05-26T10:00:00.000Z" }),
    baseMember({ senderAccountId: "s2", recentVolume: 10, reputationScore: 95, healthScore: 92 }),
  ]
  const eligibleMembers = filterEligibleSenderPoolMembers(members, 60, true)
  assert.equal(eligibleMembers.length, 2)

  const rotation = selectSenderFromPool({
    strategy: "lowest_volume",
    minComplianceScore: 60,
    requiresMailbox: true,
    members: eligibleMembers,
    routeBySender: {
      s1: { providerId: "p1", routeId: "r1" },
      s2: { providerId: "p2", routeId: "r2" },
    },
  })
  assert.equal(rotation.selectedSenderAccountId, "s2")
  assert.ok(["recent_volume", "reputation_score", "health_score"].includes(rotation.reason))
  assert.ok(rotation.fallbackSenderCandidates.length >= 1)

  const manual = selectSenderFromPool({
    strategy: "weighted_health",
    minComplianceScore: 60,
    requiresMailbox: true,
    members: eligibleMembers,
    manualSenderAccountId: "s1",
    allowAutoRotation: false,
    routeBySender: { s1: { providerId: "p1", routeId: "r1" } },
  })
  assert.equal(manual.selectedSenderAccountId, "s1")
  assert.equal(manual.reason, "manual_override")

  const fatigue = detectSenderFatigueSignals({ recentVolume: 900, bounceRate: 12, complaintRate: 1.2 })
  assert.ok(fatigue.some((f) => f.fatigueType === "high_recent_volume"))
  assert.ok(fatigue.some((f) => f.fatigueType === "bounce_spike"))
  assert.ok(fatigueSeverityRank("critical") > fatigueSeverityRank("low"))

  const health = computeRotationHealthScore({
    eligibleCount: 4,
    totalMembers: 5,
    cooldownCount: 1,
    fatigueWarnings: 1,
    averageReputation: 80,
  })
  assert.ok(health >= 0 && health <= 100)

  const ineligible = explainIneligibleMembers(
    [baseMember({ senderAccountId: "s9", dailyCapRemaining: 0 })],
    60,
    true,
  )
  assert.equal(ineligible.length, 1)
  assert.equal(ineligible[0]?.senderAccountId, "s9")

  assert.equal(maskSenderLabel("alice@example.com", "Alice"), "Alice")
  assert.match(maskSenderLabel("alice@example.com"), /\*\*\*@example\.com/)

  const transportSource = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
  assert.match(transportSource, /resolveTransportSenderWithPool/)
  assert.match(transportSource, /sender_pool_id/)

  const sequenceSource = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
  assert.match(sequenceSource, /resolveSenderRotationForPool/)
  assert.match(sequenceSource, /allowAutoRotation/)

  const routesSource = readSource("app/api/platform/growth/sender-pools/route.ts")
  assert.match(routesSource, /requireGrowthEnginePlatformAccess/)
  assert.match(routesSource, /isGrowthSenderPoolIntelligenceSchemaReady/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /sender-pools/)
  assert.match(navSource, /Sender Pools/)

  console.log("growth sender pool intelligence checks passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
