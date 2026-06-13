import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthPlatformCommunicationSettings } from "@/lib/growth/communication/settings-repository"
import { ensureOAuthReplyIngestionConnection } from "@/lib/growth/replies/oauth-reply-ingestion-connection"
import { listGrowthOutboundConnections } from "@/lib/growth/outbound/connection-repository"
import { getMailboxConnection } from "@/lib/growth/mailboxes/mailbox-repository"
import type { GrowthReplyIngestionSource } from "@/lib/growth/reply-intelligence/reply-intent-types"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function resolveConnectionFromLeadOutboundMessages(
  admin: SupabaseClient,
  leadId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("connection_id")
    .eq("lead_id", leadId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return asString((data as { connection_id?: string } | null)?.connection_id) || null
}

async function resolveConnectionFromLeadDeliveryAttempts(
  admin: SupabaseClient,
  leadId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("sender_account_id, metadata")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(5)
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const metadata = (row as { metadata?: Record<string, unknown> }).metadata
    const fromMeta = asString(metadata?.provider_connection_id ?? metadata?.connection_id)
    if (fromMeta) return fromMeta
  }

  const senderAccountId = asString((data?.[0] as { sender_account_id?: string } | undefined)?.sender_account_id)
  if (senderAccountId) {
    const sender = await getSenderAccount(admin, senderAccountId)
    if (sender?.provider_connection_id) return sender.provider_connection_id
  }

  return null
}

async function resolveConnectionFromProviderFamily(
  admin: SupabaseClient,
  providerFamily: string,
  emailAddress?: string | null,
): Promise<string | null> {
  const connections = await listGrowthOutboundConnections(admin)
  const email = (emailAddress ?? "").trim().toLowerCase()
  const active = connections.filter(
    (connection) =>
      connection.providerFamily === providerFamily &&
      ["active", "connected"].includes(connection.status),
  )

  if (email) {
    const byEmail = active.find(
      (connection) =>
        connection.label.toLowerCase().includes(email) ||
        asString((connection.config as Record<string, unknown> | undefined)?.account_email).toLowerCase() === email,
    )
    if (byEmail) return byEmail.id
  }

  return active[0]?.id ?? null
}

async function resolveConnectionFromMailboxConnection(
  admin: SupabaseClient,
  mailboxConnectionId: string,
): Promise<string | null> {
  const mailbox = await getMailboxConnection(admin, mailboxConnectionId)
  if (!mailbox?.sender_account_id) return null

  const sender = await getSenderAccount(admin, mailbox.sender_account_id)
  if (sender?.provider_connection_id) return sender.provider_connection_id

  const settings = await fetchGrowthPlatformCommunicationSettings(admin)
  if (settings.activeEmailConnectionId) return settings.activeEmailConnectionId

  const byFamily = await resolveConnectionFromProviderFamily(
    admin,
    mailbox.provider_family,
    mailbox.email_address,
  )
  if (byFamily) return byFamily

  if (mailbox.provider_family === "google" || mailbox.provider_family === "microsoft") {
    return ensureOAuthReplyIngestionConnection(admin, {
      providerFamily: mailbox.provider_family,
      senderAccountId: mailbox.sender_account_id,
      mailboxEmail: mailbox.email_address,
    })
  }

  const { data, error } = await admin
    .schema("growth")
    .from("email_provider_connections")
    .select("id")
    .eq("provider_family", mailbox.provider_family)
    .in("status", ["active", "connected"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return asString((data as { id?: string } | null)?.id) || null
}

export type ResolveReplyIngestionConnectionInput = {
  leadId: string
  connectionId?: string | null
  mailboxConnectionId?: string | null
  source?: GrowthReplyIngestionSource
}

/** Resolve email_provider_connections.id for reply ingestion — prefers explicit sync context. */
export async function resolveReplyIngestionConnectionId(
  admin: SupabaseClient,
  input: ResolveReplyIngestionConnectionInput,
): Promise<string | null> {
  if (input.connectionId) return input.connectionId

  if (
    input.mailboxConnectionId &&
    (input.source === "google_mailbox_sync" || input.source === "manual_import")
  ) {
    const fromMailbox = await resolveConnectionFromMailboxConnection(admin, input.mailboxConnectionId)
    if (fromMailbox) return fromMailbox
  }

  const fromMessages = await resolveConnectionFromLeadOutboundMessages(admin, input.leadId)
  if (fromMessages) return fromMessages

  const fromAttempts = await resolveConnectionFromLeadDeliveryAttempts(admin, input.leadId)
  if (fromAttempts) return fromAttempts

  if (input.mailboxConnectionId) {
    const fromMailbox = await resolveConnectionFromMailboxConnection(admin, input.mailboxConnectionId)
    if (fromMailbox) return fromMailbox
  }

  return null
}

export const REPLY_INGESTION_CONNECTION_RESOLVER_QA_MARKER = "reply-ingestion-connection-resolver-v1" as const
