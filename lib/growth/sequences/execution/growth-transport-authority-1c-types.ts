/** GE-AIOS-END-TO-END-1C — Transport authority contract (client-safe). */

export const GE_AIOS_TRANSPORT_AUTHORITY_1C_QA_MARKER =
  "ge-aios-transport-authority-1c-v1" as const

export const GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER =
  "ge-aios-transport-snapshot-1c-v1" as const

export const GE_AIOS_TRANSPORT_SNAPSHOT_IDENTITY_1C_QA_MARKER =
  "ge-aios-transport-snapshot-identity-1c-v1" as const

/** Required env gate for Production transport fidelity live-send certification only. */
export const GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND_CONFIRM_ENV =
  "CONFIRM_GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND" as const

export const GROWTH_TRANSPORT_AUTHORITY_SOURCES = [
  "frozen_snapshot",
  "legacy_generation",
] as const

export type GrowthTransportAuthoritySource = (typeof GROWTH_TRANSPORT_AUTHORITY_SOURCES)[number]

/** Immutable transport contract bound at supervised job queue / copy repair. */
export type GrowthTransportSnapshot1C = {
  qaMarker: typeof GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER
  /** Permanent immutable identity — generated once, never mutated or reused across revisions. */
  transportSnapshotId: string
  outreachPackageId: string
  channel: "email"
  subject: string
  bodyText: string
  senderAccountId: string
  senderDisplayName: string | null
  senderEmail: string | null
  replyTo: string | null
  packageFingerprint: string
  contentHash: string
  packageApprovedAt: string | null
  frozenAt: string
  source: "approved_operator"
}

export type GrowthTransportAuthority1C = {
  qaMarker: typeof GE_AIOS_TRANSPORT_AUTHORITY_1C_QA_MARKER
  source: GrowthTransportAuthoritySource
  subject: string
  bodyText: string
  senderAccountId: string
  senderDisplayName: string | null
  senderEmail: string | null
  replyTo: string | null
  outreachPackageId: string | null
  packageFingerprint: string | null
  contentHash: string
  allowAutoRotation: boolean
  manualSenderAccountId: string | null
  snapshot: GrowthTransportSnapshot1C | null
  transportSnapshotId: string | null
}

/** Deterministic audit chain from provider delivery back to operator approval. */
export type GrowthTransportAuditChain1C = {
  qaMarker: typeof GE_AIOS_TRANSPORT_SNAPSHOT_IDENTITY_1C_QA_MARKER
  providerMessageId: string | null
  deliveryAttemptId: string
  transportSnapshotId: string
  sequenceExecutionJobId: string | null
  outreachPackageId: string
  packageFingerprint: string
  contentHash: string
  packageApprovedAt: string | null
  senderAccountId: string
  operatorApprovalDecision: "approved" | "rejected" | null
  executionRequestId: string | null
  operatorApprovedAt: string | null
}

export type GrowthTransportFidelityVerification1C = {
  ok: boolean
  code:
    | "ok"
    | "missing_snapshot"
    | "missing_package"
    | "package_fingerprint_mismatch"
    | "content_hash_mismatch"
    | "sender_mismatch"
  message: string
  packageFingerprint: string | null
  snapshotFingerprint: string | null
  packageContentHash: string | null
  snapshotContentHash: string | null
}
