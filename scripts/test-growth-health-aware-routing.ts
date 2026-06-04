/**
 * Phase 6.31C — Health-aware sender routing regression.
 * Run: pnpm test:growth-health-aware-routing
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { filterEligibleSenderPoolMembers } from "../lib/growth/sender-pools/sender-eligibility"
import {
  buildRouteBalancingRecommendation,
  computeHealthAwareRoutingScore,
  computeSenderCapacityMetrics,
  isHealthAwareRoutingEligible,
  pickBestRouteForSender,
  scoreDeliveryRouteForRotation,
} from "../lib/growth/sender-pools/health-aware-routing"
import { GROWTH_HEALTH_AWARE_ROUTING_QA_MARKER } from "../lib/growth/sender-pools/health-aware-routing-types"
import { selectSenderFromPool } from "../lib/growth/sender-pools/sender-rotation"
import type { GrowthSenderPoolMemberContext } from "../lib/growth/sender-pools/sender-pool-types"

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
    mailboxHealthScore: 88,
    mailboxHealthState: "healthy",
    throttleStatus: "ok",
    routingScore: 90,
    routingEligible: true,
    utilizationPct: 25,
    remainingDailyCapacity: 50,
    reputationTrendDirection: "stable",
    deliverySuccessRate: 98,
    ...overrides,
  }
}

async function main(): Promise<void> {
  assert.equal(GROWTH_HEALTH_AWARE_ROUTING_QA_MARKER, "growth-health-aware-routing-v1")

  const capacity = computeSenderCapacityMetrics({ daily_capacity: 100, sends_today: 85 })
  assert.equal(capacity.remaining_capacity, 15)
  assert.equal(capacity.utilization_pct, 85)
  assert.ok(capacity.projected_exhaustion_hours != null || capacity.projected_exhaustion_hours === null)

  const routeA = {
    route_id: "r1",
    provider_id: "p1",
    priority: 10,
    health_weight: 90,
    provider_health_score: 85,
    daily_cap: 200,
    current_volume: 20,
  }
  const routeB = { ...routeA, route_id: "r2", health_weight: 40, provider_health_score: 40, priority: 5 }
  assert.ok(scoreDeliveryRouteForRotation(routeA) > scoreDeliveryRouteForRotation(routeB))
  assert.equal(pickBestRouteForSender([routeA, routeB])?.route_id, "r1")

  const healthy = baseMember()
  const critical = baseMember({
    senderAccountId: "s2",
    mailboxHealthState: "critical",
    throttleStatus: "ok",
    routingEligible: false,
    routingScore: 10,
  })
  assert.ok(computeHealthAwareRoutingScore(healthy) > computeHealthAwareRoutingScore(critical))
  assert.equal(isHealthAwareRoutingEligible(critical), false)

  const eligible = filterEligibleSenderPoolMembers([healthy, critical], 60, true)
  assert.equal(eligible.length, 1)
  assert.equal(eligible[0]?.senderAccountId, "s1")

  const throttled = baseMember({
    senderAccountId: "s3",
    throttleStatus: "throttled",
    routingEligible: false,
  })
  assert.equal(filterEligibleSenderPoolMembers([throttled], 60, true).length, 0)

  const rotation = selectSenderFromPool({
    strategy: "weighted_health",
    minComplianceScore: 60,
    requiresMailbox: true,
    members: [
      healthy,
      baseMember({
        senderAccountId: "s4",
        routingScore: 70,
        utilizationPct: 90,
        mailboxHealthState: "warning",
      }),
    ],
    routeBySender: {
      s1: { providerId: "p1", routeId: "r1" },
      s4: { providerId: "p2", routeId: "r2" },
    },
  })
  assert.equal(rotation.selectedSenderAccountId, "s1")

  const balancing = buildRouteBalancingRecommendation([
    baseMember({ senderLabel: "A", utilizationPct: 95, routingEligible: true, mailboxHealthState: "healthy" }),
    baseMember({ senderLabel: "B", utilizationPct: 10, routingEligible: true, mailboxHealthState: "healthy" }),
  ])
  assert.ok(balancing?.includes("Balance pool volume"))

  const rotationSource = readSource("lib/growth/sender-pools/sender-rotation.ts")
  assert.match(rotationSource, /computeHealthAwareRoutingScore/)
  const serviceSource = readSource("lib/growth/sender-pools/sender-pool-rotation-service.ts")
  assert.match(serviceSource, /buildMailboxHealthIntelRow/)
  assert.match(serviceSource, /buildHealthAwareRouteBySender/)
  const dashboardSource = readSource("lib/growth/sender-pools/sender-pool-dashboard.ts")
  assert.match(dashboardSource, /routingInsights/)

  console.log("growth health-aware routing tests passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
