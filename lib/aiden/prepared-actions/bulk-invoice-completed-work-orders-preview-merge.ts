import { z } from "zod"
import type { BulkInvoiceCompletedWorkOrdersPreview } from "@/lib/aiden/actions/resolvers/bulk-invoice-completed-work-orders-types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const previewLineItemSchema = z.object({
  kind: z.enum(["labor", "parts", "materials", "fee", "manual"]),
  description: z.string(),
  quantity: z.number(),
  unitCents: z.number(),
  lineTotalCents: z.number(),
  source: z.enum(["work_order_totals", "work_order_line_items", "manual"]),
})

const singleInvoicePreviewSchema = z.object({
  customer: z.object({
    id: z.string().regex(UUID_RE),
    companyName: z.string(),
    billingName: z.string().nullable().optional(),
    billingContactName: z.string().nullable().optional(),
    billingEmail: z.string().nullable().optional(),
    billingContactPhone: z.string().nullable().optional(),
    billingAddressLine1: z.string().nullable().optional(),
    billingAddressLine2: z.string().nullable().optional(),
    billingCity: z.string().nullable().optional(),
    billingState: z.string().nullable().optional(),
    billingPostalCode: z.string().nullable().optional(),
    billingCountry: z.string().nullable().optional(),
    taxExempt: z.boolean().nullable().optional(),
    defaultTaxBasis: z.string().nullable().optional(),
    defaultTaxCategory: z.string().nullable().optional(),
  }),
  workOrder: z.object({
    id: z.string().regex(UUID_RE),
    workOrderNumber: z.number().nullable(),
    title: z.string(),
    status: z.string(),
    completedAt: z.string().nullable(),
    billingState: z.string().nullable(),
    totalLaborCents: z.number(),
    totalPartsCents: z.number(),
  }),
  lineItems: z.array(previewLineItemSchema).min(1).max(500),
  subtotal: z.number(),
  taxEstimate: z.number().nullable(),
  total: z.number(),
  notes: z.string(),
  warnings: z.array(z.string()).max(50),
  recommendedInvoiceTitle: z.string().max(500),
  sourceSummary: z.string().max(4000),
})

const itemSchema = z.object({
  workOrderId: z.string().regex(UUID_RE),
  workOrderNumber: z.number().nullable(),
  customerId: z.string().regex(UUID_RE),
  customerLabel: z.string().min(1).max(500),
  completedAt: z.string().nullable(),
  anomalies: z.array(z.string()).max(30),
  invoicePreview: singleInvoicePreviewSchema,
})

const bulkPreviewSchema = z.object({
  dateRange: z.object({
    startIso: z.string().min(10).max(40),
    endIso: z.string().min(10).max(40),
    label: z.string().min(1).max(200),
  }),
  items: z.array(itemSchema).min(1).max(100),
  excludedWorkOrderIds: z.array(z.string().regex(UUID_RE)).max(100),
  batchWarnings: z.array(z.string()).max(50),
  summary: z.object({
    candidateCount: z.number().int().min(0),
    includedCount: z.number().int().min(0),
    estimatedTotal: z.number(),
  }),
})

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function recomputeSummary(p: z.infer<typeof bulkPreviewSchema>): BulkInvoiceCompletedWorkOrdersPreview["summary"] {
  const excluded = new Set(p.excludedWorkOrderIds)
  let includedCount = 0
  let estimatedTotal = 0
  for (const it of p.items) {
    if (excluded.has(it.workOrderId)) continue
    includedCount += 1
    estimatedTotal += it.invoicePreview.total
  }
  return {
    candidateCount: p.items.length,
    includedCount,
    estimatedTotal: Math.round(estimatedTotal * 100) / 100,
  }
}

export function mergeAndValidateBulkInvoiceCompletedWorkOrdersPreviewForPatch(
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
  const parsed = bulkPreviewSchema.safeParse(merged)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid preview."
    return { ok: false, message: msg }
  }

  const next = { ...parsed.data, summary: recomputeSummary(parsed.data) }
  return { ok: true, previewPayload: { preview: next as BulkInvoiceCompletedWorkOrdersPreview } }
}
