import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { createManualGrowthContact } from "@/lib/growth/manual-entry/create-manual-growth-contact"
import { GROWTH_MANUAL_CONTACT_ENTRY_QA_MARKER } from "@/lib/growth/manual-entry/manual-contact-entry-types"
import { runUnifiedRevenueWorkflowAfterIntake } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-intake-runner"

export const runtime = "nodejs"

const optionalText = z.string().trim().max(500).optional().nullable()
const optionalEmail = z.string().trim().email().max(320).optional().nullable().or(z.literal(""))

const CreateManualContactSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  contact_name: z.string().trim().min(1).max(200),
  title: optionalText,
  email: optionalEmail,
  phone: optionalText,
  website: z.string().trim().max(500).optional().nullable(),
  linkedin_url: z.string().trim().max(500).optional().nullable(),
  city: optionalText,
  state: optionalText,
  source_note: z.string().trim().max(2000).optional().nullable(),
  verify_email: z.boolean().optional(),
  acquisition_run_id: z.string().uuid().optional().nullable(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = CreateManualContactSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Company name and contact name are required." },
      { status: 400 },
    )
  }

  const body = parsed.data
  const email = body.email?.trim() ? body.email.trim().toLowerCase() : null

  try {
    const result = await createManualGrowthContact(access.admin, {
      company_name: body.company_name,
      contact_name: body.contact_name,
      title: body.title,
      email,
      phone: body.phone,
      website: body.website,
      linkedin_url: body.linkedin_url,
      city: body.city,
      state: body.state,
      source_note: body.source_note,
      verify_email: body.verify_email === true,
      acquisition_run_id: body.acquisition_run_id,
      created_by: access.userId,
      actor_email: access.userEmail,
    })

    logGrowthEngine("manual_contact_entry_api", {
      status: result.status,
      actorEmail: access.userEmail,
    })

    const statusCode =
      result.status === "created"
        ? 201
        : result.status === "linked_duplicate"
          ? 200
          : result.status === "suppressed"
            ? 409
            : 500

    let workflow = null
    if (result.status === "created" || result.status === "linked_duplicate") {
      const workflowRun = await runUnifiedRevenueWorkflowAfterIntake({
        admin: access.admin,
        actor: { userId: access.userId, email: access.userEmail },
        source: "manual",
        leadId: result.lead_id!,
        company: {
          name: body.company_name,
          website: body.website,
        },
        contact: {
          name: body.contact_name,
          title: body.title,
          email,
          phone: body.phone,
          linkedinUrl: body.linkedin_url,
        },
        metadata: {
          acquisitionRunId: body.acquisition_run_id,
        },
      })
      workflow = workflowRun.workflow
    }

    return NextResponse.json(
      {
        ok: result.status === "created" || result.status === "linked_duplicate",
        qa_marker: GROWTH_MANUAL_CONTACT_ENTRY_QA_MARKER,
        result,
        workflow,
      },
      { status: statusCode },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
