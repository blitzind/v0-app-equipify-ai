import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createGrowthLeadDecisionMaker,
  listGrowthLeadDecisionMakers,
} from "@/lib/growth/decision-maker-repository"
import { GROWTH_DECISION_MAKER_SOURCES } from "@/lib/growth/decision-maker-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"

export const runtime = "nodejs"

const optionalText = z.string().trim().max(500).optional().nullable()

const CreateDecisionMakerSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  title: optionalText,
  email: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
  phone: optionalText,
  linkedinUrl: z.string().trim().max(500).optional().nullable(),
  source: z.enum(GROWTH_DECISION_MAKER_SOURCES).optional(),
  sourceDetail: optionalText,
  confidence: z.number().min(0).max(1).optional().nullable(),
  evidenceExcerpt: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["suspected", "confirmed"]).optional(),
  isPrimary: z.boolean().optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_lead_id", message: "Lead id must be a UUID." }, { status: 400 })
  }

  try {
    const lead = await fetchGrowthLeadById(access.admin, leadId)
    if (!lead) {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }

    const decisionMakers = await listGrowthLeadDecisionMakers(access.admin, leadId)
    return NextResponse.json({ ok: true, decisionMakers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}

export async function POST(
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
  const parsed = CreateDecisionMakerSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid decision maker payload." }, { status: 400 })
  }

  try {
    const lead = await fetchGrowthLeadById(access.admin, leadId)
    if (!lead) {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }

    const decisionMaker = await createGrowthLeadDecisionMaker(access.admin, {
      leadId,
      fullName: parsed.data.fullName,
      title: parsed.data.title,
      email: parsed.data.email?.trim() ? parsed.data.email.trim() : null,
      phone: parsed.data.phone,
      linkedinUrl: parsed.data.linkedinUrl,
      source: parsed.data.source ?? "manual",
      sourceDetail: parsed.data.sourceDetail,
      confidence: parsed.data.confidence,
      evidenceExcerpt: parsed.data.evidenceExcerpt,
      status: parsed.data.status ?? "suspected",
      isPrimary: parsed.data.isPrimary,
      createdBy: access.userId,
    })

    const updatedLead = await recomputeGrowthLeadWorkflowSignals(access.admin, leadId)

    logGrowthEngine("decision_maker_created", {
      leadId,
      decisionMakerId: decisionMaker.id,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, decisionMaker, lead: updatedLead }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
