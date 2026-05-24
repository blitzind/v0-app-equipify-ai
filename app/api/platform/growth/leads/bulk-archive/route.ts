import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { archiveGrowthLeads, fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { emitGrowthLeadStatusChangedTimeline } from "@/lib/growth/timeline-emitter"

export const runtime = "nodejs"

const BodySchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(100),
  reason: z.string().trim().max(500).optional().nullable(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid bulk archive payload." }, { status: 400 })
  }

  try {
    const existing = await Promise.all(
      parsed.data.leadIds.map((leadId) => fetchGrowthLeadById(access.admin, leadId)),
    )
    const archived = await archiveGrowthLeads(access.admin, {
      leadIds: parsed.data.leadIds,
      archivedBy: access.userId,
      reason: parsed.data.reason,
    })

    for (const lead of archived) {
      const prior = existing.find((item) => item?.id === lead.id)
      if (prior && prior.status !== "archived") {
        await emitGrowthLeadStatusChangedTimeline(access.admin, {
          leadId: lead.id,
          from: prior.status,
          to: "archived",
          actor: { userId: access.userId, email: access.userEmail },
        })
      }
    }

    logGrowthEngine("lead_bulk_archive_success", {
      count: archived.length,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, archived, archivedCount: archived.length })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "archive_failed", message }, { status: 500 })
  }
}
