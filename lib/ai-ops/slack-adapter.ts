/**
 * AI Ops Phase 4 — Slack delivery adapter.
 *
 * Posts a compact internal-only Block Kit message to a Slack
 * Incoming Webhook URL. The payload mirrors the email template's
 * top section (header + totals + top focus items) without ever
 * including raw UUIDs, customer email addresses, or AI-generated
 * draft contents.
 *
 * **Internal-only.** This adapter never sends customer-facing
 * messages. The webhook URL is configured per-organization via
 * `ai_ops_digest_settings.slack_webhook_url` and is only invoked
 * when `slack_enabled = true`.
 */

import "server-only"

import type { DigestPayload } from "./digest"
import type { Recommendation } from "./types"

const SLACK_WEBHOOK_HOST_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/

const MAX_BLOCKS = 8
const MAX_HIGHLIGHTS_IN_MSG = 5
const SLACK_TIMEOUT_MS = 8_000

const PRIORITY_EMOJI: Record<Recommendation["priority"], string> = {
  high: ":red_circle:",
  medium: ":large_orange_diamond:",
  low: ":large_blue_circle:",
}

export type SlackSendArgs = {
  webhookUrl: string
  payload: DigestPayload
  appUrl: string
  /** When true, sends a tiny "test" message instead of the full digest. */
  asTest?: boolean
}

export type SlackSendResult =
  | { ok: true; statusCode: number }
  | { ok: false; errorCode: SlackErrorCode; errorMessage: string }

export type SlackErrorCode =
  | "invalid_webhook_url"
  | "request_failed"
  | "timeout"
  | "non_2xx"

export function validateSlackWebhookUrl(url: string): { ok: true } | { ok: false; reason: string } {
  if (!url) return { ok: false, reason: "Webhook URL is empty." }
  if (!SLACK_WEBHOOK_HOST_RE.test(url.trim())) {
    return {
      ok: false,
      reason: "Slack webhook URLs must look like https://hooks.slack.com/services/T.../B.../...",
    }
  }
  return { ok: true }
}

export async function sendSlackDigest(args: SlackSendArgs): Promise<SlackSendResult> {
  const validation = validateSlackWebhookUrl(args.webhookUrl)
  if (!validation.ok) {
    return { ok: false, errorCode: "invalid_webhook_url", errorMessage: validation.reason }
  }

  const body = args.asTest
    ? buildTestPayload(args.payload, args.appUrl)
    : buildDigestPayload(args.payload, args.appUrl)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS)
  try {
    const res = await fetch(args.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return {
        ok: false,
        errorCode: "non_2xx",
        errorMessage: `Slack returned ${res.status}: ${text.slice(0, 240)}`,
      }
    }
    return { ok: true, statusCode: res.status }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, errorCode: "timeout", errorMessage: "Slack webhook call timed out." }
    }
    return {
      ok: false,
      errorCode: "request_failed",
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  } finally {
    clearTimeout(timer)
  }
}

function buildDigestPayload(payload: DigestPayload, appUrl: string): Record<string, unknown> {
  const date = new Date(payload.generatedAtIso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  const blocks: Array<Record<string, unknown>> = []

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `AI Ops · ${payload.organization.name} · ${date}`,
      emoji: true,
    },
  })

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        payload.totals.total === 0
          ? "*All clear.* No high or medium priority items today."
          : buildTotalsLine(payload),
    },
  })

  if (payload.totals.total > 0) {
    blocks.push({ type: "divider" })
    const top = payload.highlights.slice(0, MAX_HIGHLIGHTS_IN_MSG)
    for (const rec of top) {
      const link = absoluteUrl(rec.entity?.href ?? rec.actions[0]?.href ?? "/ai-ops", appUrl)
      const metric = rec.metric ? ` · *${escapeMrkdwn(rec.metric.label)}:* ${escapeMrkdwn(rec.metric.value)}` : ""
      const entity = rec.entity?.label ? `\n${escapeMrkdwn(rec.entity.label)}` : ""
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${PRIORITY_EMOJI[rec.priority]} *<${link}|${escapeMrkdwn(rec.title)}>*\n${escapeMrkdwn(
            rec.explanation,
          )}${metric}${entity}`,
        },
      })
      if (blocks.length >= MAX_BLOCKS) break
    }

    const a = payload.recentActivity
    if (a.actedOn || a.dismissed || a.snoozed || a.drafted) {
      blocks.push({ type: "divider" })
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_Last 7 days_ · ${a.actedOn} handled · ${a.drafted} drafted · ${a.dismissed} dismissed · ${a.snoozed} snoozed`,
          },
        ],
      })
    }
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `<${absoluteUrl("/ai-ops", appUrl)}|Open AI Operations →>  ·  Internal AI Ops digest — never sent to customers.`,
      },
    ],
  })

  return {
    text: `AI Ops digest for ${payload.organization.name} — ${
      payload.totals.high
    } high, ${payload.totals.medium} medium, ${payload.totals.low} low.`,
    blocks,
  }
}

function buildTotalsLine(payload: DigestPayload): string {
  const parts: string[] = []
  if (payload.totals.high) parts.push(`*${payload.totals.high}* high`)
  if (payload.totals.medium) parts.push(`${payload.totals.medium} medium`)
  if (payload.totals.low) parts.push(`${payload.totals.low} low`)
  return `${parts.join(" · ")} — ${payload.totals.total} item${payload.totals.total === 1 ? "" : "s"} need attention.`
}

function buildTestPayload(payload: DigestPayload, appUrl: string): Record<string, unknown> {
  return {
    text: `AI Ops Slack test from ${payload.organization.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:white_check_mark: *AI Ops Slack test* from *${escapeMrkdwn(payload.organization.name)}*. This destination is wired correctly.`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${absoluteUrl(
              "/settings/notifications#ai-ops-digest",
              appUrl,
            )}|Manage digest settings →>`,
          },
        ],
      },
    ],
  }
}

function absoluteUrl(path: string, appUrl: string): string {
  if (!path) return appUrl || "https://app.equipify.ai"
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  if (!appUrl) return path
  return `${appUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
}

function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
