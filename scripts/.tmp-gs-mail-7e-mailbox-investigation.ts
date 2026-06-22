/**
 * GS-GROWTH-MAIL-7E — Gmail persistence investigation (read-only).
 * Run: tsx scripts/.tmp-gs-mail-7e-mailbox-investigation.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const TARGET_EMAIL = "mike@equipifyai.com"

function maskToken(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? "[present]" : "[missing]"
}

async function buildReadModelRow(admin: SupabaseClient, senderId: string, email: string) {
  const { data: mailbox } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("id,status,sender_account_id,email_address,encrypted_access_token,encrypted_refresh_token")
    .eq("sender_account_id", senderId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const tokenConfigured = Boolean(mailbox?.encrypted_access_token || mailbox?.encrypted_refresh_token)
  const connectionStatus = mailbox?.status ?? "no_mailbox"
  const needsReconnect =
    !mailbox ||
    !tokenConfigured ||
    !mailbox.status ||
    mailbox.status === "pending" ||
    mailbox.status === "connecting" ||
    mailbox.status === "error" ||
    mailbox.status === "expired" ||
    mailbox.status === "warning"

  return {
    senderId,
    email,
    mailboxId: mailbox?.id ?? null,
    mailboxEmail: mailbox?.email_address ?? null,
    connectionStatus,
    needsReconnect,
    joinKey: "mailbox_connections.sender_account_id → sender_accounts.id",
    joinMatched: Boolean(mailbox && mailbox.sender_account_id === senderId),
  }
}

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: [
      ".env.vercel.production",
      ".vercel/.env.production.local",
      ".env.production.local",
      ".env.local",
      ".env.local.rebuild",
    ],
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) {
    console.error("Could not bootstrap Supabase credentials.")
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const { data: senders, error: senderErr } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("id,email_address,display_name,status,provider_family,created_at,updated_at")
    .ilike("email_address", TARGET_EMAIL)

  if (senderErr) throw new Error(senderErr.message)

  const senderIds = (senders ?? []).map((s) => s.id as string)

  const { data: mailboxes, error: mailboxErr } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select(
      "id,sender_account_id,email_address,display_name,status,health_reason,validation_failure_count,token_expires_at,encrypted_access_token,encrypted_refresh_token,deleted_at,last_validation_at,updated_at,created_at",
    )
    .is("deleted_at", null)
    .or(
      senderIds.length > 0
        ? `email_address.ilike.${TARGET_EMAIL},sender_account_id.in.(${senderIds.join(",")})`
        : `email_address.ilike.${TARGET_EMAIL}`,
    )

  if (mailboxErr) throw new Error(mailboxErr.message)

  const { data: googleSettings } = await admin
    .schema("growth")
    .from("provider_connection_settings")
    .select(
      "id,status,sender_account_id,mailbox_connection_id,oauth_account_email,token_expires_at,last_refresh_status,updated_at",
    )
    .eq("provider_family", "google")
    .maybeSingle()

  const { data: oauthStates } = await admin
    .schema("growth")
    .from("provider_oauth_states")
    .select("id,sender_account_id,mailbox_connection_id,return_to,consumed_at,created_at")
    .eq("provider_family", "google")
    .order("created_at", { ascending: false })
    .limit(5)

  const mailboxIds = (mailboxes ?? []).map((m) => m.id as string)
  const { data: timeline } =
    mailboxIds.length > 0
      ? await admin
          .schema("growth")
          .from("mailbox_timeline_events")
          .select("event_type,title,summary,mailbox_connection_id,created_at")
          .in("mailbox_connection_id", mailboxIds)
          .order("created_at", { ascending: false })
          .limit(10)
      : { data: [] }

  const readModelRows = await Promise.all(
    (senders ?? []).map((sender) =>
      buildReadModelRow(admin, sender.id as string, sender.email_address as string),
    ),
  )

  const staleMailboxId = googleSettings?.mailbox_connection_id as string | undefined
  const staleMailbox = staleMailboxId
    ? await admin
        .schema("growth")
        .from("mailbox_connections")
        .select(
          "id,sender_account_id,email_address,status,deleted_at,health_reason,validation_failure_count,token_expires_at,updated_at",
        )
        .eq("id", staleMailboxId)
        .maybeSingle()
    : { data: null }

  const otherSenderId = staleMailbox.data?.sender_account_id as string | undefined
  const otherSender = otherSenderId
    ? await admin
        .schema("growth")
        .from("sender_accounts")
        .select("id,email_address,status,provider_family")
        .eq("id", otherSenderId)
        .maybeSingle()
    : { data: null }

  console.log(
    JSON.stringify(
      {
        qa_marker: "growth-mail-7e-mailbox-investigation-v1",
        target_email: TARGET_EMAIL,
        senders,
        mailboxes: (mailboxes ?? []).map((m) => ({
          ...m,
          encrypted_access_token: maskToken(m.encrypted_access_token),
          encrypted_refresh_token: maskToken(m.encrypted_refresh_token),
        })),
        google_provider_connection_settings: googleSettings,
        recent_oauth_states: oauthStates,
        recent_mailbox_timeline: timeline,
        read_model_rows: readModelRows,
        stale_settings_mailbox_row: staleMailbox.data,
        stale_mailbox_owner_sender: otherSender.data,
        join_analysis: {
          sender_ids: senderIds,
          mailbox_sender_ids: (mailboxes ?? []).map((m) => m.sender_account_id),
          mailbox_ids: mailboxIds,
          settings_sender_id: googleSettings?.sender_account_id ?? null,
          settings_mailbox_id: googleSettings?.mailbox_connection_id ?? null,
          settings_oauth_email: googleSettings?.oauth_account_email ?? null,
          stale_mailbox_deleted: staleMailbox.data?.deleted_at ?? null,
          email_mismatch:
            googleSettings?.oauth_account_email &&
            senders?.[0]?.email_address &&
            googleSettings.oauth_account_email.toLowerCase() !==
              String(senders[0].email_address).toLowerCase(),
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
