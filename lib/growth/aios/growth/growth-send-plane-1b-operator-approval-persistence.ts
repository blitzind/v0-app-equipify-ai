/**
 * GE-AIOS-SEND-PLANE-1B — Canonical operator approval persistence (client-safe).
 * Operator-approved assets in the existing Growth 5F package are transport authority.
 */

import type {
  GrowthAutonomousOutreachApprovalPackage,
  GrowthAutonomousOutreachPreparedAssetSummary,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { CanonicalOutreachTransportChannel } from "@/lib/growth/aios/growth/growth-send-plane-1a-materialization"
import {
  reviewProductionHumanCommunicationConstitution,
  stripAiGeneratedSignatureContent,
  type GrowthCanonicalDisplayIdentity,
} from "@/lib/growth/aios/growth/growth-send-plane-1a-constitution"

export const GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER =
  "ge-aios-send-plane-1b-canonical-operator-approval-persistence-v1" as const

export type GrowthAutonomousOutreachAssetVersionStatus = "generated" | "edited" | "approved"

export type GrowthAutonomousOutreachPackageChannel =
  GrowthAutonomousOutreachPreparedAssetSummary["channel"]

export const SEND_PLANE_1B_EDITABLE_PACKAGE_CHANNELS = [
  "email",
  "linkedin",
  "sms",
  "voicemail",
  "call",
  "sendr",
  "follow_up",
  "meeting_request",
] as const satisfies readonly GrowthAutonomousOutreachPackageChannel[]

export type SendPlane1BEditablePackageChannel = (typeof SEND_PLANE_1B_EDITABLE_PACKAGE_CHANNELS)[number]

export type SendPlane1BTransportAssetSource =
  | "approved_operator"
  | "operator_edited"
  | "generated_asset"
  | "brief_regeneration"

export type SendPlane1BResolvedTransportAsset = {
  channel: CanonicalOutreachTransportChannel
  body: string
  subject: string | null
  source: SendPlane1BTransportAssetSource
  versionStatus: GrowthAutonomousOutreachAssetVersionStatus
  constitutionWarnings: string[]
}

const TRANSPORT_CHANNEL_TO_PACKAGE: Record<
  CanonicalOutreachTransportChannel,
  GrowthAutonomousOutreachPackageChannel
> = {
  email: "email",
  sms: "sms",
  linkedin: "linkedin",
  call: "call",
  voicemail: "voicemail",
  sendr: "sendr",
  follow_up: "follow_up",
  meeting_request: "meeting_request",
}

export function mapTransportChannelToPackageChannel(
  channel: CanonicalOutreachTransportChannel,
): GrowthAutonomousOutreachPackageChannel {
  return TRANSPORT_CHANNEL_TO_PACKAGE[channel]
}

export function mapPackageChannelToTransportChannel(
  channel: GrowthAutonomousOutreachPackageChannel,
): CanonicalOutreachTransportChannel | null {
  if (channel === "meeting_request") return "meeting_request"
  if (
    channel === "email" ||
    channel === "sms" ||
    channel === "linkedin" ||
    channel === "call" ||
    channel === "voicemail" ||
    channel === "sendr" ||
    channel === "follow_up"
  ) {
    return channel
  }
  return null
}

export function seedGeneratedAssetVersionMetadata(
  asset: GrowthAutonomousOutreachPreparedAssetSummary,
): GrowthAutonomousOutreachPreparedAssetSummary {
  const generatedPreview =
    asset.generatedPreview?.trim() ||
    (asset.versionStatus === "generated" || !asset.operatorPreview?.trim()
      ? asset.preview?.trim()
      : "") ||
    asset.preview?.trim() ||
    ""
  const preview =
    asset.approvedPreview?.trim() ||
    asset.operatorPreview?.trim() ||
    asset.preview?.trim() ||
    generatedPreview

  return {
    ...asset,
    preview,
    generatedPreview,
    operatorPreview: asset.operatorPreview ?? null,
    approvedPreview: asset.approvedPreview ?? null,
    versionStatus: asset.versionStatus ?? "generated",
    editedAt: asset.editedAt ?? null,
    editedBy: asset.editedBy ?? null,
    approvedAt: asset.approvedAt ?? null,
    constitutionWarnings: asset.constitutionWarnings ?? [],
  }
}

export function parseEmailTransportFromAssetPreview(preview: string): {
  subject: string | null
  body: string
} {
  const trimmed = preview.trim()
  if (!trimmed) return { subject: null, body: "" }

  const subjectMatch = trimmed.match(/^Subject:\s*(.+)$/im)
  const subject = subjectMatch?.[1]?.trim() ?? null
  let body = trimmed
  if (subjectMatch) {
    body = body.replace(/^Subject:\s*.+\n?/im, "")
  }
  body = body.replace(/^Preview:\s*.+\n?/im, "")
  return { subject, body: body.trim() }
}

export function reviewOperatorEditConstitutionWarnings(
  text: string,
  companyName: string,
  canonicalIdentity?: GrowthCanonicalDisplayIdentity | null,
): string[] {
  return reviewProductionHumanCommunicationConstitution(text, companyName, canonicalIdentity)
}

export function resolvePackageCanonicalDisplayIdentity(
  pkg: GrowthAutonomousOutreachApprovalPackage | null | undefined,
): GrowthCanonicalDisplayIdentity | null {
  return (
    pkg?.canonicalDisplayIdentity ?? pkg?.salesStrategyBrief?.canonicalDisplayIdentity ?? null
  )
}

export function prepareOperatorApprovedTransportBody(text: string): string {
  return stripAiGeneratedSignatureContent(text.trim())
}

export function findPackageAssetByChannel(
  pkg: GrowthAutonomousOutreachApprovalPackage | null | undefined,
  channel: GrowthAutonomousOutreachPackageChannel,
): GrowthAutonomousOutreachPreparedAssetSummary | null {
  return pkg?.generatedAssets.find((row) => row.channel === channel) ?? null
}

export function resolvePackageAssetPreviewForTransport(
  asset: GrowthAutonomousOutreachPreparedAssetSummary | null | undefined,
): {
  preview: string | null
  source: SendPlane1BTransportAssetSource
  versionStatus: GrowthAutonomousOutreachAssetVersionStatus
} | null {
  if (!asset) return null

  if (asset.versionStatus === "approved" && asset.approvedPreview?.trim()) {
    return {
      preview: asset.approvedPreview.trim(),
      source: "approved_operator",
      versionStatus: "approved",
    }
  }
  if (asset.operatorPreview?.trim()) {
    return {
      preview: asset.operatorPreview.trim(),
      source: "operator_edited",
      versionStatus: "edited",
    }
  }
  const generated = asset.preview?.trim() || asset.generatedPreview?.trim() || null
  if (generated) {
    return {
      preview: generated,
      source: "generated_asset",
      versionStatus: asset.versionStatus ?? "generated",
    }
  }
  return null
}

export function resolveTransportAssetFromPackage(
  pkg: GrowthAutonomousOutreachApprovalPackage | null | undefined,
  channel: CanonicalOutreachTransportChannel,
  companyName: string,
  canonicalIdentity?: GrowthCanonicalDisplayIdentity | null,
): SendPlane1BResolvedTransportAsset | null {
  const packageChannel = mapTransportChannelToPackageChannel(channel)
  const asset = findPackageAssetByChannel(pkg, packageChannel)
  const resolved = resolvePackageAssetPreviewForTransport(asset)
  if (!resolved?.preview) return null

  let subject: string | null = null
  let body = resolved.preview
  if (channel === "email") {
    const parsed = parseEmailTransportFromAssetPreview(resolved.preview)
    subject = parsed.subject
    body = parsed.body || resolved.preview
  }

  const identity = canonicalIdentity ?? resolvePackageCanonicalDisplayIdentity(pkg)

  const constitutionWarnings =
    resolved.versionStatus === "approved"
      ? asset?.constitutionWarnings ?? []
      : reviewOperatorEditConstitutionWarnings(body, companyName, identity)

  return {
    channel,
    body,
    subject,
    source: resolved.source,
    versionStatus: resolved.versionStatus,
    constitutionWarnings,
  }
}

export function applyOperatorDraftEditsToPackage(input: {
  pkg: GrowthAutonomousOutreachApprovalPackage
  draftEdits: Partial<Record<SendPlane1BEditablePackageChannel, string>>
  operatorUserId: string
  editedAt: string
  companyName: string
}): GrowthAutonomousOutreachApprovalPackage {
  const channelLabels: Record<SendPlane1BEditablePackageChannel, string> = {
    email: "Email",
    linkedin: "LinkedIn",
    sms: "SMS",
    voicemail: "Voicemail",
    call: "Call guide",
    sendr: "Personalized Video",
    follow_up: "Follow-up sequence",
    meeting_request: "Meeting request",
  }

  const assets = input.pkg.generatedAssets.map((asset) => ({ ...asset }))
  const indexByChannel = new Map(assets.map((asset, index) => [asset.channel, index]))

  for (const channel of SEND_PLANE_1B_EDITABLE_PACKAGE_CHANNELS) {
    const next = input.draftEdits[channel]
    if (next == null) continue

    const trimmed = next.trim()
    if (!trimmed) continue

    const existingIndex = indexByChannel.get(channel)
    const existing =
      existingIndex != null
        ? assets[existingIndex]
        : ({
            channel,
            label: channelLabels[channel],
            preview: "",
            draftOnly: true,
          } as GrowthAutonomousOutreachPreparedAssetSummary)

    if (existing.versionStatus === "approved") {
      continue
    }

    const generatedPreview =
      existing.generatedPreview?.trim() || existing.preview?.trim() || trimmed
    const changed = trimmed !== generatedPreview
    const warnings = reviewOperatorEditConstitutionWarnings(
      trimmed,
      input.companyName,
      resolvePackageCanonicalDisplayIdentity(input.pkg),
    )

    const updated = seedGeneratedAssetVersionMetadata({
      ...existing,
      label: existing.label || channelLabels[channel],
      preview: trimmed,
      generatedPreview,
      operatorPreview: changed ? trimmed : null,
      versionStatus: changed ? "edited" : "generated",
      editedAt: changed ? input.editedAt : existing.editedAt ?? null,
      editedBy: changed ? input.operatorUserId : existing.editedBy ?? null,
      constitutionWarnings: warnings,
    })

    if (existingIndex != null) {
      assets[existingIndex] = updated
    } else {
      assets.push(updated)
      indexByChannel.set(channel, assets.length - 1)
    }
  }

  return {
    ...input.pkg,
    generatedAssets: assets,
  }
}

export function freezeApprovedOperatorAssetsOnPackage(input: {
  pkg: GrowthAutonomousOutreachApprovalPackage
  approvedAt: string
}): GrowthAutonomousOutreachApprovalPackage {
  return {
    ...input.pkg,
    generatedAssets: input.pkg.generatedAssets.map((asset) => {
      const canonical = asset.preview?.trim() || asset.operatorPreview?.trim() || asset.generatedPreview?.trim()
      if (!canonical) return seedGeneratedAssetVersionMetadata(asset)

      return seedGeneratedAssetVersionMetadata({
        ...asset,
        preview: canonical,
        approvedPreview: canonical,
        operatorPreview: asset.operatorPreview?.trim() ? asset.operatorPreview : canonical,
        versionStatus: "approved",
        approvedAt: input.approvedAt,
      })
    }),
  }
}

export function mergeOperatorAssetStateFromPreviousPackage(input: {
  generatedAssets: GrowthAutonomousOutreachPreparedAssetSummary[]
  previousPackage?: GrowthAutonomousOutreachApprovalPackage | null
}): GrowthAutonomousOutreachPreparedAssetSummary[] {
  if (!input.previousPackage?.generatedAssets?.length) {
    return input.generatedAssets.map(seedGeneratedAssetVersionMetadata)
  }

  const previousByChannel = new Map(
    input.previousPackage.generatedAssets.map((asset) => [asset.channel, asset]),
  )

  return input.generatedAssets.map((asset) => {
    const seeded = seedGeneratedAssetVersionMetadata(asset)
    const previous = previousByChannel.get(asset.channel)
    if (!previous) return seeded

    if (previous.versionStatus === "approved" && previous.approvedPreview?.trim()) {
      return seedGeneratedAssetVersionMetadata({
        ...seeded,
        preview: previous.approvedPreview,
        generatedPreview: seeded.generatedPreview,
        operatorPreview: previous.operatorPreview ?? previous.approvedPreview,
        approvedPreview: previous.approvedPreview,
        versionStatus: "approved",
        editedAt: previous.editedAt ?? null,
        editedBy: previous.editedBy ?? null,
        approvedAt: previous.approvedAt ?? null,
        constitutionWarnings: previous.constitutionWarnings ?? [],
      })
    }

    if (previous.operatorPreview?.trim() && previous.versionStatus === "edited") {
      return seedGeneratedAssetVersionMetadata({
        ...seeded,
        preview: previous.operatorPreview,
        generatedPreview: seeded.generatedPreview,
        operatorPreview: previous.operatorPreview,
        versionStatus: "edited",
        editedAt: previous.editedAt ?? null,
        editedBy: previous.editedBy ?? null,
        constitutionWarnings: previous.constitutionWarnings ?? [],
      })
    }

    return seeded
  })
}

export function hasApprovedOperatorTransportAsset(
  pkg: GrowthAutonomousOutreachApprovalPackage | null | undefined,
  channel: CanonicalOutreachTransportChannel,
): boolean {
  const asset = findPackageAssetByChannel(pkg, mapTransportChannelToPackageChannel(channel))
  return Boolean(asset?.versionStatus === "approved" && asset.approvedPreview?.trim())
}
