import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { processBrowserIntakeProspectQueue } from "@/lib/growth/browser-intake/process-browser-intake-prospect-queue"
import {
  GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_ACTIONS,
  GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_ITEM_KINDS,
  GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_QA_MARKER,
} from "@/lib/growth/browser-intake/prospect-queue-types"
import { GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS } from "@/lib/growth/browser-intake/browser-intake-types"

export const runtime = "nodejs"

const QueueItemSchema = z.object({
  queue_item_id: z.string().trim().min(1).max(120),
  kind: z.enum(GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_ITEM_KINDS),
  company_name: z.string().trim().min(1).max(200),
  contact_name: z.string().trim().max(200).optional().nullable(),
  title: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable(),
  website: z.string().trim().max(500).optional().nullable(),
  linkedin_url: z.string().trim().max(500).optional().nullable(),
  source_url: z.string().trim().max(2000).optional().nullable(),
  source_platform: z.enum(GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS).optional().nullable(),
  page_title: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  queued_at: z.string().trim().max(40),
})

const ProspectQueueSchema = z.object({
  action: z.enum(GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_ACTIONS),
  items: z.array(QueueItemSchema).min(1).max(25),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = ProspectQueueSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid prospect queue payload." },
      { status: 400 },
    )
  }

  const body = parsed.data
  const items = body.items.map((item) => ({
    ...item,
    email: item.email?.trim() ? item.email.trim().toLowerCase() : null,
  }))

  try {
    const result = await processBrowserIntakeProspectQueue(access.admin, {
      action: body.action,
      items,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    logGrowthEngine("browser_intake_prospect_queue_api", {
      action: body.action,
      itemCount: items.length,
      successCount: result.success_count,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_QA_MARKER,
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: "prospect_queue_failed", message }, { status: 500 })
  }
}
