/** GE-AIOS-END-TO-END-1C — Bind supervised transport snapshots to execution jobs (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { fetchAvaOutreachExecutionRequestsForLead } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-service"
import {
  getSequenceExecutionJob,
  updateSequenceExecutionJob,
} from "@/lib/growth/sequences/execution/sequence-job-repository"
import { GE_AIOS_TRANSPORT_AUTHORITY_1C_QA_MARKER } from "@/lib/growth/sequences/execution/growth-transport-authority-1c-types"
import {
  buildTransportSnapshotForSupervisedPackage,
  loadApprovedPackageForSnapshot,
  parseTransportSnapshot1C,
  verifyTransportSnapshotAgainstPackage,
} from "@/lib/growth/sequences/execution/growth-transport-snapshot-1c"
import type { GrowthTransportFidelityVerification1C } from "@/lib/growth/sequences/execution/growth-transport-authority-1c-types"

export async function bindSupervisedTransportSnapshotToJob(
  admin: SupabaseClient,
  input: {
    jobId: string
    organizationId: string
    packageId: string
    leadId: string
    sequencePatternStepId?: string | null
    sequencePatternId?: string | null
    explicitSenderAccountId?: string | null
    frozenAt?: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const snapshot = await buildTransportSnapshotForSupervisedPackage(admin, {
    organizationId: input.organizationId,
    packageId: input.packageId,
    leadId: input.leadId,
    explicitSenderAccountId: input.explicitSenderAccountId ?? null,
    sequencePatternStepId: input.sequencePatternStepId,
    sequencePatternId: input.sequencePatternId,
    frozenAt: input.frozenAt,
  })
  if ("error" in snapshot) {
    return { ok: false, error: snapshot.error }
  }

  await updateSequenceExecutionJob(admin, input.jobId, {
    outreachPackageId: snapshot.outreachPackageId,
    approvedSenderAccountId: snapshot.senderAccountId,
    transportSnapshotId: snapshot.transportSnapshotId,
    transportSnapshot: snapshot,
    transportContentHash: snapshot.contentHash,
    packageFingerprint: snapshot.packageFingerprint,
    manualSenderAccountId: snapshot.senderAccountId,
    allowAutoRotation: false,
    senderAccountId: snapshot.senderAccountId,
  })

  logGrowthEngine("ge_aios_transport_snapshot_bound", {
    qa_marker: GE_AIOS_TRANSPORT_AUTHORITY_1C_QA_MARKER,
    job_id: input.jobId,
    package_id: input.packageId,
    transport_snapshot_id: snapshot.transportSnapshotId,
    content_hash: snapshot.contentHash,
    sender_account_id: snapshot.senderAccountId,
  })

  return { ok: true }
}

export async function refreshSupervisedTransportSnapshotForJob(
  admin: SupabaseClient,
  input: {
    jobId: string
    organizationId: string
    packageId: string
    leadId: string
    sequencePatternStepId?: string | null
    sequencePatternId?: string | null
    frozenAt?: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  return bindSupervisedTransportSnapshotToJob(admin, input)
}

export async function verifySupervisedJobTransportApprovalFidelity(
  admin: SupabaseClient,
  input: {
    jobId: string
    organizationId: string
  },
): Promise<GrowthTransportFidelityVerification1C> {
  const job = await getSequenceExecutionJob(admin, input.jobId)
  if (!job?.outreachPackageId || !job.transportSnapshot) {
    return {
      ok: true,
      code: "ok",
      message: "No supervised transport snapshot bound — legacy path.",
      packageFingerprint: null,
      snapshotFingerprint: null,
      packageContentHash: null,
      snapshotContentHash: null,
    }
  }

  const snapshot = parseTransportSnapshot1C(job.transportSnapshot)
  if (!snapshot) {
    return {
      ok: false,
      code: "missing_snapshot",
      message: "Supervised job transport snapshot is invalid.",
      packageFingerprint: job.packageFingerprint,
      snapshotFingerprint: null,
      packageContentHash: job.transportContentHash,
      snapshotContentHash: null,
    }
  }

  const pkg = await loadApprovedPackageForSnapshot(admin, {
    organizationId: input.organizationId,
    packageId: job.outreachPackageId,
    leadId: job.leadId,
  })
  if (!pkg) {
    return {
      ok: false,
      code: "missing_package",
      message: "Approved outreach package could not be loaded for fidelity verification.",
      packageFingerprint: null,
      snapshotFingerprint: snapshot.packageFingerprint,
      packageContentHash: null,
      snapshotContentHash: snapshot.contentHash,
    }
  }

  return verifyTransportSnapshotAgainstPackage({
    snapshot,
    pkg,
    senderAccountId: job.approvedSenderAccountId ?? snapshot.senderAccountId,
  })
}

export async function ensureSupervisedJobTransportSnapshot(
  admin: SupabaseClient,
  input: {
    jobId: string
    organizationId: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const job = await getSequenceExecutionJob(admin, input.jobId)
  if (!job) return { ok: true }
  if (job.transportSnapshot && job.transportSnapshotId) return { ok: true }

  let packageId = job.outreachPackageId ?? null
  if (!packageId) {
    const requests = await fetchAvaOutreachExecutionRequestsForLead(admin, job.leadId)
    const match =
      requests.find((request) => request.sequenceJobId === job.id) ??
      requests.find((request) => request.executionStatus === "queued")
    packageId = match?.packageId ?? null
  }
  if (!packageId) return { ok: true }

  const step = job.sequenceStepId
    ? await fetchGrowthSequenceEnrollmentStepById(admin, job.sequenceStepId)
    : null

  return bindSupervisedTransportSnapshotToJob(admin, {
    jobId: job.id,
    organizationId: input.organizationId,
    packageId,
    leadId: job.leadId,
    sequencePatternStepId: step?.sequencePatternStepId ?? null,
  })
}

export async function resolveSupervisedPackageIdForJob(
  admin: SupabaseClient,
  job: { id: string; leadId: string; outreachPackageId?: string | null },
): Promise<string | null> {
  if (job.outreachPackageId) return job.outreachPackageId
  const requests = await fetchAvaOutreachExecutionRequestsForLead(admin, job.leadId)
  const match =
    requests.find((request) => request.sequenceJobId === job.id) ??
    requests.find((request) => request.executionStatus === "queued")
  return match?.packageId ?? null
}
