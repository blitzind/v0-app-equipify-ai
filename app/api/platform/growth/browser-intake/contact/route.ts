import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { createBrowserIntakeContact } from "@/lib/growth/browser-intake/create-browser-intake-contact"
import {
  GROWTH_BROWSER_INTAKE_CAPTURE_METHODS,
  GROWTH_BROWSER_INTAKE_MODES,
  GROWTH_BROWSER_INTAKE_QA_MARKER,
  GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS,
} from "@/lib/growth/browser-intake/browser-intake-types"

export const runtime = "nodejs"

const optionalText = z.string().trim().max(500).optional().nullable()
const optionalEmail = z.string().trim().email().max(320).optional().nullable().or(z.literal(""))

const CreateBrowserIntakeContactSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  contact_name: optionalText,
  title: optionalText,
  email: optionalEmail,
  phone: optionalText,
  website: z.string().trim().max(500).optional().nullable(),
  linkedin_url: z.string().trim().max(500).optional().nullable(),
  source_url: z.string().trim().max(2000).optional().nullable(),
  source_platform: z.enum(GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS).optional().nullable(),
  city: optionalText,
  state: optionalText,
  notes: z.string().trim().max(2000).optional().nullable(),
  page_title: z.string().trim().max(500).optional().nullable(),
  capture_method: z.enum(GROWTH_BROWSER_INTAKE_CAPTURE_METHODS).optional().nullable(),
  company_only: z.boolean().optional(),
  queue_contact_discovery: z.boolean().optional(),
  intake_mode: z.enum(GROWTH_BROWSER_INTAKE_MODES).optional(),
  target_lead_id: z.string().uuid().optional().nullable(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = CreateBrowserIntakeContactSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid browser intake payload." },
      { status: 400 },
    )
  }

  const body = parsed.data
  const email = body.email?.trim() ? body.email.trim().toLowerCase() : null

  try {
    const result = await createBrowserIntakeContact(access.admin, {
      company_name: body.company_name,
      contact_name: body.contact_name,
      title: body.title,
      email,
      phone: body.phone,
      website: body.website,
      linkedin_url: body.linkedin_url,
      source_url: body.source_url,
      source_platform: body.source_platform,
      city: body.city,
      state: body.state,
      notes: body.notes,
      page_title: body.page_title,
      capture_method: body.capture_method ?? "chrome_extension",
      company_only: body.company_only === true,
      queue_contact_discovery: body.queue_contact_discovery === true,
      intake_mode: body.intake_mode,
      target_lead_id: body.target_lead_id,
      created_by: access.userId,
      actor_email: access.userEmail,
    })

    logGrowthEngine("browser_intake_api", {
      status: result.status,
      actorEmail: access.userEmail,
      captureType: "capture_type" in result ? result.capture_type : null,
      contactDiscoveryQueued:
        "contact_discovery_queued" in result ? result.contact_discovery_queued : false,
    })

    const statusCode =
      result.status === "created"
        ? 201
        : result.status === "updated"
          ? 200
          : result.status === "suppressed"
            ? 409
            : 500

    return NextResponse.json(
      {
        ok: result.status === "created" || result.status === "updated",
        qa_marker: GROWTH_BROWSER_INTAKE_QA_MARKER,
        result,
      },
      { status: statusCode },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
