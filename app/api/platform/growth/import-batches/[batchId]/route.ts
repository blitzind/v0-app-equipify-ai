import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { appendGrowthImportBatchEvent } from "@/lib/growth/import/batch-events-repository"
import {
  fetchGrowthImportBatchById,
  refreshGrowthImportBatchLeadOutcomes,
  updateGrowthImportBatch,
} from "@/lib/growth/import/batch-repository"
import { GROWTH_IMPORT_DUPLICATE_STRATEGIES } from "@/lib/growth/import/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PatchSchema = z.object({
  batchName: z.string().trim().min(1).max(200).optional(),
  sourceChannel: z.string().trim().max(200).optional().nullable(),
  sourceCampaign: z.string().trim().max(200).optional().nullable(),
  columnMapping: z.record(z.string(), z.string()).optional(),
  mappingProfileId: z.string().uuid().optional().nullable(),
  duplicateStrategy: z.enum(GROWTH_IMPORT_DUPLICATE_STRATEGIES).optional(),
  cancel: z.boolean().optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ batchId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { batchId } = await context.params
  if (!UUID_RE.test(batchId)) {
    return NextResponse.json({ error: "invalid_batch", message: "Invalid batch id." }, { status: 400 })
  }

  try {
    await refreshGrowthImportBatchLeadOutcomes(access.admin, batchId)
    const batch = await fetchGrowthImportBatchById(access.admin, batchId)
    if (!batch) {
      return NextResponse.json({ error: "not_found", message: "Import batch not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, batch })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}

export async function PATCH(
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
  const parsed = PatchSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid batch patch." }, { status: 400 })
  }

  const batch = await fetchGrowthImportBatchById(access.admin, batchId)
  if (!batch) {
    return NextResponse.json({ error: "not_found", message: "Import batch not found." }, { status: 404 })
  }

  if (batch.status === "running") {
    return NextResponse.json({ error: "batch_running", message: "Batch is currently running." }, { status: 409 })
  }

  try {
    if (parsed.data.cancel) {
      const cancelled = await updateGrowthImportBatch(access.admin, batchId, { status: "cancelled" })
      await appendGrowthImportBatchEvent(access.admin, {
        batchId,
        eventType: "batch_cancelled",
        title: "Batch cancelled",
        actorUserId: access.userId,
        actorEmail: access.userEmail,
      })
      return NextResponse.json({ ok: true, batch: cancelled })
    }

    const updated = await updateGrowthImportBatch(access.admin, batchId, {
      batchName: parsed.data.batchName,
      sourceChannel: parsed.data.sourceChannel,
      sourceCampaign: parsed.data.sourceCampaign,
      columnMapping: parsed.data.columnMapping,
      mappingProfileId: parsed.data.mappingProfileId,
      options: {
        ...batch.options,
        duplicateStrategy: parsed.data.duplicateStrategy ?? batch.options.duplicateStrategy,
      },
    })

    if (parsed.data.columnMapping) {
      await appendGrowthImportBatchEvent(access.admin, {
        batchId,
        eventType: "mapping_saved",
        title: "Column mapping saved",
        actorUserId: access.userId,
        actorEmail: access.userEmail,
      })
    }

    return NextResponse.json({ ok: true, batch: updated })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
