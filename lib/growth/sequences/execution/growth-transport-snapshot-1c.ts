/** GE-AIOS-END-TO-END-1C — Build and verify immutable supervised transport snapshots (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { findOutreachPreparationRunByPackageId } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-repository"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  prepareOperatorApprovedTransportBody,
  resolveTransportAssetFromPackage,
} from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { resolveOutboundSignatureForSender } from "@/lib/growth/signatures/signature-resolver"
import {
  computeTransportContentHash,
  computeTransportPackageFingerprint,
  generateTransportSnapshotId,
  normalizeTransportBodyText,
} from "@/lib/growth/sequences/execution/growth-transport-authority-1c-hash"
import {
  GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER,
  type GrowthTransportFidelityVerification1C,
  type GrowthTransportSnapshot1C,
} from "@/lib/growth/sequences/execution/growth-transport-authority-1c-types"
import { resolveSupervisedApprovedSenderAccountId } from "@/lib/growth/sequences/execution/growth-supervised-sender-resolution-1c"

export function resolvePackageEmailAsset(
  pkg: GrowthAutonomousOutreachApprovalPackage | null | undefined,
) {
  return pkg?.generatedAssets.find((asset) => asset.channel === "email") ?? null
}

export function computePackageEmailFingerprint(
  pkg: GrowthAutonomousOutreachApprovalPackage,
): string {
  const emailAsset = resolvePackageEmailAsset(pkg)
  return computeTransportPackageFingerprint({
    packageId: pkg.packageId,
    channel: "email",
    approvedAt: emailAsset?.approvedAt ?? null,
    approvedPreview: emailAsset?.approvedPreview ?? emailAsset?.preview ?? null,
  })
}

export async function buildTransportSnapshotFromPackage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    pkg: GrowthAutonomousOutreachApprovalPackage
    senderAccountId: string
    frozenAt?: string
    transportSnapshotId?: string
    sequencePatternStepId?: string | null
    sequencePatternId?: string | null
  },
): Promise<GrowthTransportSnapshot1C | { error: string }> {
  const asset = resolveTransportAssetFromPackage(
    input.pkg,
    "email",
    input.pkg.companyName ?? "",
  )
  if (!asset?.subject?.trim() || !asset.body?.trim()) {
    return { error: "approved_transport_asset_missing" }
  }
  if (asset.versionStatus !== "approved" && asset.source !== "approved_operator") {
    return { error: "approved_transport_asset_not_frozen" }
  }

  const sender = await getSenderAccount(admin, input.senderAccountId)
  if (!sender || (sender.status !== "connected" && sender.status !== "warming")) {
    return { error: "approved_sender_unavailable" }
  }

  const signature = await resolveOutboundSignatureForSender(admin, {
    senderAccountId: input.senderAccountId,
  })

  const subject = asset.subject.trim()
  const bodyText = prepareOperatorApprovedTransportBody(asset.body)
  const packageFingerprint = computePackageEmailFingerprint(input.pkg)
  const contentHash = computeTransportContentHash({
    subject,
    bodyText,
    senderAccountId: input.senderAccountId,
    packageFingerprint,
  })

  const emailAsset = resolvePackageEmailAsset(input.pkg)
  const packageApprovedAt = emailAsset?.approvedAt ?? null

  return {
    qaMarker: GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER,
    transportSnapshotId: input.transportSnapshotId ?? generateTransportSnapshotId(),
    outreachPackageId: input.pkg.packageId,
    channel: "email",
    subject,
    bodyText,
    senderAccountId: input.senderAccountId,
    senderDisplayName: signature.displayName || sender.display_name || null,
    senderEmail: signature.mergeFields["sender.email"] || sender.email_address || null,
    replyTo: null,
    packageFingerprint,
    contentHash,
    packageApprovedAt,
    frozenAt: input.frozenAt ?? new Date().toISOString(),
    source: "approved_operator",
  }
}

export async function loadApprovedPackageForSnapshot(
  admin: SupabaseClient,
  input: { organizationId: string; packageId: string; leadId?: string | null },
): Promise<GrowthAutonomousOutreachApprovalPackage | null> {
  const run = await findOutreachPreparationRunByPackageId(admin, {
    organizationId: input.organizationId,
    packageId: input.packageId,
  })
  const pkg = run?.approvalPackage ?? null
  if (!pkg) return null
  if (input.leadId && pkg.leadId !== input.leadId) return null
  if (pkg.packageApprovalDecision !== "approved") return null
  return pkg
}

export async function buildTransportSnapshotForSupervisedPackage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    packageId: string
    leadId: string
    explicitSenderAccountId?: string | null
    sequencePatternStepId?: string | null
    sequencePatternId?: string | null
    frozenAt?: string
  },
): Promise<GrowthTransportSnapshot1C | { error: string }> {
  const pkg = await loadApprovedPackageForSnapshot(admin, {
    organizationId: input.organizationId,
    packageId: input.packageId,
    leadId: input.leadId,
  })
  if (!pkg) return { error: "approved_package_not_found" }

  const senderAccountId = await resolveSupervisedApprovedSenderAccountId(admin, {
    organizationId: input.organizationId,
    package: pkg,
    explicitSenderAccountId: input.explicitSenderAccountId ?? pkg.approvedSenderAccountId ?? null,
    sequencePatternStepId: input.sequencePatternStepId,
    sequencePatternId: input.sequencePatternId,
  })
  if (!senderAccountId) return { error: "approved_sender_not_resolved" }

  return buildTransportSnapshotFromPackage(admin, {
    organizationId: input.organizationId,
    pkg,
    senderAccountId,
    frozenAt: input.frozenAt,
    sequencePatternStepId: input.sequencePatternStepId,
    sequencePatternId: input.sequencePatternId,
  })
}

export function verifyTransportSnapshotAgainstPackage(input: {
  snapshot: GrowthTransportSnapshot1C
  pkg: GrowthAutonomousOutreachApprovalPackage
  senderAccountId: string
}): GrowthTransportFidelityVerification1C {
  const asset = resolveTransportAssetFromPackage(
    input.pkg,
    "email",
    input.pkg.companyName ?? "",
  )
  if (!asset?.subject?.trim() || !asset.body?.trim()) {
    return {
      ok: false,
      code: "missing_package",
      message: "Approved package email asset is missing.",
      packageFingerprint: null,
      snapshotFingerprint: input.snapshot.packageFingerprint,
      packageContentHash: null,
      snapshotContentHash: input.snapshot.contentHash,
    }
  }

  const packageFingerprint = computePackageEmailFingerprint(input.pkg)
  if (packageFingerprint !== input.snapshot.packageFingerprint) {
    return {
      ok: false,
      code: "package_fingerprint_mismatch",
      message: "Approved package fingerprint does not match the bound transport snapshot.",
      packageFingerprint,
      snapshotFingerprint: input.snapshot.packageFingerprint,
      packageContentHash: null,
      snapshotContentHash: input.snapshot.contentHash,
    }
  }

  const subject = asset.subject.trim()
  const bodyText = prepareOperatorApprovedTransportBody(asset.body)
  const packageContentHash = computeTransportContentHash({
    subject,
    bodyText,
    senderAccountId: input.senderAccountId,
    packageFingerprint,
  })

  if (packageContentHash !== input.snapshot.contentHash) {
    return {
      ok: false,
      code: "content_hash_mismatch",
      message: "Approved package content hash does not match the bound transport snapshot.",
      packageFingerprint,
      snapshotFingerprint: input.snapshot.packageFingerprint,
      packageContentHash,
      snapshotContentHash: input.snapshot.contentHash,
    }
  }

  if (input.senderAccountId !== input.snapshot.senderAccountId) {
    return {
      ok: false,
      code: "sender_mismatch",
      message: "Approved sender account does not match the bound transport snapshot.",
      packageFingerprint,
      snapshotFingerprint: input.snapshot.packageFingerprint,
      packageContentHash,
      snapshotContentHash: input.snapshot.contentHash,
    }
  }

  if (
    normalizeTransportBodyText(subject) !== normalizeTransportBodyText(input.snapshot.subject) ||
    normalizeTransportBodyText(bodyText) !== normalizeTransportBodyText(input.snapshot.bodyText)
  ) {
    return {
      ok: false,
      code: "content_hash_mismatch",
      message: "Approved package copy does not match the bound transport snapshot.",
      packageFingerprint,
      snapshotFingerprint: input.snapshot.packageFingerprint,
      packageContentHash,
      snapshotContentHash: input.snapshot.contentHash,
    }
  }

  return {
    ok: true,
    code: "ok",
    message: "Transport snapshot matches approved package.",
    packageFingerprint,
    snapshotFingerprint: input.snapshot.packageFingerprint,
    packageContentHash,
    snapshotContentHash: input.snapshot.contentHash,
  }
}

export function parseTransportSnapshot1C(value: unknown): GrowthTransportSnapshot1C | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (row.qaMarker !== GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER) return null
  if (typeof row.outreachPackageId !== "string") return null
  if (typeof row.subject !== "string") return null
  if (typeof row.bodyText !== "string") return null
  if (typeof row.senderAccountId !== "string") return null
  if (typeof row.packageFingerprint !== "string") return null
  if (typeof row.contentHash !== "string") return null
  const transportSnapshotId =
    typeof row.transportSnapshotId === "string" && row.transportSnapshotId.trim()
      ? row.transportSnapshotId.trim()
      : null
  if (!transportSnapshotId) return null
  return {
    ...(row as GrowthTransportSnapshot1C),
    transportSnapshotId,
    packageApprovedAt:
      typeof row.packageApprovedAt === "string" ? row.packageApprovedAt : null,
  }
}
