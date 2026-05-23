import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runGrowthImportCommit } from "@/lib/growth/import/pipeline"

export const runtime = "nodejs"
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  columnMapping: z.record(z.string(), z.string()),
  dryRun: z.boolean().optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { batchId } = await context.params
  if (!UUID_RE.test(batchId)) {
    return NextResponse.json({ error: "invalid_batch", message: "Invalid batch id." }, { status: 400 })
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Provide columnMapping." }, { status: 400 })
  }

  try {
    const result = await runGrowthImportCommit(access.admin, batchId, {
      mapping: parsed.data.columnMapping,
      dryRun: parsed.data.dryRun,
      actor: { userId: access.userId, email: access.userEmail },
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message === "batch_not_found") {
      return NextResponse.json({ error: "not_found", message: "Import batch not found." }, { status: 404 })
    }
    if (message === "batch_cancelled") {
      return NextResponse.json({ error: "batch_cancelled", message: "Import batch was cancelled." }, { status: 409 })
    }
    return NextResponse.json({ error: "commit_failed", message }, { status: 500 })
  }
}
