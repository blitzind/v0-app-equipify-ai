import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { importDatamoonAudiencePreviewRecords } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-service"

export const runtime = "nodejs"

const importBodySchema = z
  .object({
    record_ids: z.array(z.string().uuid()).optional(),
    import_all_previewed: z.boolean().optional(),
  })
  .refine((body) => Boolean(body.import_all_previewed || (body.record_ids?.length ?? 0) > 0), {
    message: "Provide record_ids or set import_all_previewed=true.",
  })

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { runId } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = importBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = await importDatamoonAudiencePreviewRecords(access.admin, runId, {
      recordIds: parsed.data.record_ids,
      importAllPreviewed: parsed.data.import_all_previewed,
      actor: { userId: access.userId, email: access.userEmail },
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "import_failed"
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
