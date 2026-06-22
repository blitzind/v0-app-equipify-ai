import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { resolveSequenceExecutionSender } from "@/lib/growth/sequences/execution/sequence-send-builder"
import { resolvePreferredSenderAccountFromSendrLink } from "@/lib/growth/sendr/growth-sendr-sequence-bridge-service"
import { buildSenderMergeFields } from "@/lib/growth/signatures/sender-merge-fields"
import type { GrowthOutboundIdentityContext } from "@/lib/growth/signatures/outbound-identity-types"
import {
  buildOutboundSenderPersonaInstructions,
  resolveOutboundSenderPersonaFromTitle,
} from "@/lib/growth/signatures/outbound-sender-persona-instructions"
import {
  getSenderProfile,
  getSenderProfileBySenderAccountId,
} from "@/lib/growth/signatures/sender-profile-repository"
import { resolveOutboundSignatureForSender } from "@/lib/growth/signatures/signature-resolver"

export type ResolveGrowthOutboundIdentityInput = {
  senderAccountId?: string | null
  senderProfileId?: string | null
  sequencePatternStepId?: string | null
  sequencePatternId?: string | null
  organizationId?: string | null
}

export async function resolveSenderAccountIdForCopilotGeneration(
  admin: SupabaseClient,
  input?: ResolveGrowthOutboundIdentityInput,
): Promise<string | null> {
  if (input?.senderAccountId?.trim()) return input.senderAccountId.trim()

  if (input?.senderProfileId?.trim()) {
    const profile = await getSenderProfile(admin, input.senderProfileId.trim())
    if (profile?.sender_account_id) return profile.sender_account_id
  }

  const organizationId = input?.organizationId?.trim() || getGrowthEngineAiOrgId()
  if (organizationId && input?.sequencePatternStepId) {
    const preferred = await resolvePreferredSenderAccountFromSendrLink(admin, {
      organizationId,
      sequencePatternStepId: input.sequencePatternStepId,
      sequencePatternId: input.sequencePatternId ?? null,
    })
    if (preferred) return preferred
  }

  const sender = await resolveSequenceExecutionSender(admin)
  return sender?.senderAccountId ?? null
}

export async function resolveGrowthOutboundIdentityContext(
  admin: SupabaseClient,
  input?: ResolveGrowthOutboundIdentityInput,
): Promise<GrowthOutboundIdentityContext | null> {
  const senderAccountId = await resolveSenderAccountIdForCopilotGeneration(admin, input)
  if (!senderAccountId) return null

  if (input?.senderProfileId?.trim()) {
    const profileResolution = await resolveOutboundSignatureForSender(admin, {
      senderAccountId,
    })
    const profile =
      profileResolution.activeProfile ??
      (await getSenderProfile(admin, input.senderProfileId.trim()))
    if (profile) {
      return buildIdentityFromProfile(profile, senderAccountId)
    }
  }

  const resolved = await resolveOutboundSignatureForSender(admin, { senderAccountId })
  const profile =
    resolved.activeProfile ?? (await getSenderProfileBySenderAccountId(admin, senderAccountId))

  if (profile) {
    return buildIdentityFromProfile(profile, senderAccountId)
  }

  const mergeFields = resolved.mergeFields
  const displayName = resolved.displayName || mergeFields["sender.name"] || "Sender"
  const title = mergeFields["sender.title"] || null
  const persona = resolveOutboundSenderPersonaFromTitle(title)

  return {
    senderAccountId,
    senderProfileId: resolved.profileId,
    displayName,
    title,
    company: mergeFields["sender.company"] || "Equipify.ai",
    website: mergeFields["sender.website"] || null,
    email: mergeFields["sender.email"] || null,
    personaKey: persona.key,
    personaInstructions: buildOutboundSenderPersonaInstructions(persona),
  }
}

function buildIdentityFromProfile(
  profile: NonNullable<Awaited<ReturnType<typeof getSenderProfileBySenderAccountId>>>,
  senderAccountId: string,
): GrowthOutboundIdentityContext {
  const mergeFields = buildSenderMergeFields(profile, profile.email, profile.display_name)
  const persona = resolveOutboundSenderPersonaFromTitle(profile.title)

  return {
    senderAccountId,
    senderProfileId: profile.id,
    displayName: profile.display_name,
    title: profile.title,
    company: mergeFields["sender.company"] || "Equipify.ai",
    website: profile.website,
    email: profile.email || mergeFields["sender.email"] || null,
    personaKey: persona.key,
    personaInstructions: buildOutboundSenderPersonaInstructions(persona),
  }
}

export type { GrowthOutboundIdentityContext } from "@/lib/growth/signatures/outbound-identity-types"
export { resolveOutboundSenderPersonaFromTitle } from "@/lib/growth/signatures/outbound-sender-persona-instructions"
