/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Production probes (QA only).
 *
 * Run:
 *   pnpm probe:ava-mailbox-reliability-and-affinity-1a:production
 *
 * Live affinity send (Probe B):
 *   CONFIRM_AVA_MAILBOX_AFFINITY_1A_LIVE_SEND=1 pnpm probe:...
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { AVA_OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-service"
import { fetchActiveOutboundSenderAssignment } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-repository"
import { bindAvaSupervisedOutboundApproval } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-approval-service"
import { AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { sendApprovedAvaSupervisedGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-send-service"
import {
  fetchGrowthAiCopilotGenerationById,
  insertGrowthAiCopilotGeneration,
  updateGrowthAiCopilotGenerationRecord,
  updateGrowthAiCopilotGenerationStatus,
} from "@/lib/growth/ai-copilot-repository"
import { resolveSequenceExecutionSender } from "@/lib/growth/sequences/execution/sequence-send-builder"
import { diagnoseMailboxCredentialsForSender } from "@/lib/growth/mailboxes/mailbox-credential-loader"
import { bootstrapGrowthProviderCredentialsPepperForCert } from "@/lib/growth/qa/growth-production-credential-pepper-bootstrap"
import {
  ensureMailboxEligibleForSenderAssignment,
  ensureMailboxReadyForOutboundSend,
} from "@/lib/growth/mailboxes/mailbox-pre-send-readiness"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { getPlatformAdminEmails } from "@/lib/platform-admin-policy"

const QA_RECIPIENT = "mike@blitzind.com" as const
const QA_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291" as const
const AVA_SENDER_ACCOUNT_ID = "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720" as const
const CONFIRM_LIVE_SEND = "CONFIRM_AVA_MAILBOX_AFFINITY_1A_LIVE_SEND" as const

type ProbeResult = {
  name: string
  ok: boolean
  detail: string
}

async function resolveActingUser(admin: SupabaseClient): Promise<{ userId: string; email: string }> {
  const preferredEmail = (getPlatformAdminEmails()[0] ?? QA_RECIPIENT).trim().toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const match =
    data.users.find((user) => user.email?.trim().toLowerCase() === preferredEmail) ?? data.users[0]
  if (!match?.id || !match.email) throw new Error("acting_user_unavailable")
  return { userId: match.id, email: match.email }
}

async function probeCredentialDiagnostic(admin: SupabaseClient): Promise<ProbeResult> {
  const pepper = bootstrapGrowthProviderCredentialsPepperForCert()
  const diagnostic = await diagnoseMailboxCredentialsForSender(admin, AVA_SENDER_ACCOUNT_ID)
  const assignmentReady = await ensureMailboxEligibleForSenderAssignment(admin, AVA_SENDER_ACCOUNT_ID)
  const transportReady = await ensureMailboxReadyForOutboundSend(admin, AVA_SENDER_ACCOUNT_ID)

  console.log(
    JSON.stringify(
      {
        mailboxConnectionId: diagnostic.mailboxConnectionId,
        encryptedRefreshPresent: diagnostic.encryptedRefreshPresent,
        encryptedAccessPresent: diagnostic.encryptedAccessPresent,
        accessTokenExpired: diagnostic.accessTokenExpired,
        canonicalLoad: diagnostic.canonicalLoad,
        failureCategory: diagnostic.failureCategory,
        usingDevFallbackCredentialPepper: diagnostic.usingDevFallbackCredentialPepper,
        credentialPepperConfigured: pepper.configured,
        credentialPepperSource: pepper.source,
        assignmentEligibility: assignmentReady.ok ? "ok" : assignmentReady.code,
        transportReadiness: transportReady.ok ? "ok" : transportReady.code,
      },
      null,
      2,
    ),
  )

  const ok = assignmentReady.ok && diagnostic.encryptedRefreshPresent

  return {
    name: "Probe A — Credential diagnostic",
    ok,
    detail: [
      `encryptedRefresh=${diagnostic.encryptedRefreshPresent}`,
      `canonicalLoad=${diagnostic.canonicalLoad}`,
      `failureCategory=${diagnostic.failureCategory ?? "none"}`,
      `accessTokenExpired=${diagnostic.accessTokenExpired}`,
      `assignment=${assignmentReady.ok ? "ok" : assignmentReady.code}`,
      `transport=${transportReady.ok ? "ok" : transportReady.code}`,
      `devFallbackPepper=${diagnostic.usingDevFallbackCredentialPepper}`,
    ].join("; "),
  }
}

async function probeSenderAffinity(admin: SupabaseClient): Promise<ProbeResult> {
  const { error: schemaError } = await admin
    .schema("growth")
    .from("outbound_sender_assignments")
    .select("id")
    .limit(1)

  if (schemaError) {
    const missing = /does not exist|schema cache/i.test(schemaError.message)
    return {
      name: "Probe B — Sender affinity",
      ok: false,
      detail: missing ? `Migration not applied — ${schemaError.message}` : schemaError.message,
    }
  }

  if (process.env[CONFIRM_LIVE_SEND]?.trim() !== "1") {
    return {
      name: "Probe B — Sender affinity",
      ok: true,
      detail: `Dry run — set ${CONFIRM_LIVE_SEND}=1 for full approve/assign/send sequence.`,
    }
  }

  const pepper = bootstrapGrowthProviderCredentialsPepperForCert()
  const acting = await resolveActingUser(admin)
  const unsignedBody = [
    "Hi Mike,",
    "",
    "Controlled AVA mailbox affinity certification send.",
    `Probe marker: ${AVA_OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER}`,
  ].join("\n")

  const inserted = await insertGrowthAiCopilotGeneration(admin, {
    leadId: QA_LEAD_ID,
    generationType: "cold_email",
    promptVersion: "ava-direct-production-cutover-1a-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {
      qaMarker: AVA_OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER,
      approvedSender: { senderAccountId: AVA_SENDER_ACCOUNT_ID },
      contactsSupplied: [
        {
          name: "Mike Short",
          title: "Operator",
          email: QA_RECIPIENT,
          contactabilityStatus: "contactable",
        },
      ],
    },
    generatedContent: unsignedBody,
    generatedSubject: "AVA mailbox affinity controlled certification",
    classification: {
      primary: "pursue",
      generationMode: "ava_direct_production_cutover_1a",
      recommendedContact: {
        name: "Mike Short",
        title: "Operator",
        email: QA_RECIPIENT,
        reason: "Controlled QA recipient",
      },
      rationale: "Controlled affinity certification send.",
    },
    createdBy: acting.userId,
  })

  const approvedStatus = await updateGrowthAiCopilotGenerationStatus(admin, inserted.id, {
    status: "approved",
    approvedBy: acting.userId,
  })

  const bound = await bindAvaSupervisedOutboundApproval(admin, {
    generation: approvedStatus,
    actingUserId: acting.userId,
  })

  await updateGrowthAiCopilotGenerationRecord(admin, inserted.id, {
    generatedContent: bound.unsignedBody,
    classification: bound.classification,
  })

  const assignment = await fetchActiveOutboundSenderAssignment(admin, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    leadId: QA_LEAD_ID,
    contactEmail: QA_RECIPIENT,
  })

  if (!assignment) {
    return {
      name: "Probe B — Sender affinity",
      ok: false,
      detail: "Approval succeeded but sender assignment was not persisted.",
    }
  }

  if (pepper.usingDevFallback) {
    return {
      name: "Probe B — Sender affinity",
      ok: true,
      detail: [
        `approval=ok`,
        `assignment=${assignment.id}`,
        `sender=${assignment.senderEmail}`,
        `send=skipped (export GROWTH_PROVIDER_CREDENTIALS_PEPPER for live transport probe)`,
      ].join("; "),
    }
  }

  const send = await sendApprovedAvaSupervisedGeneration(admin, {
    generationId: inserted.id,
    actingUserId: acting.userId,
    actingUserEmail: acting.email,
    actorOrganizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    isPlatformAdmin: true,
    humanApproved: true,
    humanApprovalConfirmed: true,
  })

  if (!send.ok) {
    return {
      name: "Probe B — Sender affinity",
      ok: false,
      detail: `Send failed after assignment: ${send.code} — ${send.message}`,
    }
  }

  const followUpSender = await resolveSequenceExecutionSender(admin, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    leadId: QA_LEAD_ID,
    contactEmail: QA_RECIPIENT,
  })

  const latest = await fetchGrowthAiCopilotGenerationById(admin, inserted.id)
  const binding = bound.binding

  const ok =
    assignment.senderAccountId === binding.senderAccountId &&
    send.receipt.senderAccountId === assignment.senderAccountId &&
    followUpSender?.senderAccountId === assignment.senderAccountId &&
    send.receipt.recipientEmail === QA_RECIPIENT &&
    Boolean(send.receipt.providerMessageId)

  return {
    name: "Probe B — Sender affinity",
    ok,
    detail: [
      `generation=${inserted.id}`,
      `assignment=${assignment.id}`,
      `sender=${assignment.senderEmail}`,
      `providerMessageId=${send.receipt.providerMessageId ?? "none"}`,
      `followUpSender=${followUpSender?.senderAccountId ?? "none"}`,
      `sentAt=${latest?.sentAt ?? "none"}`,
    ].join("; "),
  }
}

async function probeRotation(admin: SupabaseClient): Promise<ProbeResult> {
  const poolId = process.env.GROWTH_AVA_SUPERVISED_OUTBOUND_SENDER_POOL_ID?.trim()
  if (!poolId) {
    const { count } = await admin
      .schema("growth")
      .from("sender_pools")
      .select("id", { count: "exact", head: true })

    return {
      name: "Probe C — Rotation",
      ok: true,
      detail: `Skipped — no approved QA sender pool configured (pools=${count ?? 0}). Primary-sender policy active.`,
    }
  }

  const { data: assignments, error } = await admin
    .schema("growth")
    .from("outbound_sender_assignments")
    .select("sender_account_id, assignment_source")
    .eq("status", "active")
    .limit(20)

  if (error) {
    return { name: "Probe C — Rotation", ok: false, detail: error.message }
  }

  const uniqueSenders = new Set((assignments ?? []).map((row) => String(row.sender_account_id)))
  return {
    name: "Probe C — Rotation",
    ok: true,
    detail: `Pool ${poolId}; ${uniqueSenders.size} distinct senders across ${assignments?.length ?? 0} active assignments.`,
  }
}

async function main(): Promise<void> {
  console.log(`[${AVA_OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER}] production probes (QA only)`)
  console.log(`[${AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER}] credential-resolution hotfix diagnostic`)

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    console.error("BLOCKED — run via pnpm probe:ava-mailbox-reliability-and-affinity-1a:production")
    process.exit(1)
  }

  const admin = boot.admin

  const results = await Promise.all([
    probeCredentialDiagnostic(admin),
    probeSenderAffinity(admin),
    probeRotation(admin),
  ])

  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} — ${result.name}`)
    console.log(`  ${result.detail}`)
  }

  const failed = results.filter((result) => !result.ok)
  if (failed.length > 0) {
    process.exitCode = 1
    return
  }

  console.log(`\n[${AVA_OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER}] probes complete`)
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
