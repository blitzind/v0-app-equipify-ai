/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Production probes (QA only).
 *
 * Run:
 *   pnpm probe:ava-mailbox-reliability-and-affinity-1a:production
 *
 * Optional live affinity send (Probe B):
 *   CONFIRM_AVA_MAILBOX_AFFINITY_1A_LIVE_SEND=1 pnpm probe:...
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { AVA_OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-service"
import { fetchActiveOutboundSenderAssignment } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-repository"
import { ensureMailboxReadyForOutboundSend } from "@/lib/growth/mailboxes/mailbox-pre-send-readiness"
import { readMailboxOAuthMetadata } from "@/lib/growth/mailboxes/mailbox-oauth-failure-types"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const QA_RECIPIENT = "mike@blitzind.com" as const
const QA_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291" as const
const AVA_SENDER_ACCOUNT_ID = "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720" as const
const CONFIRM_LIVE_SEND = "CONFIRM_AVA_MAILBOX_AFFINITY_1A_LIVE_SEND" as const

type ProbeResult = {
  name: string
  ok: boolean
  detail: string
}

async function probeTokenRefreshLifecycle(admin: SupabaseClient): Promise<ProbeResult> {
  const { data, error } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select(
      "id, email_address, status, token_expires_at, encrypted_refresh_token, provider_metadata, sender_account_id",
    )
    .eq("sender_account_id", AVA_SENDER_ACCOUNT_ID)
    .is("deleted_at", null)
    .maybeSingle()

  if (error || !data) {
    return { name: "Probe A — Token refresh lifecycle", ok: false, detail: "Ava mailbox not found." }
  }

  const row = data as Record<string, unknown>
  const oauth = readMailboxOAuthMetadata(
    row.provider_metadata && typeof row.provider_metadata === "object"
      ? (row.provider_metadata as Record<string, unknown>)
      : {},
  )
  const hasRefresh = Boolean(row.encrypted_refresh_token)
  const tokenExpired =
    typeof row.token_expires_at === "string" &&
    Date.parse(row.token_expires_at) <= Date.now()

  const readiness = await ensureMailboxReadyForOutboundSend(admin, AVA_SENDER_ACCOUNT_ID)

  const ok = hasRefresh && row.status !== "expired" && !oauth.reconnectRequired

  return {
    name: "Probe A — Token refresh lifecycle",
    ok,
    detail: [
      `status=${String(row.status)}`,
      `hasRefresh=${hasRefresh}`,
      `tokenExpired=${tokenExpired}`,
      `accessTokenRefreshRequired=${Boolean(oauth.accessTokenRefreshRequired)}`,
      `readiness=${readiness.ok ? "ok" : readiness.code}`,
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
    if (missing) {
      return {
        name: "Probe B — Sender affinity",
        ok: false,
        detail: `Migration not applied — ${schemaError.message}`,
      }
    }
    return {
      name: "Probe B — Sender affinity",
      ok: false,
      detail: schemaError.message,
    }
  }

  const assignment = await fetchActiveOutboundSenderAssignment(admin, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    leadId: QA_LEAD_ID,
    contactEmail: QA_RECIPIENT,
  })

  if (process.env[CONFIRM_LIVE_SEND]?.trim() !== "1") {
    return {
      name: "Probe B — Sender affinity",
      ok: true,
      detail: assignment
        ? `Existing assignment persisted (${assignment.senderEmail}, source=${assignment.assignmentSource}). Set ${CONFIRM_LIVE_SEND}=1 for live send verification.`
        : `Schema ready; no assignment yet for QA lead. Set ${CONFIRM_LIVE_SEND}=1 to create via approval/send path.`,
    }
  }

  return {
    name: "Probe B — Sender affinity",
    ok: Boolean(assignment?.senderAccountId),
    detail: assignment
      ? `Assignment ${assignment.id} → ${assignment.senderEmail}`
      : "Live send confirm set but no assignment persisted — run supervised approval/send first.",
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

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    console.error("BLOCKED — run via pnpm probe:ava-mailbox-reliability-and-affinity-1a:production")
    process.exit(1)
  }

  const admin = boot.admin

  const results = await Promise.all([
    probeTokenRefreshLifecycle(admin),
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
