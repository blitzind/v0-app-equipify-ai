import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { loadQuoteDocumentContext } from "@/lib/quotes/load-quote-document-context"
import { generateQuotePdfBuffer } from "@/lib/quotes/generate-quote-pdf"
import { buildQuotePdfDownloadHeaders, buildQuotePdfFilename } from "@/lib/quotes/quote-pdf-filename"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; quoteId: string }> },
) {
  const { organizationId, quoteId } = await context.params

  const gate = await requireAnyOrgPermission(organizationId, ["canEditQuotes", "canViewQuotes", "canViewFinancials"])
  if ("error" in gate) {
    return gate.error
  }

  const supabase = await createServerSupabaseClient()
  const ctx = await loadQuoteDocumentContext(supabase, organizationId, quoteId, {
    staffDocumentExport: true,
  })
  if (!ctx) {
    return NextResponse.json({ error: "not_found", message: "Quote not found." }, { status: 404 })
  }

  try {
    const bytes = await generateQuotePdfBuffer(ctx)
    const filename = buildQuotePdfFilename(ctx.quoteNumberLabel)
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: buildQuotePdfDownloadHeaders(filename),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({
        source: "quote-pdf-download",
        ok: false,
        organizationId,
        quoteId,
        error: msg.slice(0, 500),
      }),
    )
    return NextResponse.json({ error: "pdf_failed", message: "Could not generate quote PDF." }, { status: 500 })
  }
}
