import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateSenderHealth } from "@/lib/growth/sender/sender-health"
import {
  appendSenderTimelineEvent,
  createSenderHealthEvent,
} from "@/lib/growth/sender/sender-health-events"
import { extractDomainFromEmail, validateSenderDomainStub } from "@/lib/growth/sender/sender-domain-validator"
import type {
  GrowthSenderAccount,
  GrowthSenderDomain,
  GrowthSenderProviderFamily,
} from "@/lib/growth/sender/sender-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function accountsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_accounts")
}

function domainsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_domains")
}

function activeAccountsQuery(admin: SupabaseClient) {
  return accountsTable(admin).is("deleted_at", null)
}

function mapAccount(row: Record<string, unknown>): GrowthSenderAccount {
  return {
    id: asString(row.id),
    provider_family: asString(row.provider_family) as GrowthSenderProviderFamily,
    provider_connection_id: asString(row.provider_connection_id) || null,
    display_name: asString(row.display_name),
    email_address: asString(row.email_address),
    status: asString(row.status) as GrowthSenderAccount["status"],
    daily_send_limit: asNumber(row.daily_send_limit, 50),
    daily_send_used: asNumber(row.daily_send_used, 0),
    warmup_eligible: Boolean(row.warmup_eligible),
    warmup_enabled: Boolean(row.warmup_enabled),
    sender_score: asNumber(row.sender_score, 100),
    health_status: asString(row.health_status) as GrowthSenderAccount["health_status"],
    last_health_check: asString(row.last_health_check) || null,
    last_send_at: asString(row.last_send_at) || null,
    notes: asString(row.notes) || null,
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    deleted_at: asString(row.deleted_at) || null,
  }
}

function mapDomain(row: Record<string, unknown>): GrowthSenderDomain {
  return {
    id: asString(row.id),
    domain: asString(row.domain),
    status: asString(row.status) as GrowthSenderDomain["status"],
    spf_valid: Boolean(row.spf_valid),
    dkim_valid: Boolean(row.dkim_valid),
    dmarc_valid: Boolean(row.dmarc_valid),
    mx_valid: Boolean(row.mx_valid),
    dns_checked_at: asString(row.dns_checked_at) || null,
    deliverability_score: asNumber(row.deliverability_score, 0),
    reputation_score: asNumber(row.reputation_score, 100),
    bounce_rate: row.bounce_rate == null ? null : asNumber(row.bounce_rate),
    reply_rate: row.reply_rate == null ? null : asNumber(row.reply_rate),
    spam_risk: row.spam_risk == null ? null : asNumber(row.spam_risk),
    health_summary: asString(row.health_summary) || null,
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  }
}

async function ensureDomainForEmail(admin: SupabaseClient, email: string): Promise<GrowthSenderDomain | null> {
  const domainName = extractDomainFromEmail(email)
  if (!domainName) return null

  const { data: existing } = await domainsTable(admin).select("*").eq("domain", domainName).maybeSingle()
  if (existing) return mapDomain(existing as Record<string, unknown>)

  const stub = validateSenderDomainStub({ domain: domainName })
  const { data, error } = await domainsTable(admin)
    .insert({
      domain: stub.domain,
      status: stub.status,
      spf_valid: stub.spf_valid,
      dkim_valid: stub.dkim_valid,
      dmarc_valid: stub.dmarc_valid,
      mx_valid: stub.mx_valid,
      dns_checked_at: stub.dns_checked_at,
      deliverability_score: stub.deliverability_score,
      reputation_score: stub.reputation_score,
      health_summary: stub.health_summary,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapDomain(data as Record<string, unknown>)
}

async function recomputeSenderHealth(
  admin: SupabaseClient,
  account: GrowthSenderAccount,
  domain: GrowthSenderDomain | null,
): Promise<GrowthSenderAccount> {
  const evaluation = evaluateSenderHealth({
    bounce_rate: domain?.bounce_rate,
    spam_risk: domain?.spam_risk,
    spf_valid: domain?.spf_valid,
    dkim_valid: domain?.dkim_valid,
    dmarc_valid: domain?.dmarc_valid,
    daily_send_used: account.daily_send_used,
    daily_send_limit: account.daily_send_limit,
    status: account.status,
  })

  const now = new Date().toISOString()
  const previousScore = account.sender_score

  const { data, error } = await accountsTable(admin)
    .update({
      sender_score: evaluation.sender_score,
      health_status: evaluation.health_status,
      last_health_check: now,
      updated_at: now,
    })
    .eq("id", account.id)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  const updated = mapAccount(data as Record<string, unknown>)

  if (previousScore !== updated.sender_score) {
    await appendSenderTimelineEvent(admin, {
      eventType: "sender_score_changed",
      title: `Sender score updated for ${updated.email_address}`,
      summary: `Score changed from ${previousScore} to ${updated.sender_score}.`,
      senderAccountId: updated.id,
      payload: {
        previous_score: previousScore,
        sender_score: updated.sender_score,
        health_status: updated.health_status,
      },
    })
  }

  return updated
}

export async function listSenderAccounts(admin: SupabaseClient): Promise<GrowthSenderAccount[]> {
  const { data, error } = await activeAccountsQuery(admin)
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapAccount(row as Record<string, unknown>))
}

export async function getSenderAccount(admin: SupabaseClient, senderId: string): Promise<GrowthSenderAccount | null> {
  const { data, error } = await activeAccountsQuery(admin).select("*").eq("id", senderId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapAccount(data as Record<string, unknown>)
}

export async function createSenderAccount(
  admin: SupabaseClient,
  input: {
    provider_family: GrowthSenderProviderFamily
    display_name: string
    email_address: string
    provider_connection_id?: string | null
    daily_send_limit?: number
    warmup_eligible?: boolean
    notes?: string | null
    status?: GrowthSenderAccount["status"]
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthSenderAccount> {
  const email = input.email_address.trim().toLowerCase()
  const domain = await ensureDomainForEmail(admin, email)

  const evaluation = evaluateSenderHealth({
    spf_valid: domain?.spf_valid,
    dkim_valid: domain?.dkim_valid,
    dmarc_valid: domain?.dmarc_valid,
    spam_risk: domain?.spam_risk,
    status: input.status ?? "pending",
    daily_send_limit: input.daily_send_limit ?? 50,
    daily_send_used: 0,
  })

  const now = new Date().toISOString()
  const { data, error } = await accountsTable(admin)
    .insert({
      provider_family: input.provider_family,
      provider_connection_id: input.provider_connection_id ?? null,
      display_name: input.display_name.trim(),
      email_address: email,
      status: input.status ?? "pending",
      daily_send_limit: input.daily_send_limit ?? 50,
      daily_send_used: 0,
      warmup_eligible: input.warmup_eligible ?? true,
      warmup_enabled: false,
      sender_score: evaluation.sender_score,
      health_status: evaluation.health_status,
      last_health_check: now,
      notes: input.notes ?? null,
      updated_at: now,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  const account = mapAccount(data as Record<string, unknown>)

  await appendSenderTimelineEvent(admin, {
    eventType: "sender_connected",
    title: `Sender registered: ${account.email_address}`,
    summary: `${account.display_name} added as ${account.provider_family} sender (infrastructure only).`,
    senderAccountId: account.id,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    payload: { provider_family: account.provider_family, status: account.status },
  })

  if (evaluation.reasons.length > 0) {
    await createSenderHealthEvent(admin, {
      sender_account_id: account.id,
      domain_id: domain?.id ?? null,
      event_type: "sender_registered",
      severity: evaluation.health_status === "critical" ? "high" : "low",
      title: "Sender health baseline recorded",
      description: evaluation.reasons.join("; "),
      metadata: { sender_score: evaluation.sender_score },
    })
  }

  return account
}

export async function updateSenderAccount(
  admin: SupabaseClient,
  senderId: string,
  input: Partial<{
    display_name: string
    status: GrowthSenderAccount["status"]
    daily_send_limit: number
    daily_send_used: number
    warmup_eligible: boolean
    warmup_enabled: boolean
    notes: string | null
    provider_connection_id: string | null
  }> & {
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthSenderAccount> {
  const existing = await getSenderAccount(admin, senderId)
  if (!existing) throw new Error("sender_not_found")

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.display_name != null) patch.display_name = input.display_name.trim()
  if (input.status != null) patch.status = input.status
  if (input.daily_send_limit != null) patch.daily_send_limit = input.daily_send_limit
  if (input.daily_send_used != null) patch.daily_send_used = input.daily_send_used
  if (input.warmup_eligible != null) patch.warmup_eligible = input.warmup_eligible
  if (input.warmup_enabled != null) patch.warmup_enabled = input.warmup_enabled
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.provider_connection_id !== undefined) patch.provider_connection_id = input.provider_connection_id

  const { data, error } = await accountsTable(admin)
    .update(patch)
    .eq("id", senderId)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  let account = mapAccount(data as Record<string, unknown>)

  const domainName = extractDomainFromEmail(account.email_address)
  const domain = domainName
    ? await domainsTable(admin).select("*").eq("domain", domainName).maybeSingle().then((res) =>
        res.data ? mapDomain(res.data as Record<string, unknown>) : null,
      )
    : null

  account = await recomputeSenderHealth(admin, account, domain)

  if (input.status === "disabled" && existing.status !== "disabled") {
    await appendSenderTimelineEvent(admin, {
      eventType: "sender_disabled",
      title: `Sender disabled: ${account.email_address}`,
      summary: "Sender account marked disabled — no outbound sending.",
      senderAccountId: account.id,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
  }

  return account
}

export async function softDeleteSenderAccount(
  admin: SupabaseClient,
  input: { senderId: string; actorUserId?: string | null; actorEmail?: string | null },
): Promise<{ id: string; deleted_at: string }> {
  const existing = await getSenderAccount(admin, input.senderId)
  if (!existing) throw new Error("sender_not_found")

  const deletedAt = new Date().toISOString()
  const { data, error } = await accountsTable(admin)
    .update({ deleted_at: deletedAt, status: "disabled", updated_at: deletedAt })
    .eq("id", input.senderId)
    .is("deleted_at", null)
    .select("id, deleted_at")
    .single()

  if (error) throw new Error(error.message)

  await appendSenderTimelineEvent(admin, {
    eventType: "sender_disabled",
    title: `Sender removed: ${existing.email_address}`,
    summary: "Sender account soft-deleted from infrastructure registry.",
    senderAccountId: existing.id,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    payload: { soft_deleted: true },
  })

  return { id: asString((data as Record<string, unknown>).id), deleted_at: deletedAt }
}

export async function listSenderDomains(admin: SupabaseClient): Promise<GrowthSenderDomain[]> {
  const { data, error } = await domainsTable(admin).select("*").order("domain", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDomain(row as Record<string, unknown>))
}

export async function updateSenderDomain(
  admin: SupabaseClient,
  domainId: string,
  input: Partial<{
    spf_valid: boolean
    dkim_valid: boolean
    dmarc_valid: boolean
    mx_valid: boolean
    bounce_rate: number | null
    reply_rate: number | null
    spam_risk: number | null
  }> & {
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthSenderDomain> {
  const { data: existing, error: loadError } = await domainsTable(admin).select("*").eq("id", domainId).maybeSingle()
  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error("domain_not_found")

  const current = mapDomain(existing as Record<string, unknown>)
  const validated = validateSenderDomainStub({
    domain: current.domain,
    spf_valid: input.spf_valid ?? current.spf_valid,
    dkim_valid: input.dkim_valid ?? current.dkim_valid,
    dmarc_valid: input.dmarc_valid ?? current.dmarc_valid,
    mx_valid: input.mx_valid ?? current.mx_valid,
    bounce_rate: input.bounce_rate ?? current.bounce_rate,
    reply_rate: input.reply_rate ?? current.reply_rate,
    spam_risk: input.spam_risk ?? current.spam_risk,
  })

  const previousStatus = current.status
  const { data, error } = await domainsTable(admin)
    .update({
      status: validated.status,
      spf_valid: validated.spf_valid,
      dkim_valid: validated.dkim_valid,
      dmarc_valid: validated.dmarc_valid,
      mx_valid: validated.mx_valid,
      dns_checked_at: validated.dns_checked_at,
      deliverability_score: validated.deliverability_score,
      reputation_score: validated.reputation_score,
      health_summary: validated.health_summary,
      bounce_rate: input.bounce_rate ?? current.bounce_rate,
      reply_rate: input.reply_rate ?? current.reply_rate,
      spam_risk: input.spam_risk ?? current.spam_risk,
      updated_at: new Date().toISOString(),
    })
    .eq("id", domainId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  const updated = mapDomain(data as Record<string, unknown>)

  if (validated.status === "valid" && previousStatus !== "valid") {
    await appendSenderTimelineEvent(admin, {
      eventType: "domain_validated",
      title: `Domain validated: ${updated.domain}`,
      summary: updated.health_summary,
      domainId: updated.id,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      payload: { deliverability_score: updated.deliverability_score },
    })
  }

  if (
    (validated.status === "invalid" || validated.status === "warning") &&
    previousStatus === "valid"
  ) {
    await appendSenderTimelineEvent(admin, {
      eventType: "domain_health_declined",
      title: `Domain health declined: ${updated.domain}`,
      summary: updated.health_summary,
      domainId: updated.id,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      payload: { status: updated.status, deliverability_score: updated.deliverability_score },
    })

    await createSenderHealthEvent(admin, {
      domain_id: updated.id,
      event_type: "domain_health_declined",
      severity: validated.status === "invalid" ? "critical" : "high",
      title: `Domain health declined: ${updated.domain}`,
      description: updated.health_summary ?? "Domain health declined.",
      metadata: { status: updated.status },
    })
  }

  return updated
}
