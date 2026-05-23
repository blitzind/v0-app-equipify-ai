import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthImportBatchRows } from "@/lib/growth/import/batch-repository"
import { GROWTH_IMPORT_BATCH_ROW_STATUSES } from "@/lib/growth/import/types"

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
  const offset = Number(url.searchParams.get("offset") ?? "0")
  const statusParam = url.searchParams.get("status")
  const status =
    statusParam &&
    GROWTH_IMPORT_BATCH_ROW_STATUSES.includes(statusParam as (typeof GROWTH_IMPORT_BATCH_ROW_STATUSES)[number])
      ? (statusParam as (typeof GROWTH_IMPORT_BATCH_ROW_STATUSES)[number])
      : undefined

  try {
    const rows = await listGrowthImportBatchRows(access.admin, batchId, { limit, offset, status })
    return NextResponse.json({ ok: true, rows })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}
