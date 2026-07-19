/** GE-AIOS-END-TO-END-1C — Pure transport fingerprint/hash helpers (client-safe). */

import { createHash, randomUUID } from "crypto"

export function generateTransportSnapshotId(): string {
  return randomUUID()
}

export function normalizeTransportBodyText(text: string | null | undefined): string {
  return (text ?? "").replace(/\r\n/g, "\n").trim()
}

export function computeTransportPackageFingerprint(input: {
  packageId: string
  channel: string
  approvedAt: string | null | undefined
  approvedPreview: string | null | undefined
}): string {
  const previewHash = createHash("sha256")
    .update(normalizeTransportBodyText(input.approvedPreview))
    .digest("hex")
    .slice(0, 16)
  return `${input.packageId}:${input.channel}:${input.approvedAt ?? "unapproved"}:${previewHash}`
}

export function computeTransportContentHash(input: {
  subject: string
  bodyText: string
  senderAccountId: string
  packageFingerprint: string
}): string {
  const normalized = [
    normalizeTransportBodyText(input.subject),
    normalizeTransportBodyText(input.bodyText),
    input.senderAccountId.trim(),
    input.packageFingerprint.trim(),
  ].join("\u001f")
  return createHash("sha256").update(normalized).digest("hex")
}
