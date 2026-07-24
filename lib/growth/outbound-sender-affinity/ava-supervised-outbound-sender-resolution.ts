/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Ava supervised outbound sender resolution (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveOrAssignOutboundSenderAffinity } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-service"
import { resolveGrowthOutboundIdentityContext } from "@/lib/growth/signatures/outbound-identity-context"

export async function resolveAvaSupervisedOutboundSenderBundle(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    recipientEmail: string
    explicitSenderAccountId?: string | null
  },
) {
  const affinity = await resolveOrAssignOutboundSenderAffinity(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    contactEmail: input.recipientEmail,
    explicitSenderAccountId: input.explicitSenderAccountId ?? null,
    recipientEmailForChecks: input.recipientEmail,
  })

  if (!affinity.ok) {
    return { ok: false as const, code: affinity.code, message: affinity.message }
  }

  const identity = await resolveGrowthOutboundIdentityContext(admin, {
    organizationId: input.organizationId,
    senderAccountId: affinity.senderAccountId,
  })

  return {
    ok: true as const,
    senderAccountId: affinity.senderAccountId,
    mailboxConnectionId: affinity.mailboxConnectionId,
    senderEmail: affinity.senderEmail,
    assignment: affinity.assignment,
    identity,
    created: affinity.created,
  }
}
