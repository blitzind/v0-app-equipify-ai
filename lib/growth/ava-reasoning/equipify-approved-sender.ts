/**
 * AVA-SUPERVISED-CUTOVER-1A — Approved sender identity + signature for Equipify Ava drafts.
 * Deployment adapter only — not part of reusable Ava reasoning.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveSupervisedApprovedSenderAccountId } from "@/lib/growth/sequences/execution/growth-supervised-sender-resolution-1c"
import {
  resolveGrowthOutboundIdentityContext,
  type GrowthOutboundIdentityContext,
} from "@/lib/growth/signatures/outbound-identity-context"
import { prepareOutboundEmailContent } from "@/lib/growth/signatures/outbound-signature-runtime"
import type { AvaOrganizationKnowledge } from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"
import type { AvaReasoningEmail } from "@/lib/fuzor/ava-reasoning/ava-reasoning-types"

export type EquipifyApprovedSenderBundle = {
  senderAccountId: string | null
  identity: GrowthOutboundIdentityContext | null
}

export async function loadEquipifyApprovedSenderBundle(
  admin: SupabaseClient,
  organizationId: string,
): Promise<EquipifyApprovedSenderBundle> {
  const senderAccountId = await resolveSupervisedApprovedSenderAccountId(admin, {
    organizationId,
  })
  if (!senderAccountId) {
    return { senderAccountId: null, identity: null }
  }

  const identity = await resolveGrowthOutboundIdentityContext(admin, {
    organizationId,
    senderAccountId,
  })

  return { senderAccountId, identity }
}

/** Inject approved sender into deployment knowledge (reusable layer stays generic). */
export function enrichOrganizationKnowledgeWithSenderIdentity(
  knowledge: AvaOrganizationKnowledge,
  identity: GrowthOutboundIdentityContext | null,
): AvaOrganizationKnowledge {
  if (!identity) return knowledge

  const senderLine = [
    identity.displayName,
    identity.title,
    identity.email,
    identity.company,
  ]
    .filter(Boolean)
    .join(" · ")

  return {
    ...knowledge,
    positioning: [
      ...knowledge.positioning,
      `Approved outbound sender identity: ${senderLine}`,
      "Do not include a signature block in the email body; the platform appends the approved sender signature after generation.",
    ],
  }
}

export async function applyEquipifyApprovedSignatureToEmail(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    email: AvaReasoningEmail
  },
): Promise<{ email: AvaReasoningEmail; signatureInjected: boolean }> {
  const prepared = await prepareOutboundEmailContent(admin, {
    senderAccountId: input.senderAccountId,
    subject: input.email.subject,
    bodyText: input.email.body,
  })

  return {
    email: {
      subject: prepared.subject,
      body: prepared.textBody,
    },
    signatureInjected: prepared.signatureInjected,
  }
}
