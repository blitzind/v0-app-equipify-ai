/**
 * AVA-SUPERVISED-OUTBOUND-1A — Controlled production send probe.
 *
 * Run:
 *   CONFIRM_AVA_SUPERVISED_OUTBOUND_1A_LIVE_SEND=1 pnpm probe:ava-supervised-outbound-1a
 *
 * Uses QA recipient only — never a prospect mailbox.
 */
import { createClient } from "@supabase/supabase-js"
import { AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import {
  countPlaintextSignatureSeparators,
  stripAccidentalAvaSignatureFromBody,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import { sendApprovedAvaSupervisedGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-send-service"
import { bindAvaSupervisedOutboundApproval } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-approval-service"
import {
  fetchGrowthAiCopilotGenerationById,
  insertGrowthAiCopilotGeneration,
  updateGrowthAiCopilotGenerationRecord,
  updateGrowthAiCopilotGenerationStatus,
} from "@/lib/growth/ai-copilot-repository"
import { getPlatformAdminEmails } from "@/lib/platform-admin-policy"

const CONFIRM_ENV = "CONFIRM_AVA_SUPERVISED_OUTBOUND_1A_LIVE_SEND" as const
const QA_RECIPIENT = "mike@blitzind.com" as const
const QA_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291" as const

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`missing_env:${name}`)
  return value
}

async function resolveActingUser(admin: ReturnType<typeof createClient>): Promise<{
  userId: string
  email: string
}> {
  const preferredEmail = (getPlatformAdminEmails()[0] ?? QA_RECIPIENT).trim().toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const match =
    data.users.find((user) => user.email?.trim().toLowerCase() === preferredEmail) ?? data.users[0]
  if (!match?.id || !match.email) throw new Error("acting_user_unavailable")
  return { userId: match.id, email: match.email }
}

async function main(): Promise<void> {
  console.log(`[${AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER}] controlled production probe`)

  if (process.env[CONFIRM_ENV]?.trim() !== "1") {
    console.log(`BLOCKED — set ${CONFIRM_ENV}=1 to run controlled QA send to ${QA_RECIPIENT}`)
    process.exit(0)
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const acting = await resolveActingUser(admin)

  const unsignedBody = [
    "Hi Mike,",
    "",
    "This is a controlled AVA-SUPERVISED-OUTBOUND-1A certification send.",
    "The body should contain no sender signature block.",
  ].join("\n")

  const inserted = await insertGrowthAiCopilotGeneration(admin, {
    leadId: QA_LEAD_ID,
    generationType: "cold_email",
    promptVersion: "ava-direct-production-cutover-1a-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {
      qaMarker: AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
      approvedSender: { senderAccountId: "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720" },
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
    generatedSubject: "AVA-SUPERVISED-OUTBOUND-1A controlled certification",
    classification: {
      primary: "pursue",
      generationMode: "ava_direct_production_cutover_1a",
      recommendedContact: {
        name: "Mike Short",
        title: "Operator",
        email: QA_RECIPIENT,
        reason: "Controlled QA recipient",
      },
      rationale: "Controlled certification send.",
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

  const firstSend = await sendApprovedAvaSupervisedGeneration(admin, {
    generationId: inserted.id,
    actingUserId: acting.userId,
    actingUserEmail: acting.email,
    humanApproved: true,
    humanApprovalConfirmed: true,
  })

  if (!firstSend.ok) {
    console.error("SEND_FAILED", firstSend.code, firstSend.message)
    process.exit(1)
  }

  const retry = await sendApprovedAvaSupervisedGeneration(admin, {
    generationId: inserted.id,
    actingUserId: acting.userId,
    actingUserEmail: acting.email,
    humanApproved: true,
    humanApprovalConfirmed: true,
  })

  const latest = await fetchGrowthAiCopilotGenerationById(admin, inserted.id)
  const attemptId = firstSend.receipt.deliveryAttemptId
  const { data: attempt } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("id, provider_message_id, status, sent_at, metadata")
    .eq("id", attemptId)
    .maybeSingle()

  const transportText = attempt?.metadata && typeof attempt.metadata === "object"
    ? String((attempt.metadata as Record<string, unknown>).text_preview ?? "")
    : ""

  console.log(
    JSON.stringify(
      {
        qaMarker: AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
        generationId: inserted.id,
        recipient: firstSend.receipt.recipientEmail,
        subject: firstSend.receipt.subject,
        unsignedBody: stripAccidentalAvaSignatureFromBody(latest?.generatedContent ?? unsignedBody),
        signatureSeparatorsInStoredBody: countPlaintextSignatureSeparators(
          latest?.generatedContent ?? "",
        ),
        firstSendOk: firstSend.ok,
        retryOk: retry.ok,
        retryCode: retry.ok ? null : retry.code,
        providerMessageId: firstSend.receipt.providerMessageId,
        deliveryAttemptId: attemptId,
        deliveryAttemptStatus: attempt?.status ?? null,
        duplicateSendPrevented: retry.ok && retry.receipt.deliveryAttemptId === firstSend.receipt.deliveryAttemptId,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
