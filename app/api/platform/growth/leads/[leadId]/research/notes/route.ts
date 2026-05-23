import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { upsertGrowthLeadResearchNotes } from "@/lib/growth/research-repository"

export const runtime = "nodejs"

const PatchSchema = z.object({
  body: z.string().max(8000),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_lead_id", message: "Lead id must be a UUID." }, { status: 400 })
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Provide body text for manual notes." }, { status: 400 })
  }

  try {
    const lead = await fetchGrowthLeadById(access.admin, leadId)
    if (!lead) {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }

    const manualNotes = await upsertGrowthLeadResearchNotes(access.admin, {
      leadId,
      body: parsed.data.body,
      updatedBy: access.userId,
    })

    logGrowthEngine("research_notes_api_success", {
      leadId,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, manualNotes })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
