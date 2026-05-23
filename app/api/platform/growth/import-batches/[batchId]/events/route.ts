import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthImportBatchEvents } from "@/lib/growth/import/batch-events-repository"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  context: { params: Promise<{ batchId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { batchId } = await context.params
  if (!UUID_RE.test(batchId)) {
    return NextResponse.json({ error: "invalid_batch", message: "Invalid batch id." }, { status: 400 })
  }

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") ?? "100")

  try {
    const events = await listGrowthImportBatchEvents(access.admin, batchId, { limit })
    return NextResponse.json({ ok: true, events })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}
