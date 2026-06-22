import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listMailboxConnections } from "@/lib/growth/mailboxes/mailbox-repository"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import { listSenderProfiles } from "@/lib/growth/signatures/sender-profile-repository"
import {
  GROWTH_SENDER_PROFILES_QA_MARKER,
  GROWTH_SIGNATURE_TEMPLATE_LABELS,
  GROWTH_SIGNATURE_TEMPLATES,
  type GrowthSenderProfile,
  type GrowthSenderProfileSignatureStatus,
  type GrowthSenderProfilesDashboardPayload,
} from "@/lib/growth/signatures/signature-types"

function resolveProfileSignatureStatus(profile: GrowthSenderProfile): GrowthSenderProfileSignatureStatus {
  if (!profile.active) return "disabled"
  if (profile.mailbox_connection_id) return "inherited"
  return "configured"
}

export async function buildSenderProfilesDashboard(
  admin: SupabaseClient,
): Promise<GrowthSenderProfilesDashboardPayload> {
  const [profiles, senders, mailboxes] = await Promise.all([
    listSenderProfiles(admin),
    listSenderAccounts(admin),
    listMailboxConnections(admin),
  ])

  const mailboxBySender = new Map(mailboxes.map((m) => [m.sender_account_id, m]))
  const profileBySender = new Map(profiles.map((p) => [p.sender_account_id, p]))

  const rows = profiles.map((profile) => {
    const sender = senders.find((s) => s.id === profile.sender_account_id)
    const mailbox =
      profile.mailbox_connection_id
        ? mailboxes.find((m) => m.id === profile.mailbox_connection_id)
        : mailboxBySender.get(profile.sender_account_id)

    return {
      profile,
      senderEmail: sender?.email_address ?? profile.email,
      mailboxEmail: mailbox?.email_address ?? null,
      mailboxId: mailbox?.id ?? profile.mailbox_connection_id,
      senderStatus: sender?.status ?? "unknown",
      connectionStatus: mailbox?.status ?? null,
      signatureStatus: resolveProfileSignatureStatus(profile),
    }
  })

  const unassignedSenders = senders
    .filter((sender) => !profileBySender.has(sender.id))
    .map((sender) => {
      const mailbox = mailboxBySender.get(sender.id)
      return {
        senderId: sender.id,
        email: sender.email_address,
        displayName: sender.display_name,
        mailboxId: mailbox?.id ?? null,
        mailboxEmail: mailbox?.email_address ?? null,
        signatureStatus: "missing" as GrowthSenderProfileSignatureStatus,
      }
    })

  return {
    qa_marker: GROWTH_SENDER_PROFILES_QA_MARKER,
    profiles: rows,
    unassignedSenders,
    templates: GROWTH_SIGNATURE_TEMPLATES.map((id) => ({
      id,
      label: GROWTH_SIGNATURE_TEMPLATE_LABELS[id],
      description:
        id === "simple"
          ? "Name, title, company, phone, website"
          : id === "branded"
            ? "Logo, name, title, company, contact links"
            : "Short sign-off with company",
    })),
  }
}
