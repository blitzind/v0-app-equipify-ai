/**
 * GE-AIOS-END-TO-END-1C.1 — Transport replay certification.
 * Run: pnpm test:ge-aios-transport-fidelity-1c-replay
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeTransportContentHash,
  computeTransportPackageFingerprint,
  generateTransportSnapshotId,
  normalizeTransportBodyText,
} from "../lib/growth/sequences/execution/growth-transport-authority-1c-hash"
import {
  GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER,
  GE_AIOS_TRANSPORT_SNAPSHOT_IDENTITY_1C_QA_MARKER,
} from "../lib/growth/sequences/execution/growth-transport-authority-1c-types"
import {
  buildTransportLineageMetadataFromAttempt,
  resolveReplayTransportPayloadFromAttemptMetadata,
} from "../lib/growth/sequences/execution/growth-transport-snapshot-audit-1c"
import { parseTransportSnapshot1C } from "../lib/growth/sequences/execution/growth-transport-snapshot-1c"

const PHASE = "GE-AIOS-END-TO-END-1C.1-REPLAY" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Transport replay certification`)

  assert.equal(GE_AIOS_TRANSPORT_SNAPSHOT_IDENTITY_1C_QA_MARKER, "ge-aios-transport-snapshot-identity-1c-v1")

  const migration = readSource(
    "supabase/migrations/20270719163000_growth_sequence_execution_transport_snapshot_identity_1c.sql",
  )
  assert.match(migration, /transport_snapshot_id/)
  assert.match(migration, /sequence_execution_jobs/)
  assert.match(migration, /delivery_attempts/)

  const authority = readSource("lib/growth/sequences/execution/growth-transport-authority-1c.ts")
  assert.match(authority, /!job\.transportSnapshotId/)
  assert.match(authority, /source: "frozen_snapshot"/)

  const jobBind = readSource("lib/growth/sequences/execution/growth-transport-authority-job-bind-1c.ts")
  assert.match(jobBind, /transportSnapshotId: snapshot\.transportSnapshotId/)
  assert.match(jobBind, /job\.transportSnapshot && job\.transportSnapshotId/)

  const orchestrator = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
  assert.match(orchestrator, /buildTransportLineageMetadataFromAttempt/)
  assert.match(orchestrator, /retryScheduledDeliveryAttempt/)

  const repository = readSource("lib/growth/providers/transport/transport-repository.ts")
  assert.match(repository, /transport_snapshot_id/)

  const snapshotBuilder = readSource("lib/growth/sequences/execution/growth-transport-snapshot-1c.ts")
  assert.match(snapshotBuilder, /generateTransportSnapshotId/)
  assert.match(snapshotBuilder, /if \(!transportSnapshotId\) return null/)

  const snapshotId = generateTransportSnapshotId()
  const snapshotId2 = generateTransportSnapshotId()
  assert.notEqual(snapshotId, snapshotId2)

  const subject = "Block Imaging service operations"
  const body = "Hi Josh,\n\nApproved body copy."
  const senderAccountId = "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720"
  const packageId = "outreach-prep:test-lead:2026-07-16T00:00:00.000Z"
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

  const snapshot = {
    qaMarker: GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER,
    transportSnapshotId: snapshotId,
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

  const parsed = parseTransportSnapshot1C(snapshot)
  assert.ok(parsed)
  assert.equal(parsed?.transportSnapshotId, snapshotId)

  const staleSnapshot = { ...snapshot, transportSnapshotId: "" }
  assert.equal(parseTransportSnapshot1C(staleSnapshot), null)

  const html = `<p>${body.replace(/\n/g, "<br/>")}</p>`
  const firstAttemptMetadata = {
    to: "josh.block@blockimaging.com",
    subject,
    html,
    text: body,
    transport_snapshot_id: snapshotId,
    transport_content_hash: contentHash,
    package_fingerprint: packageFingerprint,
    outreach_package_id: packageId,
    transport_authority_source: "frozen_snapshot",
    sequence_execution_job_id: "44b1f1f1-d5b9-4ff9-8aee-61e4ef3207ae",
  }

  const firstPayload = resolveReplayTransportPayloadFromAttemptMetadata(firstAttemptMetadata)
  assert.equal(firstPayload.subject, subject)
  assert.equal(normalizeTransportBodyText(firstPayload.text), normalizeTransportBodyText(body))
  assert.equal(firstPayload.transportSnapshotId, snapshotId)
  assert.equal(firstPayload.contentHash, contentHash)
  assert.equal(firstPayload.packageFingerprint, packageFingerprint)

  const lineage = buildTransportLineageMetadataFromAttempt({
    id: "f77426fc-5a87-4a57-9c71-aa08c6d037ed",
    transport_snapshot_id: snapshotId,
    metadata: firstAttemptMetadata,
  })
  assert.equal(lineage.transport_snapshot_id, snapshotId)
  assert.equal(lineage.transport_content_hash, contentHash)
  assert.equal(lineage.package_fingerprint, packageFingerprint)
  assert.equal(lineage.replay_of_attempt_id, "f77426fc-5a87-4a57-9c71-aa08c6d037ed")

  const retryMetadata = {
    ...firstAttemptMetadata,
    ...lineage,
    retry_count: 1,
  }
  const retryPayload = resolveReplayTransportPayloadFromAttemptMetadata(retryMetadata)

  assert.equal(retryPayload.subject, firstPayload.subject)
  assert.equal(retryPayload.html, firstPayload.html)
  assert.equal(retryPayload.text, firstPayload.text)
  assert.equal(retryPayload.to, firstPayload.to)
  assert.equal(retryPayload.transportSnapshotId, firstPayload.transportSnapshotId)
  assert.equal(retryPayload.contentHash, firstPayload.contentHash)
  assert.equal(retryPayload.packageFingerprint, firstPayload.packageFingerprint)

  const retryMessage = {
    to: retryMetadata.to as string,
    subject: retryMetadata.subject as string,
    html: retryMetadata.html as string,
    text: retryMetadata.text as string,
  }
  assert.equal(retryMessage.subject, firstPayload.subject)
  assert.equal(retryMessage.text, firstPayload.text)
  assert.equal(retryMessage.html, firstPayload.html)

  const divergentLineage = buildTransportLineageMetadataFromAttempt({
    id: "f77426fc-5a87-4a57-9c71-aa08c6d037ed",
    transport_snapshot_id: snapshotId,
    metadata: {
      ...firstAttemptMetadata,
      package_revision_hint: "post-approval-revision-would-not-rewrite-attempt-metadata",
    },
  })
  assert.equal(divergentLineage.transport_snapshot_id, snapshotId)
  assert.equal(divergentLineage.package_fingerprint, packageFingerprint)
  assert.equal(divergentLineage.transport_content_hash, contentHash)

  console.log(`[${PHASE}] PASS — replay uses immutable snapshot identity and frozen attempt metadata`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
