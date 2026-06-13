import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createGrowthProviderConnection,
  fetchGrowthProviderConnectionInternal,
} from "@/lib/growth/outbound/provider-connection-repository"
import {
  fetchGrowthOutboundConnectionById,
  listGrowthOutboundConnections,
} from "@/lib/growth/outbound/connection-repository"
import { getSenderAccount, updateSenderAccount } from "@/lib/growth/sender/sender-repository"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** Ensure email_provider_connections row exists for OAuth mailbox reply ingestion FK. */
export async function ensureOAuthReplyIngestionConnection(
  admin: SupabaseClient,
  input: {
    providerFamily: "google" | "microsoft"
    senderAccountId: string
    mailboxEmail: string
    actorUserId?: string | null
  },
): Promise<string | null> {
  const sender = await getSenderAccount(admin, input.senderAccountId)
  if (!sender) return null

  if (sender.provider_connection_id) {
    const linked = await fetchGrowthOutboundConnectionById(admin, sender.provider_connection_id)
    if (linked && linked.status !== "disabled") return linked.id
  }

  const email = input.mailboxEmail.trim().toLowerCase()
  const connections = await listGrowthOutboundConnections(admin)
  const existing = connections.find((connection) => {
    if (connection.status === "disabled") return false
    const config = connection.config as Record<string, unknown> | undefined
    const oauthFamily = asString(config?.oauth_provider_family)
    const configEmail = asString(config?.account_email).toLowerCase()
    if (oauthFamily === input.providerFamily && configEmail === email) return true
    return connection.label.toLowerCase().includes(email)
  })
  if (existing) {
    if (sender.provider_connection_id !== existing.id) {
      await updateSenderAccount(admin, input.senderAccountId, {
        provider_connection_id: existing.id,
        actorUserId: input.actorUserId ?? null,
      })
    }
    return existing.id
  }

  const providerKey = `${input.providerFamily}-oauth-reply-${input.senderAccountId.slice(0, 8)}`
  const created = await createGrowthProviderConnection(admin, {
    provider: providerKey,
    providerFamily: "custom",
    label: `${input.providerFamily === "google" ? "Google" : "Microsoft"} OAuth — ${email}`,
    config: {
      account_email: email,
      sender_account_id: input.senderAccountId,
      oauth_reply_ingestion: true,
      oauth_provider_family: input.providerFamily,
    },
    notes: "Auto-linked for inbox-sync reply ingestion.",
    createdBy: input.actorUserId ?? null,
  })

  await admin
    .schema("growth")
    .from("email_provider_connections")
    .update({
      status: "active",
      lifecycle_status: "connected",
      health_reason: "OAuth mailbox reply ingestion bridge",
      updated_at: new Date().toISOString(),
    })
    .eq("id", created.id)

  await updateSenderAccount(admin, input.senderAccountId, {
    provider_connection_id: created.id,
    actorUserId: input.actorUserId ?? null,
  })

  const verified = await fetchGrowthProviderConnectionInternal(admin, created.id)
  return verified?.id ?? created.id
}
