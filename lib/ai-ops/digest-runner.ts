/**
 * AI Ops Phase 3 — digest runner.
 *
 * Builds the digest payload, sends the email via Resend, and writes
 * a row to `ai_ops_digest_runs`. Used by both the manual send route
 * and the cron worker — keeping send logic in one place ensures the
 * email format and audit trail stay consistent across triggers.
 *
 * **Strictly internal.** This runner never sends customer-facing
 * messages; the recipient list comes from
 * `ai_ops_digest_settings.recipients` (staff emails only). The
 * runner refuses to dispatch when no recipients are configured.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { renderAiOpsDigestEmail } from "@/lib/email/ai-ops-digest-template"
import {
  buildDigestPayload,
  digestSystemPermissions,
  loadDigestSettings,
  type DigestPayload,
  type DigestSettingsRow,
} from "./digest"

export type DigestRunStatus =
  | "queued"
  | "sent"
  | "skipped"
  | "failed"
  | "no_recipients"
  | "no_items"

export type RunDigestArgs = {
  supabase: SupabaseClient
  organizationId: string
  triggerKind: "manual" | "cron" | "preview"
  triggeredBy?: string | null
  /** Optional override of the recipient list (e.g. "Send test to me"). */
  overrideRecipients?: string[]
  /** When true, skips the Resend call but still records the run row. */
  dryRun?: boolean
  /** When true, also returns the payload for in-app preview rendering. */
  returnPayload?: boolean
  /** Defaults to `new Date()`. */
  now?: Date
}

export type RunDigestResult = {
  status: DigestRunStatus
  runId: string | null
  itemsCount: number
  highCount: number
  recipients: string[]
  errorMessage?: string
  errorCode?: string
  /** Only populated when `returnPayload` is true. */
  payload?: DigestPayload
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "")

export async function runDigestForOrganization(args: RunDigestArgs): Promise<RunDigestResult> {
  const now = args.now ?? new Date()

  const orgRes = await args.supabase
    .from("organizations")
    .select("id, name, timezone")
    .eq("id", args.organizationId)
    .maybeSingle()
  if (orgRes.error || !orgRes.data) {
    return {
      status: "failed",
      runId: null,
      itemsCount: 0,
      highCount: 0,
      recipients: [],
      errorMessage: orgRes.error?.message ?? "Organization not found.",
      errorCode: "org_not_found",
    }
  }
  const organization = orgRes.data as { id: string; name: string; timezone: string | null }

  const settingsRes = await loadDigestSettings(args.supabase, args.organizationId)
  let settings: DigestSettingsRow
  if (settingsRes.row) {
    settings = settingsRes.row
  } else {
    settings = {
      organization_id: args.organizationId,
      enabled: false,
      recipients: [],
      send_hour: 7,
      timezone_snapshot: organization.timezone,
      priority_threshold: "medium",
      categories: [],
      slack_webhook_url: null,
      teams_webhook_url: null,
      skip_weekends: false,
      last_sent_at: null,
    }
  }

  const recipients = (args.overrideRecipients ?? settings.recipients)
    .map((r) => r.trim())
    .filter((r) => r.length > 0)

  const payload = await buildDigestPayload({
    supabase: args.supabase,
    organizationId: args.organizationId,
    organizationName: organization.name,
    organizationTimezone: organization.timezone ?? "UTC",
    permissions: digestSystemPermissions(),
    settings,
    now,
  })

  // No recipients → record the run for visibility but do not send.
  if (recipients.length === 0 && !args.dryRun) {
    const runId = await insertRun(args.supabase, {
      organizationId: args.organizationId,
      triggeredBy: args.triggeredBy ?? null,
      triggerKind: args.triggerKind,
      status: "no_recipients",
      payload,
      recipients: [],
      providerMessageId: null,
      errorCode: "no_recipients",
      errorMessage: "No internal recipients configured.",
      sentAt: null,
    })
    return {
      status: "no_recipients",
      runId,
      itemsCount: payload.totals.total,
      highCount: payload.totals.high,
      recipients: [],
      payload: args.returnPayload ? payload : undefined,
    }
  }

  // No items at the configured threshold → record but do not send
  // unless the trigger is manual (operator may want confirmation).
  if (payload.totals.total === 0 && args.triggerKind === "cron") {
    const runId = await insertRun(args.supabase, {
      organizationId: args.organizationId,
      triggeredBy: args.triggeredBy ?? null,
      triggerKind: args.triggerKind,
      status: "no_items",
      payload,
      recipients,
      providerMessageId: null,
      errorCode: "no_items",
      errorMessage: "No items at or above the configured priority threshold.",
      sentAt: null,
    })
    return {
      status: "no_items",
      runId,
      itemsCount: 0,
      highCount: 0,
      recipients,
      payload: args.returnPayload ? payload : undefined,
    }
  }

  if (args.dryRun || args.triggerKind === "preview") {
    // No DB write for previews — they are read-only.
    return {
      status: "skipped",
      runId: null,
      itemsCount: payload.totals.total,
      highCount: payload.totals.high,
      recipients,
      payload: args.returnPayload ? payload : undefined,
    }
  }

  const email = renderAiOpsDigestEmail({ payload, appUrl: APP_URL })
  const send = await sendEmail({
    to: recipients,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })

  if (!send.ok) {
    const runId = await insertRun(args.supabase, {
      organizationId: args.organizationId,
      triggeredBy: args.triggeredBy ?? null,
      triggerKind: args.triggerKind,
      status: "failed",
      payload,
      recipients,
      providerMessageId: null,
      errorCode: send.code ?? "provider_error",
      errorMessage: send.error,
      sentAt: null,
    })
    return {
      status: "failed",
      runId,
      itemsCount: payload.totals.total,
      highCount: payload.totals.high,
      recipients,
      errorMessage: send.error,
      errorCode: send.code,
      payload: args.returnPayload ? payload : undefined,
    }
  }

  const sentAtIso = new Date(now).toISOString()
  const runId = await insertRun(args.supabase, {
    organizationId: args.organizationId,
    triggeredBy: args.triggeredBy ?? null,
    triggerKind: args.triggerKind,
    status: "sent",
    payload,
    recipients,
    providerMessageId: send.id ?? null,
    errorCode: null,
    errorMessage: null,
    sentAt: sentAtIso,
  })

  await args.supabase
    .from("ai_ops_digest_settings")
    .update({ last_sent_at: sentAtIso })
    .eq("organization_id", args.organizationId)

  // Audit row in `communication_events` so the org timeline shows
  // an internal-only audit (channel = "system") of the digest. No
  // customer is the recipient.
  try {
    await logCommunicationEvent(args.supabase, {
      organizationId: args.organizationId,
      channel: "system",
      direction: "outbound",
      eventType: "ai_ops_digest_sent",
      title: `AI Ops digest sent · ${payload.totals.total} item${payload.totals.total === 1 ? "" : "s"}`,
      summary: email.subject,
      audience: "organization",
      countsTowardUnread: false,
      deliveryStatus: "sent",
      recipientKind: "none",
      provider: "resend",
      metadata: {
        trigger_kind: args.triggerKind,
        recipient_count: recipients.length,
        high_count: payload.totals.high,
        items_count: payload.totals.total,
      },
      sentAt: sentAtIso,
    })
  } catch {
    // Audit row failures must never break the digest send.
  }

  return {
    status: "sent",
    runId,
    itemsCount: payload.totals.total,
    highCount: payload.totals.high,
    recipients,
    payload: args.returnPayload ? payload : undefined,
  }
}

async function insertRun(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    triggeredBy: string | null
    triggerKind: "manual" | "cron" | "preview"
    status: DigestRunStatus
    payload: DigestPayload
    recipients: string[]
    providerMessageId: string | null
    errorCode: string | null
    errorMessage: string | null
    sentAt: string | null
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("ai_ops_digest_runs")
    .insert({
      organization_id: args.organizationId,
      triggered_by: args.triggeredBy,
      trigger_kind: args.triggerKind,
      status: args.status,
      recipients: args.recipients,
      items_count: args.payload.totals.total,
      high_count: args.payload.totals.high,
      medium_count: args.payload.totals.medium,
      low_count: args.payload.totals.low,
      summary: deriveRunSummary(args.payload),
      provider_message_id: args.providerMessageId,
      error_code: args.errorCode,
      error_message: args.errorMessage,
      categories: args.payload.byCategory.map((c) => c.category),
      sent_at: args.sentAt,
    })
    .select("id")
    .maybeSingle()
  if (error || !data) return null
  return (data as { id: string }).id
}

function deriveRunSummary(payload: DigestPayload): string {
  if (payload.totals.total === 0) return "Nothing urgent today."
  return [
    `${payload.totals.high} high`,
    `${payload.totals.medium} medium`,
    `${payload.totals.low} low`,
  ].join(" · ")
}
