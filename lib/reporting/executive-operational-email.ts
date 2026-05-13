import "server-only"

import { sendEmail } from "@/lib/email/resend"
import type { SendEmailResult } from "@/lib/email/resend"
import type { ExecutiveOperationalCadence, ExecutiveOperationalEmailPayload } from "@/lib/reporting/executive-operational-report-types"

export type SendExecutiveOperationalReportEmailArgs = {
  to: string | string[]
  payload: ExecutiveOperationalEmailPayload
  organizationId: string
}

/**
 * Uses the existing Resend pipeline. Callers must surface config errors to operators
 * (missing `RESEND_API_KEY` / `EMAIL_FROM_ADDRESS`) — no silent success.
 */
export async function sendExecutiveOperationalReportEmail(
  args: SendExecutiveOperationalReportEmailArgs,
): Promise<SendEmailResult> {
  return sendEmail({
    to: args.to,
    subject: args.payload.subject,
    html: args.payload.htmlBody,
    text: args.payload.textBody,
    category: "executive_operational_report",
    organizationId: args.organizationId,
  })
}

export function buildExecutiveOperationalEmailPayload(args: {
  reportTitleOrg: string
  cadence: ExecutiveOperationalCadence
  htmlBody: string
  textBody: string
  organizationId: string
}): ExecutiveOperationalEmailPayload {
  const cadenceLabel = args.cadence === "weekly" ? "Weekly" : "Monthly"
  return {
    subject: `${cadenceLabel} executive ops — ${args.reportTitleOrg}`,
    htmlBody: args.htmlBody,
    textBody: args.textBody,
    organizationId: args.organizationId,
    cadence: args.cadence,
  }
}
