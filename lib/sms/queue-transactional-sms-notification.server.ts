import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeLocalHm } from "@/lib/notifications/notification-time-local"
import type { DigestSettingsDto } from "@/lib/notifications/organization-notification-preferences-repository"
import type { WorkspaceAlertType } from "@/lib/notifications/workspace-alert-registry"
import { isTransactionalSmsAlertType } from "@/lib/sms/transactional-sms-allowlist"
import { resolveSmsOutboundProvider } from "@/lib/sms/sms-provider-registry.server"
import type { WorkspaceSmsWorkspaceDto } from "@/lib/sms/workspace-sms-types"
import { fetchWorkspaceSmsSettingsRow, workspaceSmsRowToDto } from "@/lib/sms/workspace-sms-repository.server"

const E164_RE = /^\+[1-9]\d{6,14}$/

function minutesFromLocalHm(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number.parseInt(x, 10))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return h * 60 + m
}

/** Returns true when digest quiet hours say outbound SMS/email should be suppressed (local wall-clock HH:MM). */
export function isWithinDigestQuietHours(
  now: Date,
  digest: Pick<DigestSettingsDto, "quietHoursEnabled" | "quietHoursStartLocal" | "quietHoursEndLocal">,
): boolean {
  if (!digest.quietHoursEnabled) return false
  const start = digest.quietHoursStartLocal ? normalizeLocalHm(digest.quietHoursStartLocal, "22:00") : "22:00"
  const end = digest.quietHoursEndLocal ? normalizeLocalHm(digest.quietHoursEndLocal, "07:00") : "07:00"
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  const cur = minutesFromLocalHm(`${hh}:${mm}`)
  const a = minutesFromLocalHm(start)
  const b = minutesFromLocalHm(end)
  if (a === b) return false
  if (a < b) return cur >= a && cur < b
  return cur >= a || cur < b
}

export type QueueTransactionalSmsNotificationInput = {
  organizationId: string
  alertType: WorkspaceAlertType
  recipientE164: string
  body: string
  idempotencyKey: string
  /** Workspace digest settings (quiet hours). */
  digest: DigestSettingsDto
  smsWorkspace: WorkspaceSmsWorkspaceDto
  /** Per-alert SMS preference already resolved for this alert. */
  alertSmsEnabled: boolean
  /** When false, skip send even if other gates pass (e.g. dry-run / kill switch). */
  liveSendAllowed: boolean
}

export type QueueTransactionalSmsNotificationResult =
  | { status: "sent" | "noop_simulated" | "queued" }
  | { status: "skipped"; code: string }

/**
 * Validates org-scoped transactional SMS gates, writes an audit row, and optionally invokes the provider.
 * Never throws to callers — returns skip/failure codes for upstream logging.
 */
export async function queueTransactionalSmsNotification(
  svc: SupabaseClient,
  input: QueueTransactionalSmsNotificationInput,
): Promise<QueueTransactionalSmsNotificationResult> {
  const {
    organizationId,
    alertType,
    recipientE164,
    body,
    idempotencyKey,
    digest,
    smsWorkspace,
    alertSmsEnabled,
    liveSendAllowed,
  } = input

  const logAttempt = async (status: string, skipCode: string | null, internalErr: string | null) => {
    await svc.from("organization_sms_delivery_attempts").insert({
      organization_id: organizationId,
      alert_type: alertType,
      recipient_e164: recipientE164,
      status,
      skip_code: skipCode,
      error_message_internal: internalErr,
      body_fingerprint: null,
    })
  }

  if (!isTransactionalSmsAlertType(alertType)) {
    await logAttempt("skipped", "alert_not_allowed", null)
    return { status: "skipped", code: "alert_not_allowed" }
  }
  if (!smsWorkspace.transactionalOnly) {
    await logAttempt("skipped", "transactional_only_violation", null)
    return { status: "skipped", code: "transactional_only_violation" }
  }
  if (!smsWorkspace.smsChannelConfigurable) {
    await logAttempt("skipped", "workspace_sms_not_ready", null)
    return { status: "skipped", code: "workspace_sms_not_ready" }
  }
  if (!alertSmsEnabled) {
    await logAttempt("skipped", "preference_off", null)
    return { status: "skipped", code: "preference_off" }
  }
  if (!E164_RE.test(recipientE164.trim())) {
    await logAttempt("skipped", "invalid_e164", null)
    return { status: "skipped", code: "invalid_e164" }
  }

  const now = new Date()
  if (isWithinDigestQuietHours(now, digest)) {
    await logAttempt("skipped", "quiet_hours", null)
    return { status: "skipped", code: "quiet_hours" }
  }

  const { data: supRow } = await svc
    .from("organization_sms_suppressions")
    .select("e164")
    .eq("organization_id", organizationId)
    .eq("e164", recipientE164.trim())
    .maybeSingle()
  if (supRow) {
    await logAttempt("skipped", "suppressed", null)
    return { status: "skipped", code: "suppressed" }
  }

  if (smsWorkspace.optInRequired) {
    const { data: consent } = await svc
      .from("organization_sms_recipient_consents")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("e164", recipientE164.trim())
      .eq("consent_scope", "transactional")
      .is("revoked_at", null)
      .maybeSingle()
    if (!consent) {
      await logAttempt("skipped", "missing_consent", null)
      return { status: "skipped", code: "missing_consent" }
    }
  }

  if (!liveSendAllowed) {
    await logAttempt("noop_simulated", "live_send_disabled", null)
    return { status: "noop_simulated" }
  }

  const provider = resolveSmsOutboundProvider(smsWorkspace.providerKind)
  const result = await provider.send({
    organizationId,
    toE164: recipientE164.trim(),
    body,
    idempotencyKey,
  })

  if (!result.ok) {
    await svc.from("organization_sms_delivery_attempts").insert({
      organization_id: organizationId,
      alert_type: alertType,
      recipient_e164: recipientE164.trim(),
      status: "failed",
      skip_code: result.code,
      error_message_internal: `provider=${result.provider}`,
      body_fingerprint: null,
    })
    return { status: "skipped", code: "provider_failed" }
  }

  await svc.from("organization_sms_delivery_attempts").insert({
    organization_id: organizationId,
    alert_type: alertType,
    recipient_e164: recipientE164.trim(),
    status: result.externalId ? "sent" : "noop_simulated",
    skip_code: null,
    provider_external_ref: result.externalId,
    body_fingerprint: null,
  })

  return result.externalId ? { status: "sent" } : { status: "noop_simulated" }
}

/** Loads SMS workspace DTO using service role (for cron / internal jobs). */
export async function loadWorkspaceSmsDtoForSendPipeline(
  svc: SupabaseClient,
  organizationId: string,
): Promise<WorkspaceSmsWorkspaceDto> {
  const { row } = await fetchWorkspaceSmsSettingsRow(svc, organizationId)
  return workspaceSmsRowToDto(row)
}
