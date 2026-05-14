import "server-only"

import { escapeHtml, plainTextToHtml } from "@/lib/email/format"
import { getSupportEmailRecipient, isOutboundEmailConfigured } from "@/lib/email/config"
import { sendEmail } from "@/lib/email/resend"
import { wrapEquipifyEmail } from "@/lib/email/wrap-equipify-email"

const LOG_SOURCE = "aiden-feature-request-notify"

function logLine(payload: Record<string, unknown>, level: "info" | "error" = "info") {
  const line = JSON.stringify({ source: LOG_SOURCE, ...payload })
  if (level === "error") console.error(line)
  else console.info(line)
}

export type FeatureRequestSupportNotifyParams = {
  requestId: string
  organizationId: string
  organizationName: string
  userId: string
  userEmail: string | null
  userDisplayName: string | null
  title: string
  originalQuestion: string
  module: string | null
  currentPath: string | null
  priority: string
  submissionKind: "draft" | "manual"
  submittedAtIso: string
}

/**
 * Sends internal support mail for a newly saved AIden feature request.
 * Never throws: callers should treat DB save as success regardless of mail outcome.
 */
export async function notifySupportNewFeatureRequest(params: FeatureRequestSupportNotifyParams): Promise<void> {
  const supportTo = getSupportEmailRecipient()

  if (!isOutboundEmailConfigured()) {
    logLine({
      event: "email_skipped",
      reason: "outbound_email_not_configured",
      requestId: params.requestId,
      organizationId: params.organizationId,
      userId: params.userId,
      supportRecipientDomain: supportTo.split("@")[1] ?? "unknown",
    })
    return
  }

  const subject = `[Equipify] Feature request · ${params.title.slice(0, 80)}${params.title.length > 80 ? "…" : ""}`

  const metaRows = [
    ["Submitted at (UTC)", params.submittedAtIso],
    ["Organization", `${params.organizationName} (${params.organizationId})`],
    ["User", `${params.userDisplayName?.trim() || "—"} · ${params.userEmail?.trim() || "—"} (${params.userId})`],
    ["Request id", params.requestId],
    ["Submission kind", params.submissionKind],
    ["Priority", params.priority],
    ["Module", params.module?.trim() || "—"],
    ["Current path", params.currentPath?.trim() || "—"],
  ]

  const metaHtml = metaRows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#334155;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:6px 0;color:#0f172a;">${escapeHtml(v)}</td></tr>`,
    )
    .join("")

  const bodyBlock = `
<h1 style="font-size:18px;margin:0 0 12px;color:#0f172a;">New AIden feature request</h1>
<table style="border-collapse:collapse;margin:0 0 16px;width:100%;">${metaHtml}</table>
<h2 style="font-size:15px;margin:16px 0 8px;color:#0f172a;">${escapeHtml(params.title)}</h2>
<div style="margin:0 0 8px;color:#334155;">${plainTextToHtml(params.originalQuestion)}</div>
`

  const html = wrapEquipifyEmail(
    params.organizationName,
    bodyBlock,
    "This message was generated when a workspace member submitted product feedback from AIden.",
    { transactionalClosing: true },
  )

  const textLines = [
    "New AIden feature request",
    "",
    ...metaRows.map(([k, v]) => `${k}: ${v}`),
    "",
    params.title,
    "",
    params.originalQuestion,
  ]

  try {
    const result = await sendEmail({
      to: supportTo,
      subject,
      html,
      text: textLines.join("\n"),
      category: "aiden_feature_request_support",
      organizationId: params.organizationId,
    })

    if (!result.ok) {
      logLine(
        {
          event: "email_send_failed",
          requestId: params.requestId,
          organizationId: params.organizationId,
          userId: params.userId,
          code: result.code ?? "unknown",
          error: result.error,
        },
        "error",
      )
      return
    }

    logLine({
      event: "email_send_succeeded",
      requestId: params.requestId,
      organizationId: params.organizationId,
      userId: params.userId,
      providerMessageId: result.id ?? null,
      recipient: supportTo,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logLine(
      {
        event: "email_send_exception",
        requestId: params.requestId,
        organizationId: params.organizationId,
        userId: params.userId,
        error: message.slice(0, 500),
      },
      "error",
    )
  }
}
