import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { createGrowthLead, isGrowthLeadArchiveSchemaReady, listGrowthLeads } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { emitGrowthLeadCreatedTimeline } from "@/lib/growth/timeline-emitter"
import { GROWTH_LEAD_SOURCE_KINDS, GROWTH_LEAD_STATUSES, GROWTH_LEAD_RESEARCH_PRIORITIES } from "@/lib/growth/types"

export const runtime = "nodejs"

const optionalText = z.string().trim().max(500).optional().nullable()
const optionalLongText = z.string().trim().max(4000).optional().nullable()

const CreateLeadSchema = z.object({
  sourceKind: z.enum(GROWTH_LEAD_SOURCE_KINDS).optional(),
  sourceDetail: optionalText,
  externalRef: z.string().trim().max(200).optional().nullable(),
  companyName: z.string().trim().min(1).max(200),
  contactName: optionalText,
  contactEmail: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
  contactPhone: optionalText,
  website: z.string().trim().max(500).optional().nullable(),
  addressLine1: optionalText,
  city: optionalText,
  state: optionalText,
  postalCode: optionalText,
  country: optionalText,
  status: z.enum(GROWTH_LEAD_STATUSES).optional(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  notes: optionalLongText,
  researchPriority: z.enum(GROWTH_LEAD_RESEARCH_PRIORITIES).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  sourceChannel: optionalText,
  sourceCampaign: optionalText,
  sourceVendor: optionalText,
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const statusParam = url.searchParams.get("status")
  const statusParsed =
    statusParam && GROWTH_LEAD_STATUSES.includes(statusParam as (typeof GROWTH_LEAD_STATUSES)[number])
      ? (statusParam as (typeof GROWTH_LEAD_STATUSES)[number])
      : undefined

  try {
    const [leads, archiveSchemaReady] = await Promise.all([
      listGrowthLeads(access.admin, { status: statusParsed }),
      isGrowthLeadArchiveSchemaReady(access.admin),
    ])
    logGrowthEngine("lead_list_success", {
      count: leads.length,
      statusFilter: statusParsed ?? null,
      archiveSchemaReady,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, leads, meta: { archiveSchemaReady } })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = CreateLeadSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Provide companyName and optional lead fields." },
      { status: 400 },
    )
  }

  const body = parsed.data
  const contactEmail = body.contactEmail?.trim() ? body.contactEmail.trim() : null

  try {
    const lead = await createGrowthLead(access.admin, {
      sourceKind: body.sourceKind,
      sourceDetail: body.sourceDetail,
      externalRef: body.externalRef,
      companyName: body.companyName,
      contactName: body.contactName,
      contactEmail,
      contactPhone: body.contactPhone,
      website: body.website,
      addressLine1: body.addressLine1,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      country: body.country,
      status: body.status,
      score: body.score ?? null,
      notes: body.notes,
      researchPriority: body.researchPriority,
      assignedTo: body.assignedTo,
      sourceChannel: body.sourceChannel,
      sourceCampaign: body.sourceCampaign,
      sourceVendor: body.sourceVendor,
      createdBy: access.userId,
    })

    await emitGrowthLeadCreatedTimeline(access.admin, {
      leadId: lead.id,
      companyName: lead.companyName,
      sourceKind: lead.sourceKind,
      actor: { userId: access.userId, email: access.userEmail },
    })

    const enrichedLead = (await recomputeGrowthLeadWorkflowSignals(access.admin, lead.id)) ?? lead

    logGrowthEngine("lead_create_success", {
      leadId: lead.id,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, lead: enrichedLead }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message === "company_name_required") {
      return NextResponse.json({ error: "invalid_body", message: "Company name is required." }, { status: 400 })
    }
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
