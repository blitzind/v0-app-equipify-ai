import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthOutboundRepliesForLead } from "@/lib/growth/outbound/reply-repository"
import {
  buildReplyCopilotAssist,
  mapMemoryInfluenceToReplyCopilotRelationship,
} from "@/lib/growth/reply-intelligence/reply-copilot-service"

export const runtime = "nodejs"

async function buildCopilotAssistForLead(
  admin: SupabaseClient,
  input: {
    leadId: string
    bodyPreview: string | null | undefined
    companyName?: string | null
    contactLabel?: string | null
  },
) {
  const memory = await buildLeadMemoryInfluenceContext(admin, input.leadId).catch(() => null)
  return buildReplyCopilotAssist({
    bodyPreview: input.bodyPreview,
    companyName: input.companyName,
    contactLabel: input.contactLabel,
    relationshipMemory: mapMemoryInfluenceToReplyCopilotRelationship(memory),
  })
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const replyId = url.searchParams.get("replyId")
  const leadId = url.searchParams.get("leadId")

  try {
    if (replyId && z.string().uuid().safeParse(replyId).success) {
      const { data, error } = await access.admin
        .schema("growth")
        .from("outbound_replies")
        .select("body_preview, lead_id")
        .eq("id", replyId)
        .maybeSingle()
      if (error || !data) {
        return NextResponse.json({ error: "not_found", message: "Reply not found." }, { status: 404 })
      }
      const resolvedLeadId = String((data as { lead_id: string }).lead_id)
      const lead = await fetchGrowthLeadById(access.admin, resolvedLeadId)
      const assist = await buildCopilotAssistForLead(access.admin, {
        leadId: resolvedLeadId,
        bodyPreview: (data as { body_preview?: string | null }).body_preview,
        companyName: lead?.companyName,
        contactLabel: lead?.contactName,
      })
      return NextResponse.json({ ok: true, assist })
    }

    if (leadId && z.string().uuid().safeParse(leadId).success) {
      const lead = await fetchGrowthLeadById(access.admin, leadId)
      const replies = await listGrowthOutboundRepliesForLead(access.admin, leadId, 1)
      const assist = await buildCopilotAssistForLead(access.admin, {
        leadId,
        bodyPreview: replies[0]?.bodyPreview,
        companyName: lead?.companyName,
        contactLabel: lead?.contactName,
      })
      return NextResponse.json({ ok: true, assist })
    }

    return NextResponse.json({ error: "invalid_request", message: "Provide replyId or leadId." }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not build reply copilot assist." }, { status: 500 })
  }
}
