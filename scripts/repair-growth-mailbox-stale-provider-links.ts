/**
 * GS-GROWTH-MAIL-7F — Clear stale cross-sender provider_connection_settings.mailbox_connection_id links.
 *
 *   pnpm growth:repair-mailbox-links --dry-run
 *   GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM=yes pnpm growth:repair-mailbox-links --confirm
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM_ENV,
  GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM_VALUE,
  GROWTH_REPAIR_MAILBOX_LINKS_QA_MARKER,
  auditStaleProviderMailboxLinks,
  repairStaleProviderMailboxLinks,
} from "../lib/growth/provider-setup/repair-mailbox-stale-provider-links"

function resolveMode(argv: string[]): "dry_run" | "confirm" | null {
  if (argv.includes("--confirm")) return "confirm"
  if (argv.includes("--dry-run") || argv.includes("--dryRun")) return "dry_run"
  return null
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const mode = resolveMode(argv) ?? "dry_run"

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
  if (!boot) throw new Error("Could not bootstrap Supabase credentials.")

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const staleRows = await auditStaleProviderMailboxLinks(admin)

  if (mode === "dry_run") {
    console.log(
      JSON.stringify(
        {
          qa_marker: GROWTH_REPAIR_MAILBOX_LINKS_QA_MARKER,
          mode: "dry_run",
          stale_count: staleRows.length,
          rows: staleRows,
        },
        null,
        2,
      ),
    )
    return
  }

  if (process.env[GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM_ENV] !== GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM_VALUE) {
    throw new Error(
      `Confirm mode requires ${GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM_ENV}=${GROWTH_REPAIR_MAILBOX_LINKS_CONFIRM_VALUE}`,
    )
  }

  const result = await repairStaleProviderMailboxLinks(admin, { dryRun: false })
  const { logProviderOAuthMailboxFlow } = await import("../lib/growth/provider-setup/oauth-mailbox-resolution")
  for (const row of result.cleared) {
    const provider = row.provider_family === "microsoft" ? "microsoft" : "google"
    logProviderOAuthMailboxFlow("mailbox_repaired", {
      provider,
      senderId: row.sender_account_id,
      mailboxId: row.mailbox_connection_id,
      mailboxSenderId: row.mailbox_owner_sender_id,
      email: row.sender_email,
    })
  }
  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_REPAIR_MAILBOX_LINKS_QA_MARKER,
        mode: "confirm",
        cleared_count: result.cleared.length,
        cleared: result.cleared,
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
