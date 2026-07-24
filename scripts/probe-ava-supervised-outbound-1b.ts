/**
 * AVA-SUPERVISED-OUTBOUND-1B — Controlled production send probe.
 *
 * Run:
 *   CONFIRM_AVA_SUPERVISED_OUTBOUND_1B_LIVE_SEND=1 \
 *   pnpm probe:ava-supervised-outbound-1b:production
 *
 * Requires Vercel Production env via `vercel-production-env-run.ts`.
 * QA recipient only — never a prospect mailbox.
 */
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { fetchSupabaseAnonKeyFromCli, resolveLinkedSupabaseProjectRef } from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"
import { AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1b-types"
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
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const CONFIRM_ENV = "CONFIRM_AVA_SUPERVISED_OUTBOUND_1B_LIVE_SEND" as const
const QA_RECIPIENT = "mike@blitzind.com" as const
const QA_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291" as const
const APPROVED_SENDER_ACCOUNT_ID = "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720" as const
const BASE_URL = "https://app.equipify.ai" as const

async function resolveActingUser(admin: SupabaseClient): Promise<{
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

async function buildProductionAuthCookieHeader(
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string,
): Promise<string> {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const email = (getPlatformAdminEmails()[0] ?? QA_RECIPIENT).trim().toLowerCase()
  const link = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${BASE_URL}/growth/review` },
  })
  const hashed = link.data?.properties?.hashed_token
  if (!hashed) throw new Error("generate_link_failed")

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: "email" })
  const session = verified.data.session
  if (!session?.access_token || !session.refresh_token) throw new Error("verify_otp_failed")

  const cookiesToSet: Array<{ name: string; value: string }> = []
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => {
        for (const cookie of cookies) cookiesToSet.push({ name: cookie.name, value: cookie.value })
      },
    },
  })
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  return cookiesToSet.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
}

async function postProductionSend(generationId: string, cookieHeader: string) {
  const response = await fetch(`${BASE_URL}/api/platform/growth/copilot/generations/${generationId}/send`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ humanApproved: true, humanApprovalConfirmed: true }),
    cache: "no-store",
  })
  const json = await response.json().catch(() => ({}))
  return { status: response.status, body: json }
}

async function resolveSenderAccount(admin: SupabaseClient, senderAccountId: string) {
  const { data, error } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("id, email_address, display_name")
    .eq("id", senderAccountId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function main(): Promise<void> {
  console.log(`[${AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER}] controlled production probe`)

  if (process.env[CONFIRM_ENV]?.trim() !== "1") {
    console.log(`BLOCKED — set ${CONFIRM_ENV}=1 to run controlled QA send to ${QA_RECIPIENT}`)
    process.exit(0)
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    console.error("BLOCKED — run via pnpm probe:ava-supervised-outbound-1b:production (vercel env run)")
    process.exit(1)
  }

  const { admin, url: supabaseUrl, env_source: envSource } = boot
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!anonKey) {
    const projectRef = resolveLinkedSupabaseProjectRef()
    if (projectRef) anonKey = fetchSupabaseAnonKeyFromCli(projectRef)?.trim() ?? undefined
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!anonKey || !serviceRoleKey) throw new Error("missing_supabase_keys")

  const acting = await resolveActingUser(admin)
  const senderAccount = await resolveSenderAccount(admin, APPROVED_SENDER_ACCOUNT_ID)
  if (!senderAccount) throw new Error("sender_account_unavailable")

  const unsignedBody = [
    "Hi Mike,",
    "",
    "This is a controlled AVA-SUPERVISED-OUTBOUND-1B certification send.",
    "The body should contain no sender signature block before transport.",
    `Probe marker: ${AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER}`,
  ].join("\n")

  const inserted = await insertGrowthAiCopilotGeneration(admin, {
    leadId: QA_LEAD_ID,
    generationType: "cold_email",
    promptVersion: "ava-direct-production-cutover-1a-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {
      qaMarker: AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER,
      approvedSender: { senderAccountId: APPROVED_SENDER_ACCOUNT_ID },
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
    generatedSubject: "AVA-SUPERVISED-OUTBOUND-1B controlled certification",
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

  const concurrent = await Promise.all([
    sendApprovedAvaSupervisedGeneration(admin, {
      generationId: inserted.id,
      actingUserId: acting.userId,
      actingUserEmail: acting.email,
      actorOrganizationId: EQUIPIFY_PRODUCTION_ORG_ID,
      isPlatformAdmin: true,
      humanApproved: true,
      humanApprovalConfirmed: true,
    }),
    sendApprovedAvaSupervisedGeneration(admin, {
      generationId: inserted.id,
      actingUserId: acting.userId,
      actingUserEmail: acting.email,
      actorOrganizationId: EQUIPIFY_PRODUCTION_ORG_ID,
      isPlatformAdmin: true,
      humanApproved: true,
      humanApprovalConfirmed: true,
    }),
  ])

  const successes = concurrent.filter((result) => result.ok)
  const rejections = concurrent.filter((result) => !result.ok)
  if (successes.length !== 1) {
    console.error("CONCURRENT_SEND_ASSERTION_FAILED", { successes: successes.length, rejections })
    process.exit(1)
  }

  const firstSend = successes[0]
  if (!firstSend.ok) throw new Error("unexpected_send_failure")

  const retry = await sendApprovedAvaSupervisedGeneration(admin, {
    generationId: inserted.id,
    actingUserId: acting.userId,
    actingUserEmail: acting.email,
    actorOrganizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    isPlatformAdmin: true,
    humanApproved: true,
    humanApprovalConfirmed: true,
  })

  const cookieHeader = await buildProductionAuthCookieHeader(supabaseUrl, anonKey, serviceRoleKey)
  const apiRetry = await postProductionSend(inserted.id, cookieHeader)

  const latest = await fetchGrowthAiCopilotGenerationById(admin, inserted.id)
  const attemptId = firstSend.receipt.deliveryAttemptId
  const { data: attempt } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("id, provider_message_id, status, sent_at, metadata, from_email, reply_to")
    .eq("id", attemptId)
    .maybeSingle()

  const metadata =
    attempt?.metadata && typeof attempt.metadata === "object"
      ? (attempt.metadata as Record<string, unknown>)
      : {}
  const transportText = String(metadata.text_preview ?? "")
  const signatureSeparatorsInTransport = countPlaintextSignatureSeparators(transportText)

  const report = {
    qaMarker: AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER,
    envSource,
    generationId: inserted.id,
    recipient: firstSend.receipt.recipientEmail,
    subject: firstSend.receipt.subject,
    fromEmail: senderAccount.email_address,
    senderDisplayName: senderAccount.display_name,
    replyTo: metadata.reply_to ?? metadata.replyTo ?? null,
    unsignedStoredBody: stripAccidentalAvaSignatureFromBody(latest?.generatedContent ?? unsignedBody),
    signatureSeparatorsInStoredBody: countPlaintextSignatureSeparators(latest?.generatedContent ?? ""),
    signatureSeparatorsInTransport,
    providerMessageId: firstSend.receipt.providerMessageId,
    sentAt: firstSend.receipt.sentAt,
    generationSentAt: latest?.sentAt ?? null,
    deliveryAttemptId: attemptId,
    deliveryAttemptStatus: attempt?.status ?? null,
    concurrentSuccessCount: successes.length,
    concurrentRejectionCodes: rejections.map((entry) => entry.code),
    serviceRetryOk: retry.ok,
    serviceRetryCode: retry.ok ? null : retry.code,
    apiRetryStatus: apiRetry.status,
    apiRetryError: apiRetry.body?.error ?? null,
    duplicateSendPrevented:
      !retry.ok &&
      (retry.code === "already_sent" || retry.code === "send_in_progress") &&
      apiRetry.status === 409,
  }

  console.log(JSON.stringify(report, null, 2))

  if (report.recipient !== QA_RECIPIENT) {
    console.error("RECIPIENT_ASSERTION_FAILED")
    process.exit(1)
  }
  if (!report.providerMessageId) {
    console.error("PROVIDER_MESSAGE_ID_MISSING")
    process.exit(1)
  }
  if (!report.duplicateSendPrevented) {
    console.error("DUPLICATE_SEND_NOT_PREVENTED")
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
