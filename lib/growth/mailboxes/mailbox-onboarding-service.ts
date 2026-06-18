import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getMailboxConnectionBySender,
  createMailboxConnection,
} from "@/lib/growth/mailboxes/mailbox-repository"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { extractDomainFromEmail } from "@/lib/growth/sender/sender-domain-validator"
import { getSenderAccount, updateSenderAccount } from "@/lib/growth/sender/sender-repository"
import {
  addSenderPoolMember,
  createSenderPool,
  getSenderPool,
  listSenderPoolMembers,
  listSenderPools,
  updateSenderPool,
} from "@/lib/growth/sender-pools/sender-pool-repository"
import {
  createWarmupProfile,
  generateWarmupSchedule,
  getWarmupProfile,
  updateWarmupProfile,
} from "@/lib/growth/warmup/warmup-repository"
import {
  GROWTH_MAILBOX_ONBOARDING_QA_MARKER,
  type GrowthMailboxOnboardingStatusPayload,
  type GrowthMailboxOnboardingStep,
} from "@/lib/growth/mailboxes/mailbox-onboarding-types"

function isDisconnectedMailbox(status: string | null | undefined): boolean {
  return !status || status === "pending" || status === "connecting" || status === "error" || status === "expired"
}

async function loadWarmupProfileForSender(admin: SupabaseClient, senderId: string) {
  const { data, error } = await admin
    .schema("growth")
    .from("warmup_profiles")
    .select("id")
    .eq("sender_account_id", senderId)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.id) return null
  return getWarmupProfile(admin, String(data.id))
}

async function findPoolMembershipForSender(admin: SupabaseClient, senderId: string) {
  const pools = await listSenderPools(admin)
  for (const pool of pools) {
    const members = await listSenderPoolMembers(admin, pool.id)
    const member = members.find((row) => row.senderAccountId === senderId)
    if (member) return { pool, member }
  }
  return null
}

function suggestOnboardingStep(input: {
  senderStatus: string
  providerFamily: string
  mailbox: GrowthMailboxOnboardingStatusPayload["mailbox"]
  deliveryRouteEnabled: boolean
}): GrowthMailboxOnboardingStep {
  if (!input.mailbox) return "connect_gmail"
  if (
    input.providerFamily === "google" &&
    (input.mailbox.needsReconnect || input.mailbox.status !== "connected")
  ) {
    return "connect_gmail"
  }
  if (input.mailbox.status !== "connected") return "validate"
  if (!input.deliveryRouteEnabled) return "validate"
  return "activation"
}

export async function buildMailboxOnboardingStatus(
  admin: SupabaseClient,
  senderId: string,
): Promise<GrowthMailboxOnboardingStatusPayload | null> {
  const sender = await getSenderAccount(admin, senderId)
  if (!sender || sender.deleted_at) return null

  const mailbox = await getMailboxConnectionBySender(admin, senderId).catch(() => null)
  const warmup = await loadWarmupProfileForSender(admin, senderId).catch(() => null)
  const routes = await listDeliveryRoutes(admin)
  const deliveryRouteEnabled = routes.some(
    (route) => route.sender_account_id === sender.id && route.enabled,
  )

  let poolMembership: GrowthMailboxOnboardingStatusPayload["poolMembership"] = null
  const membership = await findPoolMembershipForSender(admin, sender.id).catch(() => null)
  if (membership) {
    poolMembership = {
      poolId: membership.pool.id,
      poolName: membership.pool.name,
      poolStatus: membership.pool.status,
      memberId: membership.member.id,
      memberStatus: membership.member.memberStatus,
    }
  }

  const needsReconnect =
    sender.provider_family === "google" &&
    (!mailbox ||
      !mailbox.token_configured ||
      isDisconnectedMailbox(mailbox.status) ||
      mailbox.status === "warning")

  const mailboxSnapshot: GrowthMailboxOnboardingStatusPayload["mailbox"] = mailbox
    ? {
        id: mailbox.id,
        status: mailbox.status,
        tokenConfigured: mailbox.token_configured,
        healthTier: mailbox.health_tier,
        connectionHealth: mailbox.connection_health,
        lastValidationAt: mailbox.last_validation_at,
        needsReconnect,
      }
    : null

  return {
    qa_marker: GROWTH_MAILBOX_ONBOARDING_QA_MARKER,
    sender: {
      id: sender.id,
      displayName: sender.display_name,
      email: sender.email_address,
      status: sender.status,
      dailySendLimit: sender.daily_send_limit,
      providerFamily: sender.provider_family,
      warmupEnabled: sender.warmup_enabled,
      healthStatus: sender.health_status,
      domain: extractDomainFromEmail(sender.email_address),
    },
    mailbox: mailboxSnapshot,
    warmup: warmup
      ? {
          id: warmup.id,
          status: warmup.status,
          warmupDays: warmup.warmup_days,
          currentDailyVolume: warmup.current_daily_volume,
          warmupProgress: warmup.warmup_progress,
        }
      : null,
    poolMembership,
    deliveryRouteEnabled,
    suggestedStep: suggestOnboardingStep({
      senderStatus: sender.status,
      providerFamily: sender.provider_family,
      mailbox: mailboxSnapshot,
      deliveryRouteEnabled,
    }),
  }
}

export async function ensureMailboxConnectionForSender(
  admin: SupabaseClient,
  input: {
    senderId: string
    actorUserId: string
    actorEmail?: string | null
  },
): Promise<{ mailboxId: string; created: boolean }> {
  const sender = await getSenderAccount(admin, input.senderId)
  if (!sender) throw new Error("sender_not_found")

  const existing = await getMailboxConnectionBySender(admin, input.senderId)
  if (existing) return { mailboxId: existing.id, created: false }

  const mailbox = await createMailboxConnection(admin, {
    sender_account_id: input.senderId,
    provider_family: sender.provider_family,
    email_address: sender.email_address,
    display_name: sender.display_name,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail ?? null,
  })
  return { mailboxId: mailbox.id, created: true }
}

export async function finalizeMailboxOnboarding(
  admin: SupabaseClient,
  input: {
    senderId: string
    warmupEnabled?: boolean
    warmupDays?: number
    poolId?: string | null
    newPoolName?: string | null
    activatePool?: boolean
    activateSender?: boolean
    actorUserId: string
    actorEmail?: string | null
  },
): Promise<{
  warmupProfileId: string | null
  poolId: string | null
  poolMemberId: string | null
  status: GrowthMailboxOnboardingStatusPayload
}> {
  const sender = await getSenderAccount(admin, input.senderId)
  if (!sender) throw new Error("sender_not_found")

  let warmupProfileId: string | null = null
  if (input.warmupEnabled) {
    let profile = await loadWarmupProfileForSender(admin, input.senderId)
    if (!profile) {
      profile = await createWarmupProfile(admin, {
        sender_account_id: input.senderId,
        warmup_days: input.warmupDays ?? 30,
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail ?? null,
      })
    } else if (input.warmupDays && input.warmupDays !== profile.warmup_days) {
      profile = await updateWarmupProfile(admin, profile.id, {
        warmup_days: input.warmupDays,
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail ?? null,
      })
    }
    profile = await generateWarmupSchedule(admin, profile.id, {
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
    })
    warmupProfileId = profile.id
    await updateSenderAccount(admin, input.senderId, {
      warmup_enabled: true,
      warmup_eligible: true,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
    })
  }

  let poolId = input.poolId?.trim() || null
  let poolMemberId: string | null = null

  if (input.newPoolName?.trim()) {
    const pool = await createSenderPool(admin, {
      name: input.newPoolName.trim(),
      status: "draft",
      rotationStrategy: "weighted_health",
      requiresMailbox: true,
      allowAutoRotation: true,
    })
    poolId = pool.id
  }

  if (poolId) {
    const members = await listSenderPoolMembers(admin, poolId)
    const existing = members.find((member) => member.senderAccountId === input.senderId)
    if (existing) {
      poolMemberId = existing.id
    } else {
      const member = await addSenderPoolMember(admin, {
        senderPoolId: poolId,
        senderAccountId: input.senderId,
        memberStatus: "eligible",
      })
      poolMemberId = member.id
    }

    if (input.activatePool) {
      const pool = await getSenderPool(admin, poolId)
      if (pool && pool.status === "draft") {
        await updateSenderPool(admin, poolId, { status: "active" })
      }
    }
  }

  if (input.activateSender && sender.status !== "connected") {
    await updateSenderAccount(admin, input.senderId, {
      status: "connected",
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
    })
  }

  const status = await buildMailboxOnboardingStatus(admin, input.senderId)
  if (!status) throw new Error("sender_not_found")

  return { warmupProfileId, poolId, poolMemberId, status }
}
