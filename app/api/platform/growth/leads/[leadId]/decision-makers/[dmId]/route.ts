import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  deleteGrowthLeadDecisionMaker,
  updateGrowthLeadDecisionMaker,
} from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"

export const runtime = "nodejs"

const optionalText = z.string().trim().max(500).optional().nullable()

const UpdateDecisionMakerSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    title: optionalText,
    email: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
    phone: optionalText,
    linkedinUrl: z.string().trim().max(500).optional().nullable(),
    status: z.enum(["suspected", "confirmed", "rejected"]).optional(),
    isPrimary: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "empty_patch" })

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string; dmId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, dmId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success || !z.string().uuid().safeParse(dmId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Lead and decision maker ids must be UUIDs." }, { status: 400 })
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = UpdateDecisionMakerSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid decision maker update." }, { status: 400 })
  }

  try {
    const lead = await fetchGrowthLeadById(access.admin, leadId)
    if (!lead) {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }

    const decisionMaker = await updateGrowthLeadDecisionMaker(access.admin, leadId, dmId, {
      fullName: parsed.data.fullName,
      title: parsed.data.title,
      email: parsed.data.email !== undefined ? (parsed.data.email?.trim() ? parsed.data.email.trim() : null) : undefined,
      phone: parsed.data.phone,
      linkedinUrl: parsed.data.linkedinUrl,
      status: parsed.data.status,
      isPrimary: parsed.data.isPrimary,
    })

    if (!decisionMaker) {
      return NextResponse.json({ error: "not_found", message: "Decision maker not found." }, { status: 404 })
    }

    const updatedLead = await recomputeGrowthLeadWorkflowSignals(access.admin, leadId)

    logGrowthEngine("decision_maker_updated", {
      leadId,
      decisionMakerId: dmId,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, decisionMaker, lead: updatedLead })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ leadId: string; dmId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, dmId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success || !z.string().uuid().safeParse(dmId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Lead and decision maker ids must be UUIDs." }, { status: 400 })
  }

  try {
    const deleted = await deleteGrowthLeadDecisionMaker(access.admin, leadId, dmId)
    if (!deleted) {
      return NextResponse.json({ error: "not_found", message: "Decision maker not found." }, { status: 404 })
    }

    const updatedLead = await recomputeGrowthLeadWorkflowSignals(access.admin, leadId)

    logGrowthEngine("decision_maker_deleted", {
      leadId,
      decisionMakerId: dmId,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, lead: updatedLead })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "delete_failed", message }, { status: 500 })
  }
}
