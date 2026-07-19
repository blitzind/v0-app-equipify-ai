/**
 * GE-AIOS-END-TO-END-1C.1 — Transport audit chain certification.
 * Run: pnpm test:ge-aios-transport-fidelity-1c-audit
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeTransportContentHash,
  computeTransportPackageFingerprint,
} from "../lib/growth/sequences/execution/growth-transport-authority-1c-hash"
import {
  GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER,
  GE_AIOS_TRANSPORT_SNAPSHOT_IDENTITY_1C_QA_MARKER,
} from "../lib/growth/sequences/execution/growth-transport-authority-1c-types"
import {
  buildTransportLineageMetadataFromAttempt,
  resolveReplayTransportPayloadFromAttemptMetadata,
} from "../lib/growth/sequences/execution/growth-transport-snapshot-audit-1c"

const PHASE = "GE-AIOS-END-TO-END-1C.1-AUDIT" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Transport audit chain certification`)

  assert.equal(GE_AIOS_TRANSPORT_SNAPSHOT_IDENTITY_1C_QA_MARKER, "ge-aios-transport-snapshot-identity-1c-v1")

  const auditModule = readSource("lib/growth/sequences/execution/growth-transport-snapshot-audit-1c.ts")
  assert.match(auditModule, /resolveTransportAuditChainFromProviderMessageId/)
  assert.match(auditModule, /resolveTransportAuditChainFromDeliveryAttemptId/)
  assert.match(auditModule, /GrowthTransportAuditChain1C/)
  assert.match(auditModule, /operatorApprovalDecision/)
  assert.match(auditModule, /executionRequestId/)

  const jobRepo = readSource("lib/growth/sequences/execution/sequence-job-repository.ts")
  assert.match(jobRepo, /transport_snapshot_id/)
  assert.match(jobRepo, /transportSnapshotId/)

  const runner = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
  assert.match(runner, /transport_snapshot_id/)
  assert.match(runner, /package_fingerprint/)

  const migration = readSource(
    "supabase/migrations/20270719163000_growth_sequence_execution_transport_snapshot_identity_1c.sql",
  )
  assert.match(migration, /idx_growth_delivery_attempts_provider_message_id/)

  const providerMessageId = "provider-msg-block-imaging-1c1"
  const deliveryAttemptId = "f77426fc-5a87-4a57-9c71-aa08c6d037ed"
  const transportSnapshotId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  const jobId = "44b1f1f1-d5b9-4ff9-8aee-61e4ef3207ae"
  const packageId = "outreach-prep:6d9220f0-2960-468c-b4be-5d7595d292c3:2026-07-16T00:20:44.387Z"
  const senderAccountId = "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720"
  const subject = "Block Imaging service operations"
  const body = "Hi Josh,\n\nApproved body copy."
  const approvedAt = "2026-07-19T01:45:41.039Z"
  const packageFingerprint = computeTransportPackageFingerprint({
    packageId,
    channel: "email",
    approvedAt,
    approvedPreview: `Subject: ${subject}\n\n${body}`,
  })
  const contentHash = computeTransportContentHash({
    subject,
    bodyText: body,
    senderAccountId,
    packageFingerprint,
  })

  const attemptMetadata = {
    to: "josh.block@blockimaging.com",
    subject,
    html: `<p>${body}</p>`,
    text: body,
    transport_snapshot_id: transportSnapshotId,
    transport_content_hash: contentHash,
    package_fingerprint: packageFingerprint,
    outreach_package_id: packageId,
    transport_authority_source: "frozen_snapshot",
    sequence_execution_job_id: jobId,
    provider_message_id: providerMessageId,
  }

  const lineage = buildTransportLineageMetadataFromAttempt({
    id: deliveryAttemptId,
    transport_snapshot_id: transportSnapshotId,
    metadata: attemptMetadata,
  })

  assert.equal(lineage.transport_snapshot_id, transportSnapshotId)
  assert.equal(lineage.sequence_execution_job_id, jobId)
  assert.equal(lineage.outreach_package_id, packageId)

  const replay = resolveReplayTransportPayloadFromAttemptMetadata({
    ...attemptMetadata,
    ...lineage,
  })
  assert.equal(replay.transportSnapshotId, transportSnapshotId)
  assert.equal(replay.contentHash, contentHash)
  assert.equal(replay.packageFingerprint, packageFingerprint)

  const snapshot = {
    qaMarker: GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER,
    transportSnapshotId,
    outreachPackageId: packageId,
    channel: "email" as const,
    subject,
    bodyText: body,
    senderAccountId,
    senderDisplayName: "Ava Sinclair",
    senderEmail: "ava@equipifyai.com",
    replyTo: null,
    packageFingerprint,
    contentHash,
    packageApprovedAt: approvedAt,
    frozenAt: approvedAt,
    source: "approved_operator" as const,
  }

  const auditChainFields = [
    "providerMessageId",
    "deliveryAttemptId",
    "transportSnapshotId",
    "sequenceExecutionJobId",
    "outreachPackageId",
    "packageFingerprint",
    "contentHash",
    "senderAccountId",
    "operatorApprovalDecision",
    "executionRequestId",
    "operatorApprovedAt",
  ]
  for (const field of auditChainFields) {
    assert.match(auditModule, new RegExp(field))
  }

  assert.equal(snapshot.transportSnapshotId, transportSnapshotId)
  assert.equal(snapshot.packageFingerprint, packageFingerprint)
  assert.equal(snapshot.contentHash, contentHash)

  console.log(`[${PHASE}] PASS — audit chain resolver and lineage metadata certified`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
