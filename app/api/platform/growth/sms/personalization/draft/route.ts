import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGrowthSmsPersonalizationArchitectureAudit } from "@/lib/growth/sms/personalization/sms-personalization-audit"
import { buildSmsInboxDraftSuggestion } from "@/lib/growth/sms/personalization/sms-inbox-draft-service"
import { GROWTH_SMS_PERSONALIZATION_QA_MARKER } from "@/lib/growth/sms/personalization/sms-personalization-audit"

export const runtime = "nodejs"

const DraftQuerySchema = z.object({
  leadId: z.string().uuid(),
  draftType: z.enum(["outbound", "reply"]).optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = DraftQuerySchema.safeParse({
    leadId: url.searchParams.get("leadId"),
    draftType: url.searchParams.get("draftType") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", message: "Provide leadId (uuid)." }, { status: 400 })
  }

  try {
    const suggestion = await buildSmsInboxDraftSuggestion(access.admin, {
      leadId: parsed.data.leadId,
      draftType: parsed.data.draftType ?? "reply",
    })

    if (!suggestion) {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_SMS_PERSONALIZATION_QA_MARKER,
      suggestion,
      architecture: buildGrowthSmsPersonalizationArchitectureAudit(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "sms_draft_failed", message }, { status: 500 })
  }
}
