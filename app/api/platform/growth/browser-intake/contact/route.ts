import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { createBrowserIntakeContact } from "@/lib/growth/browser-intake/create-browser-intake-contact"
import {
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
      created_by: access.userId,
      actor_email: access.userEmail,
    })

    logGrowthEngine("browser_intake_api", {
      status: result.status,
      actorEmail: access.userEmail,
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
