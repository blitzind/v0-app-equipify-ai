/**
 * AI Ops Phase 3 — digest runner.
 * AI Ops Phase 4 — multi-destination dispatch (email + Slack + Teams).
 *
 * Builds the digest payload, dispatches it to every enabled
 * destination independently, and writes a single row to
 * `ai_ops_digest_runs` capturing per-destination success/failure.
 * Used by both the manual send route and the cron worker.
 *
 * **Strictly internal.** No destination is customer-facing:
 *   - email recipients come from `ai_ops_digest_settings.recipients`
 *     (staff emails only),
 *   - Slack/Teams webhook URLs are operator-controlled internal
 *     channels.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getPublicAppOrigin } from "@/lib/email/config"
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
import { sendSlackDigest } from "./slack-adapter"
import { sendTeamsDigest } from "./teams-adapter"

export type DigestRunStatus =
  | "queued"
  | "sent"
  | "skipped"
  | "failed"
  | "partial"
  | "no_recipients"
  | "no_items"

export type DestinationStatus =
  | "sent"
  | "failed"
  | "skipped"
  | "disabled"
  | "not_configured"

export type DestinationResult = {
  status: DestinationStatus
  errorCode: string | null
  errorMessage: string | null
  /** Email-specific. */
  messageId?: string | null
  /** Email-specific. */
  recipientCount?: number
}

export type DestinationsResult = {
  email: DestinationResult
  slack: DestinationResult
  teams: DestinationResult
}

export type RunDigestArgs = {
  supabase: SupabaseClient
  organizationId: string
  triggerKind: "manual" | "cron" | "preview"
  triggeredBy?: string | null
  /** Optional override of the recipient list (e.g. "Send test to me"). */
  overrideRecipients?: string[]
  /** When true, skips every outbound call but still records the run row. */
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
  destinations: DestinationsResult
  errorMessage?: string
  errorCode?: string
  /** Only populated when `returnPayload` is true. */
  payload?: DigestPayload
}

const APP_URL = getPublicAppOrigin()

const DESTINATION_NOT_CONFIGURED: DestinationResult = {
  status: "not_configured",
  errorCode: null,
  errorMessage: null,
}

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
      destinations: emptyDestinations(),
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
      slack_enabled: false,
      teams_enabled: false,
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

  const slackEnabled = Boolean(settings.slack_enabled && settings.slack_webhook_url)
  const teamsEnabled = Boolean(settings.teams_enabled && settings.teams_webhook_url)
  const noEmail = recipients.length === 0
  const noNonEmail = !slackEnabled && !teamsEnabled

  // No destinations at all → record + bail.
  if (noEmail && noNonEmail && !args.dryRun) {
    const runId = await insertRun(args.supabase, {
      organizationId: args.organizationId,
      triggeredBy: args.triggeredBy ?? null,
      triggerKind: args.triggerKind,
      status: "no_recipients",
      payload,
      recipients: [],
      providerMessageId: null,
      errorCode: "no_recipients",
      errorMessage: "No internal recipients or webhook destinations configured.",
      sentAt: null,
      destinations: emptyDestinations(),
    })
    return {
      status: "no_recipients",
      runId,
      itemsCount: payload.totals.total,
      highCount: payload.totals.high,
      recipients: [],
      destinations: emptyDestinations(),
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
      destinations: emptyDestinations(),
    })
    return {
      status: "no_items",
      runId,
      itemsCount: 0,
      highCount: 0,
      recipients,
      destinations: emptyDestinations(),
      payload: args.returnPayload ? payload : undefined,
    }
  }

  if (args.dryRun || args.triggerKind === "preview") {
    return {
      status: "skipped",
      runId: null,
      itemsCount: payload.totals.total,
      highCount: payload.totals.high,
      recipients,
      destinations: emptyDestinations(),
      payload: args.returnPayload ? payload : undefined,
    }
  }

  // Dispatch to every enabled destination in parallel; capture the
  // result of each independently. A single failure must not block
  // the others.
  const [emailResult, slackResult, teamsResult] = await Promise.all([
    dispatchEmail(payload, recipients, args.organizationId),
    slackEnabled
      ? dispatchSlack(payload, settings.slack_webhook_url ?? "")
      : Promise.resolve<DestinationResult>(
          settings.slack_webhook_url
            ? { status: "disabled", errorCode: null, errorMessage: null }
            : DESTINATION_NOT_CONFIGURED,
        ),
    teamsEnabled
      ? dispatchTeams(payload, settings.teams_webhook_url ?? "")
      : Promise.resolve<DestinationResult>(
          settings.teams_webhook_url
            ? { status: "disabled", errorCode: null, errorMessage: null }
            : DESTINATION_NOT_CONFIGURED,
        ),
  ])

  const destinations: DestinationsResult = {
    email: emailResult,
    slack: slackResult,
    teams: teamsResult,
  }
  const overallStatus = aggregateStatus(destinations)
  const sentAtIso = overallStatus === "failed" ? null : new Date(now).toISOString()

  const runId = await insertRun(args.supabase, {
    organizationId: args.organizationId,
    triggeredBy: args.triggeredBy ?? null,
    triggerKind: args.triggerKind,
    status: overallStatus,
    payload,
    recipients,
    providerMessageId: emailResult.messageId ?? null,
    errorCode: collectErrorCode(destinations),
    errorMessage: collectErrorMessage(destinations),
    sentAt: sentAtIso,
    destinations,
  })

  if (sentAtIso) {
    await args.supabase
      .from("ai_ops_digest_settings")
      .update({ last_sent_at: sentAtIso })
      .eq("organization_id", args.organizationId)
  }

  // Audit row in `communication_events` for the email branch only —
  // Slack/Teams dispatches are already captured in `destinations_result`
  // and don't need a duplicate communications row. Email keeps the
  // existing audit behaviour from Phase 3.
  if (emailResult.status === "sent" && sentAtIso) {
    try {
      const subject = renderAiOpsDigestEmail({ payload, appUrl: APP_URL }).subject
      await logCommunicationEvent(args.supabase, {
        organizationId: args.organizationId,
        channel: "system",
        direction: "outbound",
        eventType: "ai_ops_digest_sent",
        title: `AI Ops digest sent · ${payload.totals.total} item${payload.totals.total === 1 ? "" : "s"}`,
        summary: subject,
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
          slack_status: destinations.slack.status,
          teams_status: destinations.teams.status,
        },
        sentAt: sentAtIso,
      })
    } catch {
      // Audit row failures must never break the digest send.
    }
  }

  return {
    status: overallStatus,
    runId,
    itemsCount: payload.totals.total,
    highCount: payload.totals.high,
    recipients,
    destinations,
    errorMessage: collectErrorMessage(destinations) ?? undefined,
    errorCode: collectErrorCode(destinations) ?? undefined,
    payload: args.returnPayload ? payload : undefined,
  }
}

async function dispatchEmail(
  payload: DigestPayload,
  recipients: string[],
  organizationId: string,
): Promise<DestinationResult> {
  if (recipients.length === 0) return DESTINATION_NOT_CONFIGURED
  try {
    const email = renderAiOpsDigestEmail({ payload, appUrl: APP_URL })
    const send = await sendEmail({
      to: recipients,
      subject: email.subject,
      html: email.html,
      text: email.text,
      category: "ai_ops_digest",
      organizationId,
    })
    if (!send.ok) {
      return {
        status: "failed",
        errorCode: send.code ?? "provider_error",
        errorMessage: send.error,
        recipientCount: recipients.length,
      }
    }
    return {
      status: "sent",
      errorCode: null,
      errorMessage: null,
      messageId: send.id ?? null,
      recipientCount: recipients.length,
    }
  } catch (e) {
    return {
      status: "failed",
      errorCode: "exception",
      errorMessage: e instanceof Error ? e.message : String(e),
      recipientCount: recipients.length,
    }
  }
}

async function dispatchSlack(payload: DigestPayload, webhookUrl: string): Promise<DestinationResult> {
  try {
    const result = await sendSlackDigest({ webhookUrl, payload, appUrl: APP_URL })
    if (!result.ok) {
      return {
        status: "failed",
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      }
    }
    return { status: "sent", errorCode: null, errorMessage: null }
  } catch (e) {
    return {
      status: "failed",
      errorCode: "exception",
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}

async function dispatchTeams(payload: DigestPayload, webhookUrl: string): Promise<DestinationResult> {
  try {
    const result = await sendTeamsDigest({ webhookUrl, payload, appUrl: APP_URL })
    if (!result.ok) {
      return {
        status: "failed",
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      }
    }
    return { status: "sent", errorCode: null, errorMessage: null }
  } catch (e) {
    return {
      status: "failed",
      errorCode: "exception",
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}

function aggregateStatus(destinations: DestinationsResult): DigestRunStatus {
  const buckets = [destinations.email, destinations.slack, destinations.teams]
  const active = buckets.filter(
    (d) => d.status !== "not_configured" && d.status !== "disabled",
  )
  if (active.length === 0) return "no_recipients"
  const sent = active.filter((d) => d.status === "sent").length
  const failed = active.filter((d) => d.status === "failed").length
  if (sent === active.length) return "sent"
  if (sent === 0) return "failed"
  if (failed > 0) return "partial"
  return "sent"
}

function collectErrorCode(destinations: DestinationsResult): string | null {
  for (const d of [destinations.email, destinations.slack, destinations.teams]) {
    if (d.status === "failed" && d.errorCode) return d.errorCode
  }
  return null
}

function collectErrorMessage(destinations: DestinationsResult): string | null {
  const errors: string[] = []
  if (destinations.email.status === "failed" && destinations.email.errorMessage) {
    errors.push(`email: ${destinations.email.errorMessage}`)
  }
  if (destinations.slack.status === "failed" && destinations.slack.errorMessage) {
    errors.push(`slack: ${destinations.slack.errorMessage}`)
  }
  if (destinations.teams.status === "failed" && destinations.teams.errorMessage) {
    errors.push(`teams: ${destinations.teams.errorMessage}`)
  }
  return errors.length ? errors.join(" · ") : null
}

function emptyDestinations(): DestinationsResult {
  return {
    email: DESTINATION_NOT_CONFIGURED,
    slack: DESTINATION_NOT_CONFIGURED,
    teams: DESTINATION_NOT_CONFIGURED,
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
    destinations: DestinationsResult
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
      destinations_result: args.destinations,
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
