import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_QA_MARKER } from "@/lib/growth/browser-intake/browser-intake-buying-committee-types"
import { importBrowserIntakeBuyingCommitteeSelections } from "@/lib/growth/browser-intake/import-browser-intake-buying-committee"

export const runtime = "nodejs"

const SelectionSchema = z.object({
  candidate_id: z.string().trim().min(1).max(120),
  full_name: z.string().trim().min(1).max(200),
  job_title: z.string().trim().max(200).optional().nullable(),
  linkedin_url: z.string().trim().max(500).optional().nullable(),
  email: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
})

const ImportSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  lead_id: z.string().uuid().optional().nullable(),
  website: z.string().trim().max(500).optional().nullable(),
  linkedin_url: z.string().trim().max(500).optional().nullable(),
  source_url: z.string().trim().max(2000).optional().nullable(),
  selections: z.array(SelectionSchema).min(1).max(15),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = ImportSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid buying committee import payload." },
      { status: 400 },
    )
  }

  const body = parsed.data

  try {
    const results = await importBrowserIntakeBuyingCommitteeSelections(access.admin, {
      company_name: body.company_name,
      lead_id: body.lead_id,
      website: body.website,
      linkedin_url: body.linkedin_url,
      source_url: body.source_url,
      selections: body.selections.map((row) => ({
        ...row,
        email: row.email?.trim() ? row.email.trim().toLowerCase() : null,
      })),
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    logGrowthEngine("browser_intake_buying_committee_import_api", {
      selectionCount: body.selections.length,
      successCount: results.filter((row) => row.ok).length,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_QA_MARKER,
      results,
      imported_count: results.filter((row) => row.ok).length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: "buying_committee_import_failed", message }, { status: 500 })
  }
}
