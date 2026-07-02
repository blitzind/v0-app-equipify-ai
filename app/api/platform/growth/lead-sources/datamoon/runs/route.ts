import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  isDatamoonAudienceImportSchemaReady,
  listDatamoonAudienceImportRuns,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import { startDatamoonAudienceImportRun } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-service"
import { diagnoseDatamoonProvider } from "@/lib/growth/providers/datamoon"

export const runtime = "nodejs"

const filterSchema = z.object({
  field: z.string().trim().min(1),
  operator: z.string().trim().min(1),
  value: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
  value_to: z.string().nullable().optional(),
})

const createBodySchema = z.object({
  run_name: z.string().trim().min(1),
  audience_type: z.enum(["advanced_search", "b2b", "b2c"]),
  filters: z.array(filterSchema).default([]),
  topic_ids: z.array(z.string().trim().min(1)).optional(),
  limit: z.number().int().min(1).max(1_000_000).optional(),
  name: z.string().trim().optional(),
  website_id: z.string().trim().optional(),
  provider_mode: z.enum(["ext", "module"]).optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isDatamoonAudienceImportSchemaReady(access.admin)
  const runs = schemaReady ? await listDatamoonAudienceImportRuns(access.admin) : []

  return NextResponse.json({
    ok: true,
    schemaReady,
    diagnostics: diagnoseDatamoonProvider(),
    runs,
  })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isDatamoonAudienceImportSchemaReady(access.admin))) {
    return NextResponse.json({ ok: false, error: "schema_not_ready" }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = createBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const result = await startDatamoonAudienceImportRun(
    access.admin,
    parsed.data,
    { userId: access.userId, email: access.userEmail },
  )

  if (!result.ok) {
    const status = result.error === "validation_failed" ? 422 : 400
    return NextResponse.json(
      { ok: false, error: result.error, issues: result.issues ?? null },
      { status },
    )
  }

  return NextResponse.json({ ok: true, run: result.run, diagnostics: diagnoseDatamoonProvider() })
}
