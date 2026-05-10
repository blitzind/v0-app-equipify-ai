import { NextResponse } from "next/server"
import {
  assertWorkOrderProductivityAccess,
  resolveProductivityRequest,
} from "@/lib/aiden/productivity-request-context"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"
import { runAiTask } from "@/lib/ai/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { loadWorkOrderDetailForOrg } from "@/lib/work-orders/detail-load"
import {
  buildWorkOrderPartsSuggestMessages,
  type CatalogReferenceRow,
} from "@/lib/work-orders/parts-suggest-prompt"
import {
  WorkOrderPartsSuggestAiSchema,
  type WorkOrderPartsSuggestAi,
} from "@/lib/work-orders/parts-suggest-schema"

export const runtime = "nodejs"
export const maxDuration = 60

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

function canIncludeCatalogContext(perms: {
  canManageInventory: boolean
  canConsumePartsOnWorkOrders: boolean
}): boolean {
  return Boolean(perms.canManageInventory || perms.canConsumePartsOnWorkOrders)
}

function sanitizeCatalogMatches(
  data: WorkOrderPartsSuggestAi,
  catalogAllowed: boolean,
  allowedIds: Set<string>,
): WorkOrderPartsSuggestAi {
  return {
    suggestions: data.suggestions.map((s) => {
      if (!catalogAllowed || allowedIds.size === 0) {
        return { ...s, catalogMatch: null }
      }
      const id = s.catalogMatch?.catalogItemId
      if (id && !allowedIds.has(id)) {
        return { ...s, catalogMatch: null }
      }
      return s
    }),
  }
}

function enrichCatalogLabels(
  data: WorkOrderPartsSuggestAi,
  nameById: Map<string, string>,
): WorkOrderPartsSuggestAi {
  return {
    suggestions: data.suggestions.map((s) => {
      const id = s.catalogMatch?.catalogItemId
      if (!id) return s
      const nm = nameById.get(id)
      if (!nm) return s
      return {
        ...s,
        catalogMatch: {
          ...s.catalogMatch,
          displayLabel: s.catalogMatch.displayLabel?.trim() || nm,
        },
      }
    }),
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; workOrderId: string }> },
) {
  const { organizationId, workOrderId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(workOrderId)) {
    return jsonError("invalid_id", "Invalid organization or work order id.", 400)
  }

  const resolved = await resolveProductivityRequest(organizationId)
  if (!resolved.ok) {
    return resolved.response
  }
  const { ctx } = resolved

  const woAccess = await assertWorkOrderProductivityAccess(ctx, workOrderId)
  if (!woAccess.ok) {
    return woAccess.response
  }

  const loaded = await loadWorkOrderDetailForOrg(ctx.supabase, organizationId, workOrderId)
  if (!loaded.ok || !loaded.data) {
    return jsonError("not_found", "Work order not found.", 404)
  }

  const catalogOk = canIncludeCatalogContext(ctx.permissions)
  let catalogRows: CatalogReferenceRow[] = []
  const allowedIds = new Set<string>()

  if (catalogOk) {
    const { data: catData, error: catErr } = await ctx.supabase
      .from("catalog_items")
      .select("id, name, sku, part_number, category, item_type")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(150)

    if (!catErr && catData?.length) {
      catalogRows = catData.map((r) => {
        const row = r as {
          id: string
          name: string
          sku: string | null
          part_number: string | null
          category: string | null
          item_type: string | null
        }
        allowedIds.add(row.id)
        return {
          id: row.id,
          name: row.name,
          sku: row.sku,
          partNumber: row.part_number,
          category: row.category,
          itemType: row.item_type,
        }
      })
    }
  }

  const messages = buildWorkOrderPartsSuggestMessages({
    detail: loaded.data,
    catalogReferenceItems: catalogOk ? catalogRows : null,
  })

  const authClient = await createServerSupabaseClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()

  const started = Date.now()
  const result = await runAiTask<WorkOrderPartsSuggestAi>({
    task: "work_order_parts_suggest",
    organizationId,
    actingUserEmail: user?.email ?? null,
    input: { system: messages.system, user: messages.user },
    schema: WorkOrderPartsSuggestAiSchema,
    skipCache: true,
  })

  if (!result.ok) {
    return jsonError("ai_failed", result.error.message || "Could not generate suggestions.", 502)
  }

  const nameById = new Map(catalogRows.map((r) => [r.id, r.name]))
  let safeOutput = sanitizeCatalogMatches(result.output, catalogOk, allowedIds)
  if (catalogOk && allowedIds.size > 0) {
    safeOutput = enrichCatalogLabels(safeOutput, nameById)
  }

  void recordAidenUsageEvent({
    organizationId,
    userId: ctx.userId,
    featureKey: "work_order_summary",
    planTier: ctx.planId,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    durationMs: Date.now() - started,
    metadata: {
      work_order_id: loaded.data.workOrder.id,
      surface: "parts_catalog_suggestions",
      ai_task: "work_order_parts_suggest",
      catalog_context: catalogOk ? (allowedIds.size > 0 ? "included" : "empty") : "omitted_no_inventory_access",
    },
  })

  return NextResponse.json({
    ok: true,
    suggestions: safeOutput.suggestions,
    catalogContextIncluded: catalogOk && allowedIds.size > 0,
  })
}
