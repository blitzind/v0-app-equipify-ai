import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { buildSignatureRenderInput } from "@/lib/growth/signatures/signature-profile-defaults"
import { renderSignatureTemplate } from "@/lib/growth/signatures/signature-template-render"
import { buildSenderMergeFields } from "@/lib/growth/signatures/sender-merge-fields"
import type { GrowthRenderedSignature, GrowthSenderProfile } from "@/lib/growth/signatures/signature-types"
import {
  getSenderProfile,
  getSenderProfileByMailboxConnectionId,
  getSenderProfileBySenderAccountId,
} from "@/lib/growth/signatures/sender-profile-repository"

export type OutboundSignatureResolutionSource =
  | "sender_profile"
  | "mailbox_profile"
  | "sender_account_fallback"
  | "none"

export type ResolvedOutboundSignature = {
  signature: GrowthRenderedSignature | null
  profileId: string | null
  senderAccountId: string
  displayName: string
  mergeFields: Record<string, string>
  resolutionSource: OutboundSignatureResolutionSource
  activeProfile: GrowthSenderProfile | null
}

export type ResolveOutboundSignatureInput = {
  senderAccountId: string
  mailboxConnectionId?: string | null
}

/**
 * Resolves sender profile + rendered signature for outbound email.
 * Priority: sender_account profile → mailbox_connection profile → sender account fallback → no signature.
 * Never throws — missing profile returns empty signature with merge-field fallbacks.
 */
export async function resolveOutboundSignatureForSender(
  admin: SupabaseClient,
  input: ResolveOutboundSignatureInput | string,
): Promise<ResolvedOutboundSignature> {
  const senderAccountId = typeof input === "string" ? input : input.senderAccountId
  const mailboxConnectionId =
    typeof input === "string" ? null : input.mailboxConnectionId?.trim() || null

  const sender = await getSenderAccount(admin, senderAccountId)
  if (!sender) {
    return emptyResolution(senderAccountId, {}, "none")
  }

  const senderProfile = await getSenderProfileBySenderAccountId(admin, senderAccountId)
  if (senderProfile?.active) {
    return buildResolvedSignature(sender, senderProfile, "sender_profile")
  }

  if (mailboxConnectionId) {
    const mailboxProfile = await getSenderProfileByMailboxConnectionId(admin, mailboxConnectionId)
    if (mailboxProfile?.active) {
      return buildResolvedSignature(sender, mailboxProfile, "mailbox_profile")
    }
  }

  if (senderProfile && !senderProfile.active) {
    return {
      signature: null,
      profileId: senderProfile.id,
      senderAccountId: sender.id,
      displayName: senderProfile.display_name,
      mergeFields: buildSenderMergeFields(senderProfile, sender.email_address, sender.display_name),
      resolutionSource: "none",
      activeProfile: null,
    }
  }

  return {
    signature: null,
    profileId: null,
    senderAccountId: sender.id,
    displayName: sender.display_name,
    mergeFields: buildSenderMergeFields(null, sender.email_address, sender.display_name),
    resolutionSource: "sender_account_fallback",
    activeProfile: null,
  }
}

export async function resolveOutboundSignatureForProfile(
  admin: SupabaseClient,
  profileId: string,
): Promise<ResolvedOutboundSignature | null> {
  const profile = await getSenderProfile(admin, profileId)
  if (!profile) return null

  const sender = await getSenderAccount(admin, profile.sender_account_id)
  if (!sender) return null

  if (!profile.active) {
    return {
      signature: null,
      profileId: profile.id,
      senderAccountId: profile.sender_account_id,
      displayName: profile.display_name,
      mergeFields: buildSenderMergeFields(profile, sender.email_address, sender.display_name),
      resolutionSource: "none",
      activeProfile: null,
    }
  }

  return buildResolvedSignature(sender, profile, "sender_profile")
}

function buildResolvedSignature(
  sender: { id: string; email_address: string; display_name: string },
  profile: GrowthSenderProfile,
  resolutionSource: OutboundSignatureResolutionSource,
): ResolvedOutboundSignature {
  const rendered = renderSignatureFromProfile(profile)
  const mergeFields = buildSenderMergeFields(
    profile,
    sender.email_address,
    sender.display_name,
    rendered.text,
  )
  return {
    signature: rendered,
    profileId: profile.id,
    senderAccountId: sender.id,
    displayName: profile.display_name,
    mergeFields,
    resolutionSource,
    activeProfile: profile,
  }
}

function emptyResolution(
  senderAccountId: string,
  mergeFields: Record<string, string>,
  resolutionSource: OutboundSignatureResolutionSource,
): ResolvedOutboundSignature {
  return {
    signature: null,
    profileId: null,
    senderAccountId,
    displayName: "",
    mergeFields,
    resolutionSource,
    activeProfile: null,
  }
}

export function renderSignatureFromProfile(profile: GrowthSenderProfile): GrowthRenderedSignature {
  return renderSignatureTemplate(profile.signature_template, buildSignatureRenderInput(profile))
}
