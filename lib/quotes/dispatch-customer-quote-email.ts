import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail, type SendEmailResult } from "@/lib/email/resend"
import { buildQuoteEmailContent } from "@/lib/email/templates"
import { loadQuoteDocumentContext } from "@/lib/quotes/load-quote-document-context"
import { generateQuotePdfBuffer } from "@/lib/quotes/generate-quote-pdf"
import { buildQuotePdfFilename } from "@/lib/quotes/quote-pdf-filename"
import type { QuoteDocumentContext } from "@/lib/quotes/quote-document-context"

export type DispatchCustomerQuoteEmailArgs = {
  supabase: SupabaseClient
  organizationId: string
  quoteId: string
  to: string
  subjectOverride?: string
  messagePlain?: string
  variant: "send" | "resend"
  /** Skip DB load when the caller already hydrated document context. */
  documentContext?: QuoteDocumentContext
}

export type DispatchCustomerQuoteEmailResult =
  | { ok: true; send: SendEmailResult & { ok: true }; pdfAttached: boolean }
  | { ok: false; code: string; message: string }

/**
 * Loads quote document context, builds the customer email, generates a PDF attachment,
 * and sends via Resend.
 */
export async function dispatchCustomerQuoteEmail(
  args: DispatchCustomerQuoteEmailArgs,
): Promise<DispatchCustomerQuoteEmailResult> {
  const ctx =
    args.documentContext ??
    (await loadQuoteDocumentContext(args.supabase, args.organizationId, args.quoteId))
  if (!ctx) {
    return { ok: false, code: "not_found", message: "Quote not found." }
  }

  let pdfAttached = false
  let attachments: Array<{ filename: string; content: Buffer; contentType: string }> | undefined
  try {
    const bytes = await generateQuotePdfBuffer(ctx)
    const buf = Buffer.from(bytes)
    if (buf.byteLength > 0) {
      pdfAttached = true
      attachments = [
        {
          filename: buildQuotePdfFilename(ctx.quoteNumberLabel),
          content: buf,
          contentType: "application/pdf",
        },
      ]
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({
        source: "quote-pdf-generation",
        ok: false,
        organizationId: args.organizationId,
        quoteId: args.quoteId,
        error: msg.slice(0, 500),
      }),
    )
  }

  const amountLabel = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    ctx.totalCents / 100,
  )

  const scopeSummary = [ctx.equipmentName ? `Equipment: ${ctx.equipmentName}` : null, ctx.customerNotes?.slice(0, 200)]
    .filter(Boolean)
    .join(" · ") || undefined

  const { subject, html, text } = buildQuoteEmailContent({
    organizationName: ctx.organizationName,
    customerName: ctx.customerCompanyName,
    quoteLabel: ctx.quoteNumberLabel,
    amountLabel,
    expiresLabel: ctx.expiresDateLabel,
    scopeSummary,
    messagePlain: args.messagePlain,
    subjectOverride: args.subjectOverride,
    pdfAttached,
  })

  const send = await sendEmail({
    to: args.to,
    subject,
    html,
    text,
    attachments,
    category: "quote_customer",
    organizationId: args.organizationId,
  })

  if (!send.ok) {
    return {
      ok: false,
      code: send.code ?? "send_failed",
      message: send.error,
    }
  }

  return { ok: true, send: send as SendEmailResult & { ok: true }, pdfAttached }
}
