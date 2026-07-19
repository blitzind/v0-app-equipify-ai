/** GE-AIOS-END-TO-END-1C — Resolve approved sender for supervised package transport (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  getSenderAccount,
  listSenderAccounts,
} from "@/lib/growth/sender/sender-repository"
import { resolvePreferredSenderAccountFromSendrLink } from "@/lib/growth/sendr/growth-sendr-sequence-bridge-service"

export const GE_AIOS_SUPERVISED_SENDER_RESOLUTION_1C_QA_MARKER =
  "ge-aios-supervised-sender-resolution-1c-v1" as const

const SUPERVISED_PRIMARY_OUTBOUND_SENDER_EMAIL = "ava@equipifyai.com" as const

function isUsableSenderStatus(status: string): boolean {
  return status === "connected" || status === "warming"
}

export async function resolveSupervisedApprovedSenderAccountId(
  admin: SupabaseClient,
  input: {
    organizationId: string
    package?: GrowthAutonomousOutreachApprovalPackage | null
    explicitSenderAccountId?: string | null
    sequencePatternStepId?: string | null
    sequencePatternId?: string | null
  },
): Promise<string | null> {
  const explicit = input.explicitSenderAccountId?.trim() || input.package?.approvedSenderAccountId?.trim()
  if (explicit) {
    const sender = await getSenderAccount(admin, explicit)
    if (sender && isUsableSenderStatus(sender.status)) return sender.id
  }

  if (input.sequencePatternStepId) {
    const preferred = await resolvePreferredSenderAccountFromSendrLink(admin, {
      organizationId: input.organizationId,
      sequencePatternStepId: input.sequencePatternStepId,
      sequencePatternId: input.sequencePatternId ?? null,
    })
    if (preferred) {
      const sender = await getSenderAccount(admin, preferred)
      if (sender && isUsableSenderStatus(sender.status)) return sender.id
    }
  }

  const senders = await listSenderAccounts(admin)
  const primary = senders.find(
    (row) =>
      row.email_address.trim().toLowerCase() === SUPERVISED_PRIMARY_OUTBOUND_SENDER_EMAIL &&
      isUsableSenderStatus(row.status),
  )
  if (primary) return primary.id

  return null
}
