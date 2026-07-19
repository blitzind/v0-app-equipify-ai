/**
 * GE-AIOS-END-TO-END-1C — Transport fidelity repair certification.
 * Run: pnpm test:ge-aios-transport-fidelity-1c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeTransportContentHash,
  computeTransportPackageFingerprint,
  normalizeTransportBodyText,
} from "../lib/growth/sequences/execution/growth-transport-authority-1c-hash"
import {
  GE_AIOS_TRANSPORT_AUTHORITY_1C_QA_MARKER,
  GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER,
  GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND_CONFIRM_ENV,
} from "../lib/growth/sequences/execution/growth-transport-authority-1c-types"
import {
  verifyTransportSnapshotAgainstPackage,
} from "../lib/growth/sequences/execution/growth-transport-snapshot-1c"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

const PHASE = "GE-AIOS-END-TO-END-1C" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function buildMockApprovedPackage(subject: string, body: string): GrowthAutonomousOutreachApprovalPackage {
  const approvedPreview = `Subject: ${subject}\n\n${body}`
  const approvedAt = "2026-07-19T01:45:41.039Z"
  return {
    packageId: "outreach-prep:test-lead:2026-07-16T00:00:00.000Z",
    leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3",
    companyName: "Block Imaging",
    preparedAt: approvedAt,
    generatedAssets: [
      {
        channel: "email",
        label: "Email",
        preview: approvedPreview,
        draftOnly: true,
        generatedPreview: approvedPreview,
        operatorPreview: approvedPreview,
        approvedPreview,
        versionStatus: "approved",
        approvedAt,
      },
    ],
    personalizationEvidence: [],
    supportingResearch: [],
    confidence: 0.9,
    approvalRequirements: [],
    complianceNotes: [],
    recommendedChannel: "email",
    recommendedSequence: "email_first_multichannel",
    expectedOutcome: "meeting",
    pendingHumanApproval: true,
    transportBlocked: true,
    packageApprovalDecision: "approved",
    approvedSenderAccountId: "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720",
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Transport fidelity repair certification`)

  assert.equal(GE_AIOS_TRANSPORT_AUTHORITY_1C_QA_MARKER, "ge-aios-transport-authority-1c-v1")
  assert.equal(GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER, "ge-aios-transport-snapshot-1c-v1")
  assert.equal(
    GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND_CONFIRM_ENV,
    "CONFIRM_GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND",
  )

  const liveSendProbe = readSource(
    "scripts/probe-ge-aios-end-to-end-supervised-sales-loop-live-send-1a.ts",
  )
  assert.match(liveSendProbe, /GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND_CONFIRM_ENV/)
  assert.match(liveSendProbe, /CONFIRM_GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND/)
  assert.doesNotMatch(liveSendProbe, /CONFIRM_GE_AIOS_END_TO_END_1A_LIVE_SEND/)

  const authority = readSource("lib/growth/sequences/execution/growth-transport-authority-1c.ts")
  assert.match(authority, /export async function resolveTransportAuthority/)
  assert.match(authority, /source: "frozen_snapshot"/)
  assert.match(authority, /resolveLegacyGenerationTransportAuthority/)

  const sendBuilder = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
  assert.match(sendBuilder, /resolveTransportAuthority/)
  assert.doesNotMatch(sendBuilder, /fetchGrowthAiCopilotGenerationById/)

  const jobBind = readSource("lib/growth/sequences/execution/growth-transport-authority-job-bind-1c.ts")
  assert.match(jobBind, /bindSupervisedTransportSnapshotToJob/)
  assert.match(jobBind, /verifySupervisedJobTransportApprovalFidelity/)

  const queue = readSource("lib/growth/sequences/execution/queue-sequence-step-transport-job.ts")
  assert.match(queue, /bindSupervisedTransportSnapshotToJob/)
  assert.match(queue, /resolveSupervisedApprovedSenderAccountId/)

  const solo = readSource("lib/growth/sequences/execution/approve-sequence-execution-solo.ts")
  assert.match(solo, /verifySupervisedJobTransportApprovalFidelity/)
  assert.match(solo, /supervisedTransportBound/)

  const runner = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
  assert.match(runner, /verifySupervisedJobTransportApprovalFidelity/)
  assert.match(runner, /transport_authority_source/)

  const copyRepair = readSource("lib/growth/training/end-to-end-supervised-sales-loop-copy-repair-1a.ts")
  assert.match(copyRepair, /refreshSupervisedTransportSnapshotForJob/)

  const migration = readSource(
    "supabase/migrations/20270719153000_growth_sequence_execution_transport_authority_1c.sql",
  )
  assert.match(migration, /outreach_package_id/)
  assert.match(migration, /transport_snapshot/)

  const identityMigration = readSource(
    "supabase/migrations/20270719163000_growth_sequence_execution_transport_snapshot_identity_1c.sql",
  )
  assert.match(identityMigration, /transport_snapshot_id/)

  const subject = "Block Imaging service operations"
  const body = "Hi Josh,\n\nApproved body copy."
  const pkg = buildMockApprovedPackage(subject, body)
  const fingerprint = computeTransportPackageFingerprint({
    packageId: pkg.packageId,
    channel: "email",
    approvedAt: "2026-07-19T01:45:41.039Z",
    approvedPreview: pkg.generatedAssets[0]?.approvedPreview ?? null,
  })
  const senderAccountId = "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720"
  const contentHash = computeTransportContentHash({
    subject,
    bodyText: body,
    senderAccountId,
    packageFingerprint: fingerprint,
  })

  const snapshot = {
    qaMarker: GE_AIOS_TRANSPORT_SNAPSHOT_1C_QA_MARKER,
    transportSnapshotId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    outreachPackageId: pkg.packageId,
    channel: "email" as const,
    subject,
    bodyText: body,
    senderAccountId,
    senderDisplayName: "Ava Sinclair",
    senderEmail: "ava@equipifyai.com",
    replyTo: null,
    packageFingerprint: fingerprint,
    contentHash,
    packageApprovedAt: "2026-07-19T01:45:41.039Z",
    frozenAt: "2026-07-19T01:45:41.039Z",
    source: "approved_operator" as const,
  }

  const match = verifyTransportSnapshotAgainstPackage({
    snapshot,
    pkg,
    senderAccountId,
  })
  assert.equal(match.ok, true, match.message)

  const stalePackage = buildMockApprovedPackage("Stale subject", body)
  const stale = verifyTransportSnapshotAgainstPackage({
    snapshot,
    pkg: stalePackage,
    senderAccountId,
  })
  assert.equal(stale.ok, false)
  assert.equal(stale.code, "package_fingerprint_mismatch")

  const changedHash = computeTransportContentHash({
    subject: "Block Imaging imaging service ops",
    bodyText: body,
    senderAccountId,
    packageFingerprint: fingerprint,
  })
  assert.notEqual(changedHash, contentHash)
  assert.equal(normalizeTransportBodyText("a\r\nb"), "a\nb")

  console.log(`[${PHASE}] PASS — transport authority wired; supervised snapshot verified`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
