/**
 * AVA-SENDER-POOL-ACTIVATION-1A — Create and activate Equipify supervised outbound sender pool.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/activate-ava-supervised-outbound-sender-pool-1a-production.ts
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { ensureMailboxEligibleForSenderAssignment } from "@/lib/growth/mailboxes/mailbox-pre-send-readiness"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import {
  addSenderPoolMember,
  createSenderPool,
  getSenderPool,
  listSenderPoolMembers,
  listSenderPools,
  updateSenderPool,
} from "@/lib/growth/sender-pools/sender-pool-repository"
import {
  buildSenderPoolMemberContext,
  resolveSenderRotationForPool,
} from "@/lib/growth/sender-pools/sender-pool-rotation-service"
import { explainIneligibleMembers } from "@/lib/growth/sender-pools/sender-rotation"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"

export const AVA_SENDER_POOL_ACTIVATION_1A_QA_MARKER = "ava-sender-pool-activation-1a-v1" as const

export const EQUIPIFY_SUPERVISED_OUTBOUND_POOL_NAME = "Equipify Supervised Outbound" as const

/** Eligible production mailboxes — resolved by email at runtime, not by hardcoded IDs. */
const TARGET_MEMBER_EMAILS = [
  "ava@equipifyai.com",
  "christa@getequipify.com",
  "daniel@equipifyai.com",
  "lonnie@goequipify.com",
  "mike@equipifyai.com",
  "mike@getequipify.com",
  "mike@goequipify.com",
] as const

const DEFAULT_MEMBER_PRIORITY_WEIGHT = 100

async function resolveOrCreatePool(admin: SupabaseClient) {
  const existing = (await listSenderPools(admin)).find(
    (pool) => pool.name.trim() === EQUIPIFY_SUPERVISED_OUTBOUND_POOL_NAME,
  )
  if (existing) {
    console.log(`Found existing pool: ${existing.id} (${existing.status})`)
    return existing
  }

  const pool = await createSenderPool(admin, {
    name: EQUIPIFY_SUPERVISED_OUTBOUND_POOL_NAME,
    description:
      "AVA-SENDER-POOL-ACTIVATION-1A — canonical sender pool for Ava supervised outbound rotation.",
    status: "draft",
    rotationStrategy: "weighted_health",
    requiresMailbox: true,
    minComplianceScore: 60,
    allowAutoRotation: true,
  })
  console.log(`Created pool: ${pool.id}`)
  return pool
}

async function ensurePoolMembers(admin: SupabaseClient, poolId: string) {
  const senders = await listSenderAccounts(admin)
  const byEmail = new Map(senders.map((sender) => [sender.email_address.trim().toLowerCase(), sender]))
  const existingMembers = await listSenderPoolMembers(admin, poolId)
  const existingSenderIds = new Set(existingMembers.map((member) => member.senderAccountId))

  const results: Array<{
    email: string
    senderAccountId: string
    memberId: string
    added: boolean
    assignmentEligible: boolean
    assignmentExclusion: string | null
    deliveryRouteEnabled: boolean
  }> = []

  const routes = await listDeliveryRoutes(admin)
  const routesBySender = new Set(
    routes.filter((route) => route.enabled).map((route) => route.sender_account_id),
  )

  for (const email of TARGET_MEMBER_EMAILS) {
    const sender = byEmail.get(email.trim().toLowerCase())
    if (!sender) {
      throw new Error(`sender_not_found:${email}`)
    }

    const readiness = await ensureMailboxEligibleForSenderAssignment(admin, sender.id)
    let memberId = existingMembers.find((member) => member.senderAccountId === sender.id)?.id ?? ""

    if (!existingSenderIds.has(sender.id)) {
      const member = await addSenderPoolMember(admin, {
        senderPoolId: poolId,
        senderAccountId: sender.id,
        memberStatus: "eligible",
        priorityWeight: DEFAULT_MEMBER_PRIORITY_WEIGHT,
        manualPriority: DEFAULT_MEMBER_PRIORITY_WEIGHT,
        notes: AVA_SENDER_POOL_ACTIVATION_1A_QA_MARKER,
      })
      memberId = member.id
      existingSenderIds.add(sender.id)
      results.push({
        email,
        senderAccountId: sender.id,
        memberId,
        added: true,
        assignmentEligible: readiness.ok,
        assignmentExclusion: readiness.ok ? null : readiness.code,
        deliveryRouteEnabled: routesBySender.has(sender.id),
      })
      continue
    }

    results.push({
      email,
      senderAccountId: sender.id,
      memberId,
      added: false,
      assignmentEligible: readiness.ok,
      assignmentExclusion: readiness.ok ? null : readiness.code,
      deliveryRouteEnabled: routesBySender.has(sender.id),
    })
  }

  return results
}

async function activatePool(admin: SupabaseClient, poolId: string) {
  const pool = await getSenderPool(admin, poolId)
  if (!pool) throw new Error("pool_not_found")
  if (pool.status === "active") return pool
  return updateSenderPool(admin, poolId, { status: "active" })
}

async function simulateRotation(admin: SupabaseClient, poolId: string) {
  const pool = await getSenderPool(admin, poolId)
  if (!pool) throw new Error("pool_not_found")

  const rotation = await resolveSenderRotationForPool(admin, {
    senderPoolId: poolId,
    allowAutoRotation: true,
    persistDecision: false,
  })

  const [members, routes] = await Promise.all([
    listSenderPoolMembers(admin, poolId),
    listDeliveryRoutes(admin),
  ])
  const contexts = []
  for (const member of members) {
    const ctx = await buildSenderPoolMemberContext(admin, member, routes)
    if (ctx) contexts.push(ctx)
  }
  const ineligible = explainIneligibleMembers(contexts, pool.minComplianceScore, pool.requiresMailbox)
  const eligibleCount = contexts.length - ineligible.length

  return { rotation, eligibleCount, ineligible, memberCount: members.length }
}

async function main(): Promise<void> {
  console.log(`[${AVA_SENDER_POOL_ACTIVATION_1A_QA_MARKER}] production pool activation`)

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    console.error("BLOCKED — run via vercel-production-env-run.ts wrapper")
    process.exit(1)
  }

  const admin = boot.admin
  const pool = await resolveOrCreatePool(admin)
  const members = await ensurePoolMembers(admin, pool.id)
  const activated = await activatePool(admin, pool.id)
  const simulation = await simulateRotation(admin, pool.id)

  const configuredEnv = process.env.GROWTH_AVA_SUPERVISED_OUTBOUND_SENDER_POOL_ID?.trim() || null

  console.log(
    JSON.stringify(
      {
        qaMarker: AVA_SENDER_POOL_ACTIVATION_1A_QA_MARKER,
        pool: {
          id: activated.id,
          name: activated.name,
          status: activated.status,
          rotationStrategy: activated.rotationStrategy,
          memberCount: members.length,
        },
        members,
        env: {
          GROWTH_AVA_SUPERVISED_OUTBOUND_SENDER_POOL_ID: configuredEnv,
          matchesPool: configuredEnv === activated.id,
        },
        rotationSimulation: {
          selectedSenderAccountId: simulation.rotation.selectedSenderAccountId,
          reason: simulation.rotation.reason,
          riskLevel: simulation.rotation.riskLevel,
          eligibleCandidateCount: simulation.eligibleCount,
          ineligibleMembers: simulation.ineligible,
        },
        nextStep:
          configuredEnv === activated.id
            ? "Env already configured for this pool."
            : `Set production env: GROWTH_AVA_SUPERVISED_OUTBOUND_SENDER_POOL_ID=${activated.id}`,
      },
      null,
      2,
    ),
  )
}

const isDirectRun = process.argv[1]?.includes("activate-ava-supervised-outbound-sender-pool-1a-production.ts")

if (isDirectRun) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
