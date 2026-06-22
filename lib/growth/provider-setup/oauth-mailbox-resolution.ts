import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import type { GrowthMailboxConnectionSummary } from "@/lib/growth/mailboxes/mailbox-types"
import { isMailboxOwnedBySender } from "@/lib/growth/provider-setup/oauth-mailbox-ownership"
import type { GrowthProviderSetupFamily } from "@/lib/growth/provider-setup/provider-setup-types"

export { isMailboxOwnedBySender } from "@/lib/growth/provider-setup/oauth-mailbox-ownership"

export const GROWTH_OAUTH_MAILBOX_RESOLUTION_QA_MARKER = "growth-oauth-mailbox-resolution-7f-v1" as const

export type OAuthMailboxResolutionProvider = "google" | "microsoft"

export type ProviderOAuthMailboxFlowEvent =
  | "mailbox_stale_cross_sender_ignored"
  | "settings_mailbox_cross_sender_ignored"
  | "start_stale_mailbox_ignored"
  | "mailbox_created"
  | "mailbox_repaired"

async function readProviderSettingsMailboxId(
  admin: SupabaseClient,
  providerFamily: GrowthProviderSetupFamily,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("provider_connection_settings")
    .select("mailbox_connection_id")
    .eq("provider_family", providerFamily)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const value = data?.mailbox_connection_id
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

export function logProviderOAuthMailboxFlow(
  event: ProviderOAuthMailboxFlowEvent,
  details: {
    provider: OAuthMailboxResolutionProvider
    senderId?: string | null
    mailboxId?: string | null
    mailboxSenderId?: string | null
    email?: string | null
    returnTo?: string | null
    userId?: string | null
  },
): void {
  logGrowthEngine(`growth_${details.provider}_oauth_${event}`, {
    qa_marker: GROWTH_OAUTH_MAILBOX_RESOLUTION_QA_MARKER,
    organization_id: getGrowthEngineAiOrgId(),
    provider: details.provider,
    sender_id: details.senderId ?? null,
    mailbox_id: details.mailboxId ?? null,
    mailbox_sender_id: details.mailboxSenderId ?? null,
    email: details.email ?? null,
    return_to: details.returnTo ?? null,
    user_id: details.userId ?? null,
  })
}

export async function resolveOAuthConnectionMailboxId(
  admin: SupabaseClient,
  input: {
    providerFamily: OAuthMailboxResolutionProvider
    senderAccountId: string | null
    mailboxConnectionId?: string | null
    oauthEmail: string
    actorUserId: string
  },
  deps: {
    getMailboxConnection: (
      admin: SupabaseClient,
      mailboxId: string,
    ) => Promise<GrowthMailboxConnectionSummary | null>
    getMailboxConnectionBySender: (
      admin: SupabaseClient,
      senderAccountId: string,
    ) => Promise<GrowthMailboxConnectionSummary | null>
  },
): Promise<string | null> {
  let mailboxId: string | null = null

  if (input.mailboxConnectionId && input.senderAccountId) {
    const mailbox = await deps.getMailboxConnection(admin, input.mailboxConnectionId)
    if (mailbox && mailbox.provider_family === input.providerFamily) {
      if (isMailboxOwnedBySender(mailbox, input.senderAccountId)) {
        mailboxId = mailbox.id
      } else {
        logProviderOAuthMailboxFlow("mailbox_stale_cross_sender_ignored", {
          provider: input.providerFamily,
          senderId: input.senderAccountId,
          mailboxId: input.mailboxConnectionId,
          mailboxSenderId: mailbox.sender_account_id,
          email: input.oauthEmail,
          userId: input.actorUserId,
        })
      }
    }
  }

  if (!mailboxId && input.senderAccountId) {
    const bySender = await deps.getMailboxConnectionBySender(admin, input.senderAccountId)
    if (bySender && bySender.provider_family === input.providerFamily) {
      mailboxId = bySender.id
    }
  }

  if (!mailboxId && input.senderAccountId) {
    const settingsMailboxId = await readProviderSettingsMailboxId(admin, input.providerFamily)
    if (settingsMailboxId) {
      const settingsMailbox = await deps.getMailboxConnection(admin, settingsMailboxId)
      if (settingsMailbox && settingsMailbox.provider_family === input.providerFamily) {
        if (isMailboxOwnedBySender(settingsMailbox, input.senderAccountId)) {
          mailboxId = settingsMailbox.id
        } else {
          logProviderOAuthMailboxFlow("settings_mailbox_cross_sender_ignored", {
            provider: input.providerFamily,
            senderId: input.senderAccountId,
            mailboxId: settingsMailboxId,
            mailboxSenderId: settingsMailbox.sender_account_id,
            email: input.oauthEmail,
            userId: input.actorUserId,
          })
        }
      }
    }
  }

  return mailboxId
}

export async function resolveOAuthStartMailboxPointer(
  admin: SupabaseClient,
  input: {
    providerFamily: OAuthMailboxResolutionProvider
    senderAccountId: string | null
    mailboxConnectionId: string | null
    actorUserId: string
    returnTo?: string | null
  },
  deps: {
    getMailboxConnection: (
      admin: SupabaseClient,
      mailboxId: string,
    ) => Promise<GrowthMailboxConnectionSummary | null>
  },
): Promise<{
  mailboxConnectionId: string | null
  pendingSettingsMailboxConnectionId: string | null | undefined
}> {
  let mailboxConnectionId = input.mailboxConnectionId

  if (mailboxConnectionId && input.senderAccountId) {
    const mailbox = await deps.getMailboxConnection(admin, mailboxConnectionId)
    if (
      !mailbox ||
      mailbox.provider_family !== input.providerFamily ||
      !isMailboxOwnedBySender(mailbox, input.senderAccountId)
    ) {
      logProviderOAuthMailboxFlow("start_stale_mailbox_ignored", {
        provider: input.providerFamily,
        senderId: input.senderAccountId,
        mailboxId: mailboxConnectionId,
        mailboxSenderId: mailbox?.sender_account_id ?? null,
        email: mailbox?.email_address ?? null,
        returnTo: input.returnTo ?? null,
        userId: input.actorUserId,
      })
      mailboxConnectionId = null
    }
  }

  let pendingSettingsMailboxConnectionId: string | null | undefined = undefined

  if (input.mailboxConnectionId != null) {
    pendingSettingsMailboxConnectionId = mailboxConnectionId
  } else if (input.senderAccountId) {
    const existingMailboxId = await readProviderSettingsMailboxId(admin, input.providerFamily)
    if (existingMailboxId) {
      const staleMailbox = await deps.getMailboxConnection(admin, existingMailboxId)
      if (
        staleMailbox &&
        staleMailbox.provider_family === input.providerFamily &&
        !isMailboxOwnedBySender(staleMailbox, input.senderAccountId)
      ) {
        pendingSettingsMailboxConnectionId = null
      }
    }
  }

  return { mailboxConnectionId, pendingSettingsMailboxConnectionId }
}
