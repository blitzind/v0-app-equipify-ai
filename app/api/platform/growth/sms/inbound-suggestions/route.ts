import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchInboundSmsResponseSuggestions } from "@/lib/growth/sms/inbound-sms-response-suggestion-service"
import { buildInboundSmsResponseSuggestionArchitectureAudit } from "@/lib/growth/sms/inbound-sms-response-suggestions"
import { GROWTH_SMS_INBOUND_RESPONSE_SUGGESTIONS_QA_MARKER } from "@/lib/growth/sms/inbound-sms-response-suggestion-types"

export const runtime = "nodejs"

const QuerySchema = z.object({
  leadId: z.string().uuid(),
  threadId: z.string().uuid().optional(),
  inboundBody: z.string().min(1).max(1600).optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    leadId: url.searchParams.get("leadId"),
    threadId: url.searchParams.get("threadId") ?? undefined,
    inboundBody: url.searchParams.get("inboundBody") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "Provide leadId (uuid). Optional: threadId, inboundBody." },
      { status: 400 },
    )
  }

  try {
    const suggestions = await fetchInboundSmsResponseSuggestions(access.admin, {
      leadId: parsed.data.leadId,
      threadId: parsed.data.threadId,
      inboundBody: parsed.data.inboundBody,
    })

    if (!suggestions) {
      return NextResponse.json(
        { error: "not_found", message: "Lead not found or no inbound SMS body available." },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_SMS_INBOUND_RESPONSE_SUGGESTIONS_QA_MARKER,
      suggestions,
      architecture: buildInboundSmsResponseSuggestionArchitectureAudit(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "sms_inbound_suggestions_failed", message }, { status: 500 })
  }
}
