/**
 * AVA-SENDER-POOL-ACTIVATION-1A — Focused certification (no sends).
 *
 * Run:
 *   pnpm test:ava-sender-pool-activation-1a
 *   pnpm test:ava-sender-pool-activation-1a:production  (read-only production verification)
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchActiveOutboundSenderAssignment } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-repository"
import { AVA_OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-service"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  buildSenderPoolMemberContext,
  resolveSenderRotationForPool,
} from "@/lib/growth/sender-pools/sender-pool-rotation-service"
import { evaluateSenderPoolMemberEligibility } from "@/lib/growth/sender-pools/sender-eligibility"
import { explainIneligibleMembers, selectSenderFromPool } from "@/lib/growth/sender-pools/sender-rotation"
import type { GrowthSenderPoolMemberContext } from "@/lib/growth/sender-pools/sender-pool-types"
import {
  getSenderPool,
  listSenderPoolMembers,
  listSenderPools,
} from "@/lib/growth/sender-pools/sender-pool-repository"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { readAvaSupervisedOutboundApprovalBinding } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import {
  AVA_SENDER_POOL_ACTIVATION_1A_QA_MARKER,
  EQUIPIFY_SUPERVISED_OUTBOUND_POOL_NAME,
} from "./activate-ava-supervised-outbound-sender-pool-1a-production"

const BLITZ_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291" as const
const BLITZ_CONTACT = "mike@blitzind.com" as const
const AVA_SENDER_ID = "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720" as const
const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3" as const
const BLOCK_IMAGING_GENERATION_ID = "2bbacf99-b884-442f-a5b2-ce78132368cf" as const

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function runGate(label: string, fn: () => void | Promise<void>): void | Promise<void> {
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.then(() => console.log(`  ✓ ${label}`))
    }
    console.log(`  ✓ ${label}`)
  } catch (error) {
    console.error(`  ✗ ${label}`)
    throw error
  }
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

async function runLocalCertification(): Promise<void> {
  console.log(`[${AVA_SENDER_POOL_ACTIVATION_1A_QA_MARKER}] local certification`)

  await runGate("1. Approval service does not pass draft snapshot as explicit sender", () => {
    const source = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-approval-service.ts")
    assert.match(source, /explicitSenderAccountId: null/)
    assert.doesNotMatch(source, /explicitSenderAccountId: snapshotSender/)
  })

  await runGate("2. New affinity primary fallback ignores draft explicit sender", () => {
    const source = readSource("lib/growth/outbound-sender-affinity/outbound-sender-affinity-service.ts")
    assert.match(source, /explicitSenderAccountId: null/)
  })

  await runGate("3. Pool configured + no affinity → sender_pool path exists", () => {
    const source = readSource("lib/growth/outbound-sender-affinity/outbound-sender-affinity-service.ts")
    assert.match(source, /assignmentSource: "sender_pool"/)
    assert.match(source, /resolveSenderRotationForPool/)
  })

  await runGate("4. Multiple relationships can rotate across eligible members", () => {
    const members = [
      baseMember({
        senderAccountId: "s1",
        recentVolume: 200,
        lastSelectedAt: "2026-07-24T12:00:00.000Z",
      }),
      baseMember({
        senderAccountId: "s2",
        recentVolume: 5,
        healthScore: 92,
        lastSelectedAt: null,
      }),
      baseMember({
        senderAccountId: "s3",
        recentVolume: 400,
        healthScore: 70,
        lastSelectedAt: "2026-07-24T11:00:00.000Z",
      }),
    ]
    const routeBySender = {
      s1: { providerId: "p1", routeId: "r1" },
      s2: { providerId: "p2", routeId: "r2" },
      s3: { providerId: "p3", routeId: "r3" },
    }
    const roundRobin = selectSenderFromPool({
      strategy: "round_robin",
      minComplianceScore: 60,
      requiresMailbox: true,
      members,
      routeBySender,
    })
    const lowestVolume = selectSenderFromPool({
      strategy: "lowest_volume",
      minComplianceScore: 60,
      requiresMailbox: true,
      members,
      routeBySender,
    })
    assert.equal(roundRobin.selectedSenderAccountId, "s2")
    assert.equal(lowestVolume.selectedSenderAccountId, "s2")
    assert.notEqual(roundRobin.selectedSenderAccountId, "s1")
  })

  await runGate("5. Existing affinity contract preserved in service", () => {
    const source = readSource("lib/growth/outbound-sender-affinity/outbound-sender-affinity-service.ts")
    assert.match(source, /if \(existing\)/)
    assert.match(source, /created: false/)
  })

  await runGate("6. Approved package binding is frozen at send time", () => {
    const source = readSource("lib/growth/ava-reasoning/ava-supervised-outbound-send-service.ts")
    assert.match(source, /readAvaSupervisedOutboundApprovalBinding/)
    assert.doesNotMatch(source, /resolveOrAssignOutboundSenderAffinity/)
  })

  await runGate("7. Pool unavailable → primary Ava fallback remains", () => {
    const source = readSource("lib/growth/sequences/execution/growth-supervised-sender-resolution-1c.ts")
    assert.match(source, /ava@equipifyai\.com/)
  })

  await runGate("8. Capped member excluded from pool", () => {
    const capped = evaluateSenderPoolMemberEligibility(baseMember({ dailyCapRemaining: 0 }), 60, true)
    assert.equal(capped.eligible, false)
    assert.ok(capped.blockedReasons.some((reason) => reason.includes("Daily cap")))
  })

  await runGate("9. Paused/ineligible member excluded", () => {
    const paused = evaluateSenderPoolMemberEligibility(baseMember({ memberStatus: "paused" }), 60, true)
    assert.equal(paused.eligible, false)
  })

  await runGate("10. Warmup/health eligibility respected", () => {
    const critical = evaluateSenderPoolMemberEligibility(
      baseMember({ warmupHealthCritical: true }),
      60,
      true,
    )
    assert.equal(critical.eligible, false)
  })

  await runGate("11. Affinity persistence schema present", () => {
    const migration = readSource("supabase/migrations/20270724160000_outbound_sender_assignments_1a.sql")
    assert.match(migration, /outbound_sender_assignments/)
    assert.match(migration, /assignment_source/)
  })

  await runGate("12. Certification sends no email", () => {
    const certSource = readSource("scripts/test-ava-sender-pool-activation-1a.ts")
    const activationSource = readSource("scripts/activate-ava-supervised-outbound-sender-pool-1a-production.ts")
    assert.doesNotMatch(certSource, /from "@\/lib\/growth\/ava-reasoning\/ava-supervised-outbound-send-service"/)
    assert.doesNotMatch(activationSource, /from "@\/lib\/growth\/ava-reasoning\/ava-supervised-outbound-send-service"/)
    assert.doesNotMatch(certSource, /from "@\/lib\/growth\/providers\/transport\/transport-orchestrator"/)
    assert.doesNotMatch(activationSource, /from "@\/lib\/growth\/providers\/transport\/transport-orchestrator"/)
  })
}

async function runProductionVerification(admin: SupabaseClient): Promise<void> {
  console.log(`[${AVA_SENDER_POOL_ACTIVATION_1A_QA_MARKER}] production verification (read-only)`)

  const configuredPoolId = process.env.GROWTH_AVA_SUPERVISED_OUTBOUND_SENDER_POOL_ID?.trim() || null
  assert.ok(configuredPoolId, "GROWTH_AVA_SUPERVISED_OUTBOUND_SENDER_POOL_ID must be configured")

  const pools = await listSenderPools(admin)
  const pool =
    pools.find((row) => row.id === configuredPoolId) ??
    pools.find((row) => row.name === EQUIPIFY_SUPERVISED_OUTBOUND_POOL_NAME)
  assert.ok(pool, "configured supervised outbound pool must exist")
  assert.equal(pool.status, "active")

  const members = await listSenderPoolMembers(admin, pool.id)
  assert.equal(members.length, 7)

  const routes = await listDeliveryRoutes(admin)
  const contexts = []
  for (const member of members) {
    const ctx = await buildSenderPoolMemberContext(admin, member, routes)
    if (ctx) contexts.push(ctx)
  }
  const ineligible = explainIneligibleMembers(contexts, pool.minComplianceScore, pool.requiresMailbox)
  const eligibleCount = contexts.length - ineligible.length
  assert.ok(eligibleCount >= 2, "at least two eligible pool members required for rotation")

  const rotation = await resolveSenderRotationForPool(admin, {
    senderPoolId: pool.id,
    persistDecision: false,
  })
  assert.ok(rotation.selectedSenderAccountId, "rotation must select an eligible sender")

  const blitzAffinity = await fetchActiveOutboundSenderAssignment(admin, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    leadId: BLITZ_LEAD_ID,
    contactEmail: BLITZ_CONTACT,
  })
  assert.ok(blitzAffinity, "Blitz affinity must remain")
  assert.equal(blitzAffinity.senderAccountId, AVA_SENDER_ID)
  assert.equal(blitzAffinity.senderEmail, "ava@equipifyai.com")

  const { data: blockGen } = await admin
    .schema("growth")
    .from("ai_copilot_generations")
    .select("id, lead_id, status, input_snapshot, classification")
    .eq("id", BLOCK_IMAGING_GENERATION_ID)
    .maybeSingle()
  assert.ok(blockGen)
  assert.equal(blockGen.lead_id, BLOCK_IMAGING_LEAD_ID)
  assert.equal(blockGen.status, "draft")

  const classification = (blockGen.classification ?? {}) as Record<string, unknown>
  const recommended = classification.recommendedContact as { email?: string } | undefined
  const blockContactEmail = recommended?.email?.trim() || null

  const blockAffinity = blockContactEmail
    ? await fetchActiveOutboundSenderAssignment(admin, {
        organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
        leadId: BLOCK_IMAGING_LEAD_ID,
        contactEmail: blockContactEmail,
      })
    : null

  const snapshot = (blockGen.input_snapshot ?? {}) as Record<string, unknown>
  const draftSender = (snapshot.approvedSender as { senderAccountId?: string } | undefined)?.senderAccountId
  assert.equal(draftSender, AVA_SENDER_ID, "draft snapshot may still show Ava for prompt identity")

  const selectedSender = rotation.selectedSenderAccountId
    ? await getSenderAccount(admin, rotation.selectedSenderAccountId)
    : null

  console.log(
    JSON.stringify(
      {
        qaMarker: AVA_SENDER_POOL_ACTIVATION_1A_QA_MARKER,
        affinityMarker: AVA_OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER,
        pool: {
          id: pool.id,
          name: pool.name,
          status: pool.status,
          rotationStrategy: pool.rotationStrategy,
          memberCount: members.length,
        },
        configuredEnv: configuredPoolId,
        eligibleCandidateCount: eligibleCount,
        ineligibleMembers: ineligible,
        rotationPreview: {
          selectedSenderAccountId: rotation.selectedSenderAccountId,
          selectedSenderEmail: selectedSender?.email_address ?? null,
          reason: rotation.reason,
        },
        blitzAffinity: {
          senderEmail: blitzAffinity.senderEmail,
          assignmentSource: blitzAffinity.assignmentSource,
          preserved: blitzAffinity.senderAccountId === AVA_SENDER_ID,
        },
        blockImaging: {
          generationId: BLOCK_IMAGING_GENERATION_ID,
          recipientEmail: blockContactEmail,
          draftSenderAccountId: draftSender,
          hasActiveAffinity: Boolean(blockAffinity),
          wouldUsePoolOnFirstApproval: !blockAffinity,
          projectedFirstApprovalSenderEmail: selectedSender?.email_address ?? null,
        },
        noEmailSent: true,
      },
      null,
      2,
    ),
  )

  await runGate("Block Imaging has no affinity yet", () => {
    assert.equal(blockAffinity, null)
  })

  await runGate("Block Imaging draft Ava snapshot does not block pool preview", () => {
    assert.ok(rotation.selectedSenderAccountId)
  })
}

async function main(): Promise<void> {
  const productionMode = process.argv.includes("--production")

  await runLocalCertification()

  if (!productionMode) {
    console.log(`\n[${AVA_SENDER_POOL_ACTIVATION_1A_QA_MARKER}] local certification complete`)
    return
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    console.error("BLOCKED — production verification requires vercel-production-env-run.ts wrapper")
    process.exit(1)
  }

  await runProductionVerification(boot.admin)
  console.log(`\n[${AVA_SENDER_POOL_ACTIVATION_1A_QA_MARKER}] production verification complete`)
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
