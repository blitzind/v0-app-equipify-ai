import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_OUTREACH_QUEUE_CHANNELS } from "@/lib/growth/outreach/outreach-queue-types"
import { listGrowthOutreachQueueItems, listGrowthOutreachQueueItemsWithLead } from "@/lib/growth/outreach/outreach-queue-repository"
import { createGrowthOutreachQueueItem } from "@/lib/growth/outreach/run-outreach-queue"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PostSchema = z.object({
  leadId: z.string().uuid(),
  generationId: z.string().uuid().optional(),
  channel: z.enum(GROWTH_OUTREACH_QUEUE_CHANNELS).optional(),
  providerConnectionId: z.string().uuid().optional(),
})

function mapError(message: string): { status: number; code: string; message: string } {
  if (message === "not_found") return { status: 404, code: message, message: "Not found." }
  if (message === "generation_not_approved") {
    return { status: 409, code: message, message: "Generation must be approved before queueing." }
  }
  if (message === "already_queued") return { status: 409, code: message, message: "An active queue item already exists." }
  if (["suppressed", "rule_blocked", "capacity_blocked", "missing_email", "preflight_blocked"].includes(message)) {
    return { status: 409, code: message, message: "Outreach blocked by safety rules." }
  }
  return { status: 400, code: "queue_failed", message }
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const statuses = url.searchParams.get("status")?.split(",").filter(Boolean)
  const channel = url.searchParams.get("channel") ?? undefined
  const owner = url.searchParams.get("owner") ?? undefined
  const sourceVendor = url.searchParams.get("sourceVendor") ?? undefined
  const priorityTier = url.searchParams.get("priority") ?? undefined

  const leadId = url.searchParams.get("leadId") ?? undefined
  const generationId = url.searchParams.get("generationId") ?? undefined

  if (leadId && UUID_RE.test(leadId)) {
    const items = await listGrowthOutreachQueueItems(access.admin, {
      leadId,
      generationId: generationId && UUID_RE.test(generationId) ? generationId : undefined,
      limit: 20,
    })
    return NextResponse.json({ ok: true, items })
  }

  const items = await listGrowthOutreachQueueItemsWithLead(access.admin, {
    statuses: statuses as never,
    channel,
    owner,
    sourceVendor,
    priorityTier,
    limit: 100,
  })

  return NextResponse.json({ ok: true, items })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid queue payload." }, { status: 400 })
  }

  if (!UUID_RE.test(parsed.data.leadId)) {
    return NextResponse.json({ error: "invalid_lead", message: "Invalid lead id." }, { status: 400 })
  }

  try {
    const item = await createGrowthOutreachQueueItem(access.admin, {
      leadId: parsed.data.leadId,
      generationId: parsed.data.generationId,
      channel: parsed.data.channel,
      providerConnectionId: parsed.data.providerConnectionId,
      createdBy: access.userId,
      actingUserEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    const code = e instanceof Error ? e.message : "queue_failed"
    const mapped = mapError(code)
    return NextResponse.json({ error: mapped.code, message: mapped.message }, { status: mapped.status })
  }
}
