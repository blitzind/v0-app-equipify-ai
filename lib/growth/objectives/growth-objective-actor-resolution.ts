/** GE-AUTO-2G — Objective execution actor resolution (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { resolveSequenceExecutionSender } from "@/lib/growth/sequences/execution/sequence-send-builder"
import { getSenderProfileBySenderAccountId } from "@/lib/growth/signatures/sender-profile-repository"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"

export const GROWTH_OBJECTIVE_ACTOR_RESOLUTION_QA_MARKER =
  "growth-objective-ge-auto-2g-v1" as const

export type ObjectiveActorResolutionReport = {
  userId: string
  userEmail: string
  organizationId: string
  senderAccountId: string | null
  hasActiveSenderProfile: boolean
  hasMailboxConnection: boolean
}

export class ObjectiveActorResolutionError extends Error {
  readonly code = "objective_actor_resolution_failed" as const
  readonly missing: string[]

  constructor(missing: string[]) {
    super(`Objective execution blocked — missing: ${missing.join(", ")}`)
    this.name = "ObjectiveActorResolutionError"
    this.missing = missing
  }
}

export async function resolveObjectiveActorContext(
  admin: SupabaseClient,
  objective: GrowthObjective,
): Promise<{ userId: string; userEmail: string } | null> {
  const userId = objective.ownerUserId
  if (!userId) return null
  const { data } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle()
  const email = data?.email
  if (!email || typeof email !== "string") return null
  return { userId, userEmail: email }
}

async function senderHasConnectedMailbox(admin: SupabaseClient, senderAccountId: string): Promise<boolean> {
  const { count } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("id", { count: "exact", head: true })
    .eq("sender_account_id", senderAccountId)
    .eq("status", "connected")
    .is("deleted_at", null)
  return (count ?? 0) > 0
}

async function resolveObjectiveOutboundSender(
  admin: SupabaseClient,
  ownerEmail: string | null,
): Promise<{
  senderAccountId: string | null
  hasActiveSenderProfile: boolean
  hasMailboxConnection: boolean
  ownerEmailMatches: boolean
}> {
  const routes = (await listDeliveryRoutes(admin)).filter((route) => route.enabled)
  const defaultSender = await resolveSequenceExecutionSender(admin)
  const candidateIds = [
    ...routes.map((route) => route.sender_account_id),
    ...(defaultSender?.senderAccountId ? [defaultSender.senderAccountId] : []),
  ]
  const uniqueIds = [...new Set(candidateIds.filter(Boolean))]

  let fallback: {
    senderAccountId: string
    hasActiveSenderProfile: boolean
    hasMailboxConnection: boolean
  } | null = null

  for (const senderAccountId of uniqueIds) {
    const profile = await getSenderProfileBySenderAccountId(admin, senderAccountId)
    const hasActiveSenderProfile = Boolean(profile?.active)
    const hasMailboxConnection = await senderHasConnectedMailbox(admin, senderAccountId)
    if (!hasActiveSenderProfile && !hasMailboxConnection) continue

    const ownerEmailMatches =
      Boolean(ownerEmail && profile?.email) &&
      profile!.email.trim().toLowerCase() === ownerEmail!.trim().toLowerCase()

    if (ownerEmailMatches) {
      return { senderAccountId, hasActiveSenderProfile, hasMailboxConnection, ownerEmailMatches: true }
    }

    if (!fallback) {
      fallback = { senderAccountId, hasActiveSenderProfile, hasMailboxConnection }
    }
  }

  if (fallback) {
    return { ...fallback, ownerEmailMatches: false }
  }

  return {
    senderAccountId: null,
    hasActiveSenderProfile: false,
    hasMailboxConnection: false,
    ownerEmailMatches: false,
  }
}

export async function requireObjectiveActorContext(
  admin: SupabaseClient,
  objective: GrowthObjective,
  options?: { requireOutboundIdentity?: boolean },
): Promise<ObjectiveActorResolutionReport> {
  const missing: string[] = []

  if (!objective.organizationId?.trim()) missing.push("organizationId")
  if (!objective.ownerUserId?.trim()) missing.push("ownerUserId")

  let userEmail: string | null = null
  if (objective.ownerUserId) {
    const { data } = await admin
      .from("profiles")
      .select("email")
      .eq("id", objective.ownerUserId)
      .maybeSingle()
    userEmail = typeof data?.email === "string" && data.email.trim() ? data.email.trim() : null
    if (!userEmail) missing.push("actorUserEmail")
  }

  let senderAccountId: string | null = null
  let hasActiveSenderProfile = false
  let hasMailboxConnection = false

  if (options?.requireOutboundIdentity) {
    const resolved = await resolveObjectiveOutboundSender(admin, userEmail)
    senderAccountId = resolved.senderAccountId
    hasActiveSenderProfile = resolved.hasActiveSenderProfile
    hasMailboxConnection = resolved.hasMailboxConnection

    if (!senderAccountId) {
      missing.push("senderProfileOrMailboxIdentity")
    } else if (!resolved.ownerEmailMatches) {
      missing.push("senderProfileOwnerMismatch")
    }
  }

  if (missing.length > 0) {
    throw new ObjectiveActorResolutionError(missing)
  }

  return {
    userId: objective.ownerUserId!,
    userEmail: userEmail!,
    organizationId: objective.organizationId,
    senderAccountId,
    hasActiveSenderProfile,
    hasMailboxConnection,
  }
}

export async function auditObjectiveActorContext(
  admin: SupabaseClient,
  objective: GrowthObjective,
): Promise<{ ok: boolean; missing: string[]; report: Partial<ObjectiveActorResolutionReport> }> {
  try {
    const report = await requireObjectiveActorContext(admin, objective, { requireOutboundIdentity: true })
    return { ok: true, missing: [], report }
  } catch (error) {
    if (error instanceof ObjectiveActorResolutionError) {
      return { ok: false, missing: error.missing, report: {} }
    }
    throw error
  }
}
