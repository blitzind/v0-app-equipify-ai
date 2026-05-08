/**
 * AI Ops Phase 4 — Microsoft Teams delivery adapter.
 *
 * Posts a compact internal-only Adaptive Card (via the legacy
 * Office 365 connector format Teams Incoming Webhooks accept) to a
 * configured Teams webhook URL. The card mirrors the email
 * template's hero + totals + top focus items, never exposes raw
 * UUIDs, customer email addresses, or AI-generated draft contents.
 *
 * **Internal-only.** This adapter never sends customer-facing
 * messages.
 */

import "server-only"

import type { DigestPayload } from "./digest"
import type { Recommendation } from "./types"

const TEAMS_HOST_RE =
  /^https:\/\/[a-z0-9-]+\.(?:webhook\.office\.com|outlook\.office(?:365)?\.com)\/webhookb2?\/[A-Za-z0-9_/-]+$/i

const MAX_HIGHLIGHTS_IN_MSG = 5
const TEAMS_TIMEOUT_MS = 8_000

const PRIORITY_COLOR: Record<Recommendation["priority"], string> = {
  high: "Attention",
  medium: "Warning",
  low: "Accent",
}

export type TeamsSendArgs = {
  webhookUrl: string
  payload: DigestPayload
  appUrl: string
  asTest?: boolean
}

export type TeamsSendResult =
  | { ok: true; statusCode: number }
  | { ok: false; errorCode: TeamsErrorCode; errorMessage: string }

export type TeamsErrorCode = "invalid_webhook_url" | "request_failed" | "timeout" | "non_2xx"

export function validateTeamsWebhookUrl(url: string): { ok: true } | { ok: false; reason: string } {
  if (!url) return { ok: false, reason: "Webhook URL is empty." }
  if (!TEAMS_HOST_RE.test(url.trim())) {
    return {
      ok: false,
      reason:
        "Teams webhook URLs must point to outlook.office.com, outlook.office365.com, or *.webhook.office.com.",
    }
  }
  return { ok: true }
}

export async function sendTeamsDigest(args: TeamsSendArgs): Promise<TeamsSendResult> {
  const validation = validateTeamsWebhookUrl(args.webhookUrl)
  if (!validation.ok) {
    return { ok: false, errorCode: "invalid_webhook_url", errorMessage: validation.reason }
  }

  const body = args.asTest
    ? buildTestCard(args.payload, args.appUrl)
    : buildDigestCard(args.payload, args.appUrl)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TEAMS_TIMEOUT_MS)
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
        errorMessage: `Teams returned ${res.status}: ${text.slice(0, 240)}`,
      }
    }
    return { ok: true, statusCode: res.status }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, errorCode: "timeout", errorMessage: "Teams webhook call timed out." }
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

function buildDigestCard(payload: DigestPayload, appUrl: string): Record<string, unknown> {
  const date = new Date(payload.generatedAtIso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  const facts: Array<{ name: string; value: string }> = [
    { name: "High", value: String(payload.totals.high) },
    { name: "Medium", value: String(payload.totals.medium) },
    { name: "Low", value: String(payload.totals.low) },
    { name: "Total", value: String(payload.totals.total) },
  ]

  const sections: Array<Record<string, unknown>> = [
    {
      activityTitle: `AI Operations — ${payload.organization.name}`,
      activitySubtitle: date,
      facts,
      markdown: true,
      text:
        payload.totals.total === 0
          ? "All clear. No high or medium priority items today."
          : buildTotalsLine(payload),
    },
  ]

  for (const rec of payload.highlights.slice(0, MAX_HIGHLIGHTS_IN_MSG)) {
    const url = absoluteUrl(rec.entity?.href ?? rec.actions[0]?.href ?? "/ai-ops", appUrl)
    const metric = rec.metric ? ` · **${rec.metric.label}:** ${rec.metric.value}` : ""
    const entity = rec.entity?.label ? `\n_${escapeText(rec.entity.label)}_` : ""
    sections.push({
      activitySubtitle: rec.priority.toUpperCase(),
      title: rec.title,
      text: `${escapeText(rec.explanation)}${metric}${entity}`,
      markdown: true,
      potentialAction: [
        {
          "@type": "OpenUri",
          name: "Open in Equipify",
          targets: [{ os: "default", uri: url }],
        },
      ],
    })
  }

  const a = payload.recentActivity
  if (a.actedOn || a.dismissed || a.snoozed || a.drafted) {
    sections.push({
      activitySubtitle: "Last 7 days",
      text: `${a.actedOn} handled · ${a.drafted} drafted · ${a.dismissed} dismissed · ${a.snoozed} snoozed`,
      markdown: true,
    })
  }

  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: `AI Ops digest · ${payload.organization.name}`,
    themeColor: payload.totals.high > 0 ? "B91C1C" : payload.totals.total > 0 ? "B45309" : "0EA5E9",
    title: payload.totals.high > 0 ? `${payload.totals.high} high-priority item${payload.totals.high === 1 ? "" : "s"}` : "AI Operations digest",
    sections,
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "Open AI Operations",
        targets: [{ os: "default", uri: absoluteUrl("/ai-ops", appUrl) }],
      },
      {
        "@type": "OpenUri",
        name: "Manage digest settings",
        targets: [
          {
            os: "default",
            uri: absoluteUrl("/settings/notifications#ai-ops-digest", appUrl),
          },
        ],
      },
    ],
  }
}

function buildTestCard(payload: DigestPayload, appUrl: string): Record<string, unknown> {
  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: `AI Ops Teams test for ${payload.organization.name}`,
    themeColor: "10B981",
    title: "AI Ops Teams test",
    sections: [
      {
        text: `**${escapeText(
          payload.organization.name,
        )}** has wired up the Teams destination correctly. This is a one-time test message.`,
        markdown: true,
      },
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "Manage digest settings",
        targets: [
          {
            os: "default",
            uri: absoluteUrl("/settings/notifications#ai-ops-digest", appUrl),
          },
        ],
      },
    ],
  }
}

function buildTotalsLine(payload: DigestPayload): string {
  const parts: string[] = []
  if (payload.totals.high) parts.push(`**${payload.totals.high}** high`)
  if (payload.totals.medium) parts.push(`${payload.totals.medium} medium`)
  if (payload.totals.low) parts.push(`${payload.totals.low} low`)
  return `${parts.join(" · ")} — ${payload.totals.total} item${payload.totals.total === 1 ? "" : "s"} need attention.`
}

void PRIORITY_COLOR // reserved for future Adaptive Card v1.5 colored hero migration

function absoluteUrl(path: string, appUrl: string): string {
  if (!path) return appUrl || "https://app.equipify.ai"
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  if (!appUrl) return path
  return `${appUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
}

function escapeText(text: string): string {
  // Teams MessageCard markdown is forgiving but we still strip the
  // characters that consistently break the renderer.
  return text.replace(/[\\\[\]<>]/g, " ")
}
