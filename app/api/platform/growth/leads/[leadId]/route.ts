import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadById, updateGrowthLead, archiveGrowthLeads } from "@/lib/growth/lead-repository"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import {
  emitGrowthLeadNotesUpdatedTimeline,
  emitGrowthLeadOverrideChangedTimeline,
  emitGrowthLeadStatusChangedTimeline,
  emitGrowthLeadWebsiteChangedTimeline,
} from "@/lib/growth/timeline-emitter"
import {
  friendlyLeadContactValidationError,
  normalizeLeadContactPhone,
  normalizeLeadContactWebsite,
  validateLeadContactEmail,
} from "@/lib/growth/lead-contact-validation"
import { GROWTH_LEAD_SOURCE_KINDS, GROWTH_LEAD_STATUSES, GROWTH_LEAD_RESEARCH_PRIORITIES } from "@/lib/growth/types"

export const runtime = "nodejs"

const optionalText = z.string().trim().max(500).optional().nullable()
const optionalLongText = z.string().trim().max(4000).optional().nullable()

const UpdateLeadSchema = z
  .object({
    sourceKind: z.enum(GROWTH_LEAD_SOURCE_KINDS).optional(),
    sourceDetail: optionalText,
    externalRef: z.string().trim().max(200).optional().nullable(),
    companyName: z.string().trim().min(1).max(200).optional(),
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
    callPriorityOverride: z.number().int().min(0).max(100).optional().nullable(),
    sourceChannel: optionalText,
    sourceCampaign: optionalText,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "empty_patch" })

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
    return NextResponse.json({ ok: true, lead, decisionMakers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}

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
  const parsed = UpdateLeadSchema.safeParse(rawBody)
  if (!parsed.success) {
    const message =
      parsed.error.issues.some((issue) => issue.message === "empty_patch")
        ? "No changes provided."
        : "Invalid lead update payload."
    return NextResponse.json({ error: "invalid_body", message }, { status: 400 })
  }

  const body = parsed.data

  try {
    const existing = await fetchGrowthLeadById(access.admin, leadId)
    if (!existing) {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }

    let contactEmail: string | null | undefined
    if (body.contactEmail !== undefined) {
      contactEmail = body.contactEmail?.trim() ? validateLeadContactEmail(body.contactEmail) : null
    }
    let contactPhone: string | null | undefined
    if (body.contactPhone !== undefined) {
      contactPhone = body.contactPhone?.trim() ? normalizeLeadContactPhone(body.contactPhone) : null
    }
    let website: string | null | undefined
    if (body.website !== undefined) {
      website = body.website?.trim() ? normalizeLeadContactWebsite(body.website) : null
    }

    let lead = await updateGrowthLead(access.admin, leadId, {
      sourceKind: body.sourceKind,
      sourceDetail: body.sourceDetail,
      externalRef: body.externalRef,
      companyName: body.companyName,
      contactName: body.contactName,
      contactEmail,
      contactPhone,
      website,
      addressLine1: body.addressLine1,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      country: body.country,
      status: body.status,
      score: body.score,
      notes: body.notes,
      researchPriority: body.researchPriority,
      assignedTo: body.assignedTo,
      callPriorityOverride: body.callPriorityOverride,
      sourceChannel: body.sourceChannel,
      sourceCampaign: body.sourceCampaign,
    })

    if (!lead) {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }

    if (body.status !== undefined && body.status !== existing.status) {
      await emitGrowthLeadStatusChangedTimeline(access.admin, {
        leadId,
        from: existing.status,
        to: body.status,
        actor: { userId: access.userId, email: access.userEmail },
      })
    }
    if (body.website !== undefined) {
      await emitGrowthLeadWebsiteChangedTimeline(access.admin, {
        leadId,
        from: existing.website,
        to: lead.website,
        actor: { userId: access.userId, email: access.userEmail },
      })
    }
    if (body.notes !== undefined) {
      await emitGrowthLeadNotesUpdatedTimeline(access.admin, {
        leadId,
        field: "lead_notes",
        actor: { userId: access.userId, email: access.userEmail },
      })
    }
    if (body.callPriorityOverride !== undefined) {
      await emitGrowthLeadOverrideChangedTimeline(access.admin, {
        leadId,
        from: existing.callPriorityOverride,
        to: lead.callPriorityOverride,
        actor: { userId: access.userId, email: access.userEmail },
      })
    }

    if (
      body.contactPhone !== undefined ||
      body.contactName !== undefined ||
      body.website !== undefined ||
      body.score !== undefined ||
      body.status !== undefined ||
      body.callPriorityOverride !== undefined
    ) {
      lead = (await recomputeGrowthLeadWorkflowSignals(access.admin, leadId)) ?? lead
    }

    logGrowthEngine("lead_update_success", {
      leadId: lead.id,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, lead })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message === "company_name_required") {
      return NextResponse.json({ error: "invalid_body", message: "Company name is required." }, { status: 400 })
    }
    if (message === "empty_patch") {
      return NextResponse.json({ error: "empty_patch", message: "No changes provided." }, { status: 400 })
    }
    if (message === "invalid_email" || message === "invalid_phone") {
      return NextResponse.json({
        error: "invalid_body",
        message: friendlyLeadContactValidationError(message),
      }, { status: 400 })
    }
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}

export async function DELETE(
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
    const existing = await fetchGrowthLeadById(access.admin, leadId)
    if (!existing || existing.archivedAt) {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }

    const archived = await archiveGrowthLeads(access.admin, {
      leadIds: [leadId],
      archivedBy: access.userId,
      reason: "Archived from Growth Leads inbox",
    })
    if (archived.length === 0) {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }

    if (existing.status !== "archived") {
      await emitGrowthLeadStatusChangedTimeline(access.admin, {
        leadId,
        from: existing.status,
        to: "archived",
        actor: { userId: access.userId, email: access.userEmail },
      })
    }

    logGrowthEngine("lead_archive_success", {
      leadId,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, leadId, lead: archived[0] })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "archive_failed", message }, { status: 500 })
  }
}
