import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthImportBatchById } from "@/lib/growth/import/batch-repository"
import { buildGrowthImportPreview } from "@/lib/growth/import/pipeline"

export const runtime = "nodejs"
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  columnMapping: z.record(z.string(), z.string()),
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

  const batch = await fetchGrowthImportBatchById(access.admin, batchId)
  if (!batch) {
    return NextResponse.json({ error: "not_found", message: "Import batch not found." }, { status: 404 })
  }

  try {
    const preview = await buildGrowthImportPreview(access.admin, batch, parsed.data.columnMapping)
    return NextResponse.json({ ok: true, ...preview })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "preview_failed", message }, { status: 500 })
  }
}
