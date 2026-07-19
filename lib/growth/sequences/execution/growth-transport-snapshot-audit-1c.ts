/** GE-AIOS-END-TO-END-1C.1 — Deterministic transport audit chain resolution (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { findOutreachPreparationRunByPackageId } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-repository"
import { fetchAvaOutreachExecutionRequestByPackageId } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-service"
import { getDeliveryAttempt } from "@/lib/growth/providers/transport/transport-repository"
import { getSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import {
  GE_AIOS_TRANSPORT_SNAPSHOT_IDENTITY_1C_QA_MARKER,
  type GrowthTransportAuditChain1C,
} from "@/lib/growth/sequences/execution/growth-transport-authority-1c-types"
import { parseTransportSnapshot1C } from "@/lib/growth/sequences/execution/growth-transport-snapshot-1c"

function readSnapshotIdFromAttemptMetadata(metadata: Record<string, unknown>): string | null {
  const direct = metadata.transport_snapshot_id ?? metadata.transportSnapshotId
  return typeof direct === "string" && direct.trim() ? direct.trim() : null
}

export async function resolveTransportAuditChainFromDeliveryAttemptId(
  admin: SupabaseClient,
  input: {
    deliveryAttemptId: string
    organizationId: string
  },
): Promise<GrowthTransportAuditChain1C | null> {
  const attempt = await getDeliveryAttempt(admin, input.deliveryAttemptId)
  if (!attempt) return null
  return resolveTransportAuditChainFromDeliveryAttempt(admin, {
    attempt,
    organizationId: input.organizationId,
  })
}

export async function resolveTransportAuditChainFromProviderMessageId(
  admin: SupabaseClient,
  input: {
    providerMessageId: string
    organizationId: string
  },
): Promise<GrowthTransportAuditChain1C | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("*")
    .eq("provider_message_id", input.providerMessageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const attempt = await getDeliveryAttempt(admin, String(data.id))
  if (!attempt) return null

  return resolveTransportAuditChainFromDeliveryAttempt(admin, {
    attempt,
    organizationId: input.organizationId,
  })
}

async function resolveTransportAuditChainFromDeliveryAttempt(
  admin: SupabaseClient,
  input: {
    attempt: NonNullable<Awaited<ReturnType<typeof getDeliveryAttempt>>>
    organizationId: string
  },
): Promise<GrowthTransportAuditChain1C | null> {
  const metadata = input.attempt.metadata ?? {}
  const jobId =
    typeof metadata.sequence_execution_job_id === "string"
      ? metadata.sequence_execution_job_id
      : null
  const job = jobId ? await getSequenceExecutionJob(admin, jobId) : null
  const snapshot = parseTransportSnapshot1C(job?.transportSnapshot ?? null)

  const transportSnapshotId =
    input.attempt.transport_snapshot_id ??
    readSnapshotIdFromAttemptMetadata(metadata) ??
    job?.transportSnapshotId ??
    snapshot?.transportSnapshotId ??
    null
  const outreachPackageId =
    (typeof metadata.outreach_package_id === "string" ? metadata.outreach_package_id : null) ??
    job?.outreachPackageId ??
    snapshot?.outreachPackageId ??
    null

  if (!transportSnapshotId || !outreachPackageId) return null

  const packageRun = await findOutreachPreparationRunByPackageId(admin, {
    organizationId: input.organizationId,
    packageId: outreachPackageId,
  })
  const pkg = packageRun?.approvalPackage ?? null
  const executionRequest =
    pkg?.leadId != null
      ? await fetchAvaOutreachExecutionRequestByPackageId(admin, {
          leadId: pkg.leadId,
          packageId: outreachPackageId,
        })
      : null

  return {
    qaMarker: GE_AIOS_TRANSPORT_SNAPSHOT_IDENTITY_1C_QA_MARKER,
    providerMessageId: input.attempt.provider_message_id,
    deliveryAttemptId: input.attempt.id,
    transportSnapshotId,
    sequenceExecutionJobId: jobId,
    outreachPackageId,
    packageFingerprint:
      (typeof metadata.package_fingerprint === "string" ? metadata.package_fingerprint : null) ??
      job?.packageFingerprint ??
      snapshot?.packageFingerprint ??
      "",
    contentHash:
      (typeof metadata.transport_content_hash === "string" ? metadata.transport_content_hash : null) ??
      job?.transportContentHash ??
      snapshot?.contentHash ??
      "",
    packageApprovedAt: snapshot?.packageApprovedAt ?? null,
    senderAccountId: input.attempt.sender_account_id ?? snapshot?.senderAccountId ?? "",
    operatorApprovalDecision: pkg?.packageApprovalDecision ?? null,
    executionRequestId: executionRequest?.requestId ?? pkg?.executionRequestId ?? null,
    operatorApprovedAt: executionRequest?.approvedAt ?? snapshot?.packageApprovedAt ?? null,
  }
}

/** Replay-safe transport lineage fields carried through retries and provider delivery. */
export function buildTransportLineageMetadataFromAttempt(
  attempt: {
    id: string
    transport_snapshot_id?: string | null
    metadata?: Record<string, unknown>
  },
): Record<string, unknown> {
  const metadata = attempt.metadata ?? {}
  const transportSnapshotId =
    attempt.transport_snapshot_id ??
    (typeof metadata.transport_snapshot_id === "string" ? metadata.transport_snapshot_id : null) ??
    (typeof metadata.transportSnapshotId === "string" ? metadata.transportSnapshotId : null)

  return {
    transport_snapshot_id: transportSnapshotId,
    transport_content_hash:
      typeof metadata.transport_content_hash === "string" ? metadata.transport_content_hash : null,
    package_fingerprint:
      typeof metadata.package_fingerprint === "string" ? metadata.package_fingerprint : null,
    outreach_package_id:
      typeof metadata.outreach_package_id === "string" ? metadata.outreach_package_id : null,
    transport_authority_source:
      typeof metadata.transport_authority_source === "string"
        ? metadata.transport_authority_source
        : null,
    sequence_execution_job_id:
      typeof metadata.sequence_execution_job_id === "string"
        ? metadata.sequence_execution_job_id
        : null,
    replay_of_attempt_id: attempt.id,
  }
}

/** Replay-safe payload extraction — uses frozen attempt metadata, never rebuilds from package. */
export function resolveReplayTransportPayloadFromAttemptMetadata(
  metadata: Record<string, unknown>,
): {
  subject: string
  html: string
  text: string
  to: string
  transportSnapshotId: string | null
  contentHash: string | null
  packageFingerprint: string | null
} {
  return {
    subject: typeof metadata.subject === "string" ? metadata.subject : "",
    html: typeof metadata.html === "string" ? metadata.html : "",
    text: typeof metadata.text === "string" ? metadata.text : "",
    to: typeof metadata.to === "string" ? metadata.to : "",
    transportSnapshotId: readSnapshotIdFromAttemptMetadata(metadata),
    contentHash:
      typeof metadata.transport_content_hash === "string" ? metadata.transport_content_hash : null,
    packageFingerprint:
      typeof metadata.package_fingerprint === "string" ? metadata.package_fingerprint : null,
  }
}
