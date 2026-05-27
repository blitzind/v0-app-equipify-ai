import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { filterEligibleSenderPoolMembers } from "@/lib/growth/sender-pools/sender-eligibility"
import {
  listSenderFatigueEvents,
  listSenderPoolMembers,
  listSenderPoolPerformanceSnapshots,
  listSenderPools,
  listSenderRotationDecisions,
  recordSenderPoolPerformanceSnapshot,
} from "@/lib/growth/sender-pools/sender-pool-repository"
import { buildSenderPoolMemberContext } from "@/lib/growth/sender-pools/sender-pool-rotation-service"
import { computeRotationHealthScore } from "@/lib/growth/sender-pools/sender-rotation"
import {
  GROWTH_SENDER_POOL_INTELLIGENCE_QA_MARKER,
  type GrowthSenderPoolDashboard,
} from "@/lib/growth/sender-pools/sender-pool-types"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"

export async function fetchGrowthSenderPoolDashboard(
  admin: SupabaseClient,
  input?: { poolId?: string },
): Promise<GrowthSenderPoolDashboard> {
  const [pools, rotationDecisions, fatigueEvents, performanceSnapshots, routes] = await Promise.all([
    listSenderPools(admin),
    listSenderRotationDecisions(admin, { poolId: input?.poolId, limit: 40 }),
    listSenderFatigueEvents(admin, { poolId: input?.poolId, limit: 40 }),
    listSenderPoolPerformanceSnapshots(admin, { poolId: input?.poolId, limit: 20 }),
    listDeliveryRoutes(admin),
  ])

  const scopedPools = input?.poolId ? pools.filter((pool) => pool.id === input.poolId) : pools
  const membersNested = await Promise.all(scopedPools.map((pool) => listSenderPoolMembers(admin, pool.id)))
  const members = membersNested.flat()

  let eligibleSenders = 0
  let sendersInCooldown = 0
  let reputationSum = 0
  let reputationCount = 0

  for (const pool of scopedPools) {
    const poolMembers = members.filter((member) => member.senderPoolId === pool.id)
    const contexts = []
    for (const member of poolMembers) {
      const ctx = await buildSenderPoolMemberContext(admin, member, routes)
      if (ctx) {
        contexts.push(ctx)
        reputationSum += ctx.reputationScore
        reputationCount += 1
        if (member.memberStatus === "cooldown") sendersInCooldown += 1
      }
    }
    eligibleSenders += filterEligibleSenderPoolMembers(
      contexts,
      pool.minComplianceScore,
      pool.requiresMailbox,
    ).length

    const rotationHealth = computeRotationHealthScore({
      eligibleCount: filterEligibleSenderPoolMembers(contexts, pool.minComplianceScore, pool.requiresMailbox).length,
      totalMembers: contexts.length,
      cooldownCount: poolMembers.filter((m) => m.memberStatus === "cooldown").length,
      fatigueWarnings: fatigueEvents.filter((e) => e.senderPoolId === pool.id).length,
      averageReputation: contexts.length
        ? contexts.reduce((sum, c) => sum + c.reputationScore, 0) / contexts.length
        : 0,
    })

    await recordSenderPoolPerformanceSnapshot(admin, {
      senderPoolId: pool.id,
      eligibleMembers: filterEligibleSenderPoolMembers(contexts, pool.minComplianceScore, pool.requiresMailbox).length,
      cooldownMembers: poolMembers.filter((m) => m.memberStatus === "cooldown").length,
      fatigueWarnings: fatigueEvents.filter((e) => e.senderPoolId === pool.id).length,
      averageReputation: contexts.length
        ? Math.round((contexts.reduce((sum, c) => sum + c.reputationScore, 0) / contexts.length) * 100) / 100
        : 0,
      rotationHealthScore: rotationHealth,
    }).catch(() => undefined)
  }

  const activePools = scopedPools.filter((pool) => pool.status === "active").length
  const averageReputation =
    reputationCount > 0 ? Math.round((reputationSum / reputationCount) * 100) / 100 : 0
  const rotationHealth = computeRotationHealthScore({
    eligibleCount: eligibleSenders,
    totalMembers: members.length,
    cooldownCount: sendersInCooldown,
    fatigueWarnings: fatigueEvents.length,
    averageReputation,
  })

  return {
    qa_marker: GROWTH_SENDER_POOL_INTELLIGENCE_QA_MARKER,
    activePools,
    eligibleSenders,
    sendersInCooldown,
    fatigueWarnings: fatigueEvents.length,
    averageReputation,
    rotationHealth,
    pools: scopedPools,
    members,
    rotationDecisions,
    fatigueEvents,
    performanceSnapshots,
  }
}
