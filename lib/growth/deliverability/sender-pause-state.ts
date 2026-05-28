import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendDeliverabilityGovernanceEvent } from "@/lib/growth/deliverability/deliverability-governance-events"
import { loadMailboxSendPolicy } from "@/lib/growth/deliverability/mailbox-reputation-repository"
import type { GrowthSendThrottleDecision } from "@/lib/growth/deliverability/reputation-protection-types"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"

export type GrowthSenderDeliverabilityPauseState = {
  sender_account_id: string
  paused: boolean
  pause_reason: string | null
  paused_at: string | null
  pause_rule_id: string | null
  cooldown_until: string | null
  recovery_at: string | null
  operator_override: boolean
  operator_override_reason: string | null
  operator_override_at: string | null
}

function accountsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_accounts")
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export async function isSenderDeliverabilityPauseSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await accountsTable(admin).select("deliverability_paused_at").limit(1)
  return !error
}

export function mapSenderDeliverabilityPauseState(
  senderAccountId: string,
  row: Record<string, unknown>,
  operatorOverride = false,
): GrowthSenderDeliverabilityPauseState {
  const pausedAt = asString(row.deliverability_paused_at)
  const recoveryAt = asString(row.deliverability_recovery_at)
  const cooldownUntil = asString(row.deliverability_cooldown_until)
  const now = Date.now()
  const cooldownActive = cooldownUntil ? Date.parse(cooldownUntil) > now : false
  const paused =
    Boolean(pausedAt) &&
    !recoveryAt &&
    !operatorOverride &&
    (cooldownActive || Boolean(pausedAt))

  return {
    sender_account_id: senderAccountId,
    paused,
    pause_reason: asString(row.deliverability_pause_reason),
    paused_at: pausedAt,
    pause_rule_id: asString(row.deliverability_pause_rule_id),
    cooldown_until: cooldownUntil,
    recovery_at: asString(row.deliverability_recovery_at),
    operator_override: operatorOverride,
    operator_override_reason: asString(row.deliverability_operator_override_reason),
    operator_override_at: asString(row.deliverability_operator_override_at),
  }
}

export async function loadSenderDeliverabilityPauseState(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<GrowthSenderDeliverabilityPauseState | null> {
  const ready = await isSenderDeliverabilityPauseSchemaReady(admin)
  if (!ready) return null

  const [sender, policy] = await Promise.all([
    getSenderAccount(admin, senderAccountId),
    loadMailboxSendPolicy(admin, senderAccountId),
  ])
  if (!sender) return null

  const { data } = await accountsTable(admin)
    .select(
      "deliverability_pause_reason, deliverability_paused_at, deliverability_pause_rule_id, deliverability_cooldown_until, deliverability_recovery_at, deliverability_operator_override_reason, deliverability_operator_override_at",
    )
    .eq("id", senderAccountId)
    .maybeSingle()

  return mapSenderDeliverabilityPauseState(
    senderAccountId,
    (data as Record<string, unknown>) ?? {},
    policy.operator_override,
  )
}

export async function persistSenderDeliverabilityPause(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    mailboxConnectionId?: string | null
    throttle: GrowthSendThrottleDecision
    cooldownHours?: number
  },
): Promise<void> {
  const ready = await isSenderDeliverabilityPauseSchemaReady(admin)
  if (!ready || !input.throttle.paused) return

  const now = new Date()
  const cooldownHours = input.cooldownHours ?? 24
  const cooldownUntil = new Date(now.getTime() + cooldownHours * 3600000).toISOString()

  await accountsTable(admin)
    .update({
      deliverability_pause_reason: input.throttle.reason,
      deliverability_paused_at: now.toISOString(),
      deliverability_pause_rule_id: input.throttle.rule_id,
      deliverability_cooldown_until: cooldownUntil,
      deliverability_recovery_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", input.senderAccountId)

  await appendDeliverabilityGovernanceEvent(admin, {
    event_type: "mailbox_paused",
    sender_account_id: input.senderAccountId,
    mailbox_connection_id: input.mailboxConnectionId ?? null,
    title: "Mailbox paused — persistent deliverability enforcement",
    summary: input.throttle.reason ?? "Reputation protection pause persisted.",
    severity: "critical",
    metadata: {
      rule_id: input.throttle.rule_id,
      cooldown_until: cooldownUntil,
      persistent: true,
    },
  }).catch(() => undefined)
}

export async function recoverSenderDeliverabilityPause(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    mailboxConnectionId?: string | null
    reason: string
    operatorOverride?: boolean
    overrideReason?: string | null
  },
): Promise<void> {
  const ready = await isSenderDeliverabilityPauseSchemaReady(admin)
  if (!ready) return

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    deliverability_recovery_at: now,
    deliverability_cooldown_until: null,
    updated_at: now,
  }

  if (input.operatorOverride) {
    patch.deliverability_operator_override_at = now
    patch.deliverability_operator_override_reason = input.overrideReason ?? input.reason
    patch.deliverability_pause_reason = null
    patch.deliverability_paused_at = null
    patch.deliverability_pause_rule_id = null
  }

  await accountsTable(admin).update(patch).eq("id", input.senderAccountId)

  await appendDeliverabilityGovernanceEvent(admin, {
    event_type: input.operatorOverride ? "reputation_recovered" : "mailbox_recovered",
    sender_account_id: input.senderAccountId,
    mailbox_connection_id: input.mailboxConnectionId ?? null,
    title: input.operatorOverride ? "Operator override — deliverability pause cleared" : "Mailbox recovered",
    summary: input.reason,
    severity: input.operatorOverride ? "medium" : "low",
    operator_override: Boolean(input.operatorOverride),
    metadata: { recovery_at: now },
  }).catch(() => undefined)
}
