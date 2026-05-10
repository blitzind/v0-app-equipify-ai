/**
 * AI Ops Phase 3 — internal digest email template.
 *
 * **Internal-only**: this template is never used for customer-facing
 * communication. The recipient list is staff emails configured in
 * `ai_ops_digest_settings.recipients`. We deliberately keep the
 * styling neutral (no marketing language, no customer-facing copy)
 * because the digest doubles as a Slack/Teams message body in
 * future phases.
 */

import { escapeHtml } from "@/lib/email/format"
import { wrapEquipifyEmail } from "@/lib/email/templates"
import type { DigestPayload } from "@/lib/ai-ops/digest"
import type { Recommendation, RecommendationCategory } from "@/lib/ai-ops/types"

const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
  prospect: "Prospects",
  financial: "Financials",
  dispatch: "Dispatch",
  equipment: "Equipment",
  certificate: "Certificates",
  inventory: "Inventory",
  communications: "Communications",
  automation: "Automations",
  maintenance: "Maintenance",
}

const PRIORITY_COLOR: Record<Recommendation["priority"], string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#0284c7",
}

export type RenderDigestArgs = {
  payload: DigestPayload
  /** Public, no-secret app URL (e.g. https://app.equipify.ai). */
  appUrl: string
  /** Optional AI-generated intro paragraph. Falls back to a deterministic header. */
  aiIntro?: string | null
}

export function renderAiOpsDigestEmail(args: RenderDigestArgs): {
  subject: string
  html: string
  text: string
} {
  const { payload } = args
  const date = new Date(payload.generatedAtIso)
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  const subject = buildSubject(payload, dateLabel)

  const intro =
    args.aiIntro?.trim() ||
    deterministicIntro(payload)

  const inner = [
    headerHtml(payload, dateLabel, intro),
    totalsHtml(payload),
    highlightsHtml(payload, args.appUrl),
    categoriesHtml(payload, args.appUrl),
    activityHtml(payload),
    footerHtml(payload, args.appUrl),
  ].join("\n")

  const html = wrapEquipifyEmail(
    payload.organization.name,
    inner,
    "Internal AI Operations digest. This message is sent only to your configured staff recipients.",
  )

  const text = buildPlainText(payload, dateLabel, intro, args.appUrl)

  return { subject, html, text }
}

function buildSubject(payload: DigestPayload, dateLabel: string): string {
  if (payload.totals.total === 0) {
    return `AI Ops digest · ${dateLabel} · nothing urgent`
  }
  const high = payload.totals.high
  if (high > 0) return `AI Ops digest · ${dateLabel} · ${high} high-priority`
  return `AI Ops digest · ${dateLabel} · ${payload.totals.total} action${payload.totals.total === 1 ? "" : "s"}`
}

function deterministicIntro(payload: DigestPayload): string {
  if (payload.totals.total === 0) {
    return "All clear. No high or medium priority items today — keep it up."
  }
  const parts: string[] = []
  if (payload.totals.high > 0) {
    parts.push(`${payload.totals.high} high-priority`)
  }
  if (payload.totals.medium > 0) {
    parts.push(`${payload.totals.medium} medium-priority`)
  }
  if (payload.totals.low > 0) {
    parts.push(`${payload.totals.low} low-priority`)
  }
  return `${parts.join(" · ")} item${payload.totals.total === 1 ? "" : "s"} need attention today.`
}

function headerHtml(payload: DigestPayload, dateLabel: string, intro: string): string {
  return `
<div style="border-left:4px solid #6d28d9;padding:12px 16px;background:#f5f3ff;border-radius:6px;margin-bottom:16px;">
  <p style="margin:0;font-size:11px;letter-spacing:0.05em;text-transform:uppercase;color:#6d28d9;font-weight:600;">
    AI Operations · ${escapeHtml(dateLabel)}
  </p>
  <p style="margin:6px 0 0;font-size:15px;font-weight:600;color:#0f172a;">
    ${escapeHtml(payload.organization.name)}
  </p>
  <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#334155;">
    ${escapeHtml(intro)}
  </p>
</div>`.trim()
}

function totalsHtml(payload: DigestPayload): string {
  const cells: Array<[string, number, string]> = [
    ["High", payload.totals.high, PRIORITY_COLOR.high],
    ["Medium", payload.totals.medium, PRIORITY_COLOR.medium],
    ["Low", payload.totals.low, PRIORITY_COLOR.low],
    ["Total", payload.totals.total, "#475569"],
  ]
  const tds = cells
    .map(
      ([label, value, color]) => `
<td style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;text-align:center;background:#fff;">
  <div style="font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(label)}</div>
  <div style="font-size:18px;font-weight:700;color:${color};margin-top:2px;">${value}</div>
</td>`.trim(),
    )
    .join("")
  return `
<table cellpadding="0" cellspacing="6" style="border-collapse:separate;width:100%;margin-bottom:16px;">
  <tr>${tds}</tr>
</table>`.trim()
}

function highlightsHtml(payload: DigestPayload, appUrl: string): string {
  if (payload.highlights.length === 0) return ""
  const rows = payload.highlights
    .map((rec) => recommendationRowHtml(rec, appUrl))
    .join("\n")
  return `
<h2 style="margin:18px 0 8px;font-size:14px;color:#0f172a;font-weight:600;">Top focus items</h2>
${rows}`.trim()
}

function recommendationRowHtml(rec: Recommendation, appUrl: string): string {
  const href = absoluteUrl(rec.entity?.href ?? rec.actions[0]?.href ?? "/ai-ops", appUrl)
  const priorityColor = PRIORITY_COLOR[rec.priority]
  const metricLabel = rec.metric ? ` · <strong>${escapeHtml(rec.metric.label)}: ${escapeHtml(rec.metric.value)}</strong>` : ""
  const entityLabel = rec.entity?.label ? `<br/><span style="font-size:12px;color:#64748b;">${escapeHtml(rec.entity.label)}</span>` : ""
  return `
<table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:6px;margin:6px 0;">
  <tr>
    <td style="padding:10px 14px;background:#fff;">
      <div style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:#fff;background:${priorityColor};font-weight:600;">${escapeHtml(rec.priority)}</div>
      <span style="margin-left:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#94a3b8;">${escapeHtml(CATEGORY_LABEL[rec.category])}</span>
      <p style="margin:6px 0 4px;font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(rec.title)}</p>
      <p style="margin:0;font-size:12px;color:#475569;line-height:1.5;">${escapeHtml(rec.explanation)}${metricLabel}${entityLabel}</p>
      <p style="margin:8px 0 0;font-size:12px;">
        <a href="${escapeHtml(href)}" style="color:#6d28d9;text-decoration:none;font-weight:600;">Open in Equipify →</a>
      </p>
    </td>
  </tr>
</table>`.trim()
}

function categoriesHtml(payload: DigestPayload, appUrl: string): string {
  const remaining = payload.byCategory
    .map(({ category, items }) => {
      const tail = items.slice(0, 4) // keep emails compact
      if (tail.length === 0) return ""
      const lis = tail
        .map((rec) => {
          const href = absoluteUrl(rec.entity?.href ?? rec.actions[0]?.href ?? "/ai-ops", appUrl)
          const metric = rec.metric ? ` <span style="color:#94a3b8;">· ${escapeHtml(rec.metric.value)}</span>` : ""
          return `<li style="margin:4px 0;font-size:12px;color:#334155;line-height:1.5;">
  <a href="${escapeHtml(href)}" style="color:#0f172a;text-decoration:none;font-weight:500;">${escapeHtml(rec.title)}</a>${metric}
</li>`
        })
        .join("")
      const more = items.length > tail.length ? `<li style="margin:4px 0;font-size:11px;color:#94a3b8;">+ ${items.length - tail.length} more in Equipify</li>` : ""
      return `
<div style="margin:14px 0;">
  <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#6d28d9;font-weight:600;">${escapeHtml(CATEGORY_LABEL[category])}</p>
  <ul style="padding-left:18px;margin:0;">${lis}${more}</ul>
</div>`.trim()
    })
    .filter(Boolean)
    .join("")
  return remaining ? `<h2 style="margin:24px 0 4px;font-size:14px;color:#0f172a;font-weight:600;">By category</h2>${remaining}` : ""
}

function activityHtml(payload: DigestPayload): string {
  const a = payload.recentActivity
  if (!(a.actedOn || a.dismissed || a.snoozed || a.drafted)) return ""
  const segments: string[] = []
  if (a.actedOn) segments.push(`<strong>${a.actedOn}</strong> handled`)
  if (a.drafted) segments.push(`<strong>${a.drafted}</strong> drafts created`)
  if (a.dismissed) segments.push(`<strong>${a.dismissed}</strong> dismissed`)
  if (a.snoozed) segments.push(`<strong>${a.snoozed}</strong> snoozed`)
  return `
<div style="margin:24px 0 0;padding:10px 14px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:12px;color:#475569;line-height:1.5;">
  Last 7 days: ${segments.join(" · ")}
</div>`.trim()
}

function footerHtml(payload: DigestPayload, appUrl: string): string {
  const url = absoluteUrl("/ai-ops", appUrl)
  const settingsUrl = absoluteUrl("/settings/notifications#ai-ops-digest", appUrl)
  return `
<p style="margin:24px 0 0;font-size:12px;color:#475569;line-height:1.5;">
  <a href="${escapeHtml(url)}" style="color:#6d28d9;text-decoration:none;font-weight:600;">Open AI Operations →</a>
  <span style="color:#cbd5e1;">·</span>
  <a href="${escapeHtml(settingsUrl)}" style="color:#475569;text-decoration:none;">Manage digest settings</a>
</p>
<p style="margin:6px 0 0;font-size:11px;color:#94a3b8;">
  Generated ${escapeHtml(new Date(payload.generatedAtIso).toLocaleString())} ·
  Timezone ${escapeHtml(payload.organization.timezone)}
</p>`.trim()
}

function absoluteUrl(path: string, appUrl: string): string {
  if (!path) return appUrl
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  if (!appUrl) return path
  return `${appUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
}

function buildPlainText(
  payload: DigestPayload,
  dateLabel: string,
  intro: string,
  appUrl: string,
): string {
  const lines: string[] = []
  lines.push(`AI Operations Digest — ${payload.organization.name} — ${dateLabel}`)
  lines.push("")
  lines.push(intro)
  lines.push("")
  lines.push(
    `High ${payload.totals.high} · Medium ${payload.totals.medium} · Low ${payload.totals.low} · Total ${payload.totals.total}`,
  )
  if (payload.highlights.length > 0) {
    lines.push("")
    lines.push("Top focus items:")
    for (const rec of payload.highlights) {
      const metric = rec.metric ? ` (${rec.metric.label}: ${rec.metric.value})` : ""
      lines.push(`- [${rec.priority.toUpperCase()}] ${rec.title}${metric}`)
      if (rec.entity?.label) lines.push(`  · ${rec.entity.label}`)
    }
  }
  lines.push("")
  lines.push(`Open AI Operations → ${absoluteUrl("/ai-ops", appUrl)}`)
  lines.push(`Manage digest settings → ${absoluteUrl("/settings/notifications#ai-ops-digest", appUrl)}`)
  return lines.join("\n")
}
