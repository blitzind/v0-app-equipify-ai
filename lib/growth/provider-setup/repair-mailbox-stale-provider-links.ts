import type { SupabaseClient } from "@supabase/supabase-js"
import { isMailboxOwnedBySender } from "@/lib/growth/provider-setup/oauth-mailbox-ownership"

export const GROWTH_REPAIR_MAILBOX_LINKS_QA_MARKER = "growth-repair-mailbox-stale-provider-links-7f-v1" as const
export const GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM_ENV = "GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM" as const
export const GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM_VALUE = "yes" as const

/** CLI-safe structured log — no server-only / Next request imports. */
export function logRepairMailboxLinkCliEvent(
  event: "mailbox_repaired",
  details: {
    provider_family: string
    sender_account_id: string | null
    mailbox_connection_id: string
    mailbox_owner_sender_id: string
    sender_email: string | null
  },
): void {
  const provider = details.provider_family === "microsoft" ? "microsoft" : "google"
  console.log(
    JSON.stringify({
      qa_marker: GROWTH_REPAIR_MAILBOX_LINKS_QA_MARKER,
      event: `growth_${provider}_oauth_${event}`,
      provider,
      sender_id: details.sender_account_id,
      mailbox_id: details.mailbox_connection_id,
      mailbox_sender_id: details.mailbox_owner_sender_id,
      email: details.sender_email,
    }),
  )
}

export type StaleProviderMailboxLinkRow = {
  provider_family: string
  settings_id: string
  sender_account_id: string | null
  sender_email: string | null
  mailbox_connection_id: string
  mailbox_owner_sender_id: string
  mailbox_owner_email: string
  recommended_action: "clear_mailbox_connection_id"
}

export async function auditStaleProviderMailboxLinks(
  admin: SupabaseClient,
): Promise<StaleProviderMailboxLinkRow[]> {
  const { data: settingsRows, error: settingsError } = await admin
    .schema("growth")
    .from("provider_connection_settings")
    .select("id,provider_family,sender_account_id,mailbox_connection_id")
    .not("mailbox_connection_id", "is", null)

  if (settingsError) throw new Error(settingsError.message)

  const stale: StaleProviderMailboxLinkRow[] = []

  for (const row of settingsRows ?? []) {
    const mailboxId = String(row.mailbox_connection_id ?? "")
    if (!mailboxId) continue

    const { data: mailbox, error: mailboxError } = await admin
      .schema("growth")
      .from("mailbox_connections")
      .select("id,sender_account_id,email_address,deleted_at")
      .eq("id", mailboxId)
      .maybeSingle()

    if (mailboxError) throw new Error(mailboxError.message)
    if (!mailbox || mailbox.deleted_at) continue

    const settingsSenderId = row.sender_account_id ? String(row.sender_account_id) : null
    const mailboxOwnerSenderId = String(mailbox.sender_account_id)

    if (isMailboxOwnedBySender({ sender_account_id: mailboxOwnerSenderId }, settingsSenderId)) {
      continue
    }

    let senderEmail: string | null = null
    if (settingsSenderId) {
      const { data: sender } = await admin
        .schema("growth")
        .from("sender_accounts")
        .select("email_address")
        .eq("id", settingsSenderId)
        .maybeSingle()
      senderEmail = sender?.email_address ? String(sender.email_address) : null
    }

    stale.push({
      provider_family: String(row.provider_family),
      settings_id: String(row.id),
      sender_account_id: settingsSenderId,
      sender_email: senderEmail,
      mailbox_connection_id: mailboxId,
      mailbox_owner_sender_id: mailboxOwnerSenderId,
      mailbox_owner_email: String(mailbox.email_address),
      recommended_action: "clear_mailbox_connection_id",
    })
  }

  return stale
}

export async function repairStaleProviderMailboxLinks(
  admin: SupabaseClient,
  input: { dryRun: boolean },
): Promise<{ cleared: StaleProviderMailboxLinkRow[]; dry_run: boolean }> {
  const staleRows = await auditStaleProviderMailboxLinks(admin)
  if (input.dryRun) {
    return { cleared: staleRows, dry_run: true }
  }

  const cleared: StaleProviderMailboxLinkRow[] = []
  for (const row of staleRows) {
    const { error } = await admin
      .schema("growth")
      .from("provider_connection_settings")
      .update({
        mailbox_connection_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.settings_id)

    if (error) throw new Error(error.message)
    cleared.push(row)
  }

  return { cleared, dry_run: false }
}
