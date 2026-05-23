import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthOutboundCampaignById } from "@/lib/growth/outbound/campaign-repository"
import { listGrowthOutboundContactsForLead } from "@/lib/growth/outbound/contact-repository"
import { listGrowthOutboundMessagesForLead } from "@/lib/growth/outbound/message-repository"
import { listGrowthOutboundRepliesForLead } from "@/lib/growth/outbound/reply-repository"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!UUID_RE.test(leadId)) {
    return NextResponse.json({ error: "invalid_lead", message: "Invalid lead id." }, { status: 400 })
  }

  try {
    const [contacts, messages, replies] = await Promise.all([
      listGrowthOutboundContactsForLead(access.admin, leadId),
      listGrowthOutboundMessagesForLead(access.admin, leadId),
      listGrowthOutboundRepliesForLead(access.admin, leadId),
    ])

    const campaignIds = [...new Set(contacts.map((c) => c.campaignId).filter(Boolean))] as string[]
    const campaigns = (
      await Promise.all(campaignIds.map((id) => fetchGrowthOutboundCampaignById(access.admin, id)))
    ).filter(Boolean)

    return NextResponse.json({ ok: true, contacts, messages, replies, campaigns })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
