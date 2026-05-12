import { z } from "zod"
import type {
  CreatePartsReorderExecutionMode,
  CreatePartsReorderPreviewPayload,
} from "@/lib/aiden/actions/resolvers/create-parts-reorder-request-types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const vendorRowSchema = z.object({
  id: z.string().regex(UUID_RE),
  name: z.string().min(1).max(500),
})

const lineSchema = z.object({
  lineKey: z.string().regex(UUID_RE),
  catalogItemId: z.string().regex(UUID_RE),
  partName: z.string().min(1).max(500),
  sku: z.string().max(200).nullable(),
  partNumber: z.string().max(200).nullable(),
  currentStockAvailable: z.number().finite(),
  suggestedQuantity: z.number().finite().min(1).max(1_000_000),
  vendorId: z.union([z.string().regex(UUID_RE), z.null()]),
  vendorName: z.string().max(500).nullable(),
  inventoryLocationId: z.string().regex(UUID_RE),
  inventoryLocationLabel: z.string().min(1).max(500),
  reason: z.string().min(1).max(2000),
})

const previewSchema = z.object({
  source: z.enum(["work_order", "equipment", "low_stock_org"]),
  executionMode: z.enum(["draft_purchase_order", "restock_requests"]),
  draftPurchaseOrderEligible: z.boolean(),
  lines: z.array(lineSchema).min(1).max(100),
  relatedWorkOrder: z
    .object({
      id: z.string().regex(UUID_RE),
      number: z.number().finite(),
      title: z.string().max(500).nullable(),
    })
    .nullable(),
  relatedEquipment: z
    .object({
      id: z.string().regex(UUID_RE),
      name: z.string().min(1).max(500),
    })
    .nullable(),
  availableVendors: z.array(vendorRowSchema).max(500),
  internalNotes: z.string().max(4000),
})

function recomputeDraftEligibility(lines: z.infer<typeof previewSchema>["lines"]): {
  draftPurchaseOrderEligible: boolean
  executionMode: CreatePartsReorderExecutionMode
} {
  const firstVid = lines[0]?.vendorId
  const draftPurchaseOrderEligible = Boolean(
    firstVid &&
      UUID_RE.test(firstVid) &&
      lines.every((l) => l.vendorId === firstVid),
  )
  return {
    draftPurchaseOrderEligible,
    executionMode: draftPurchaseOrderEligible ? "draft_purchase_order" : "restock_requests",
  }
}

function normalizePreview(p: z.infer<typeof previewSchema>): CreatePartsReorderPreviewPayload {
  const lines = p.lines.map((l) => ({
    ...l,
    suggestedQuantity: Math.round(l.suggestedQuantity),
    sku: l.sku?.trim() || null,
    partNumber: l.partNumber?.trim() || null,
    vendorName: l.vendorName?.trim() || null,
  }))
  const rec = recomputeDraftEligibility(lines)
  let executionMode: CreatePartsReorderExecutionMode = p.executionMode
  if (executionMode === "draft_purchase_order" && !rec.draftPurchaseOrderEligible) {
    executionMode = "restock_requests"
  }
  return {
    ...p,
    lines,
    draftPurchaseOrderEligible: rec.draftPurchaseOrderEligible,
    executionMode,
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export function mergeAndValidateCreatePartsReorderRequestPreviewForPatch(
  storedPreviewPayload: Record<string, unknown>,
  body: unknown,
): { ok: true; previewPayload: Record<string, unknown> } | { ok: false; message: string } {
  const existing = storedPreviewPayload.preview
  if (!isRecord(existing)) return { ok: false, message: "Stored preview is missing." }

  let patch: Record<string, unknown> = {}
  if (isRecord(body) && isRecord(body.preview)) {
    patch = body.preview as Record<string, unknown>
  } else if (isRecord(body)) {
    patch = body
  }

  const merged = { ...existing, ...patch }
  const parsed = previewSchema.safeParse(merged)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid preview."
    return { ok: false, message: msg }
  }

  const normalized = normalizePreview(parsed.data)
  return { ok: true, previewPayload: { preview: normalized } }
}
