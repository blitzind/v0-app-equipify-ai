import "server-only"

import { parseQuotePreviewPayloadFromPreparedAction } from "@/lib/aiden/actions/executors/create-quote-from-work-order-executor"
import type {
  CreateQuoteFromWorkOrderPreviewPayload,
  CreateQuotePreviewLineItem,
} from "@/lib/aiden/actions/resolvers/create-quote-from-work-order-resolver"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_LINE_ITEMS = 80
const MAX_DESC_LEN = 500
const MAX_NOTES_LEN = 20_000
const MAX_QTY = 100_000
const MAX_ABS_UNIT_CENTS = 100_000_000

const ALLOWED_KINDS = new Set<string>(["labor", "parts", "materials", "fee", "manual", "recommended"])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function pickString(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

function pickFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function normalizeLineTotalCents(quantity: number, unitCents: number, submittedLineTotal: number): number {
  const expected = Math.round(quantity * unitCents)
  if (Math.abs(submittedLineTotal - expected) <= 2) return submittedLineTotal
  return expected
}

function parseIncomingQuoteLineItems(
  raw: unknown,
): { ok: true; lines: CreateQuotePreviewLineItem[] } | { ok: false; message: string } {
  if (!Array.isArray(raw)) return { ok: false, message: "lineItems must be an array." }
  if (raw.length === 0) return { ok: false, message: "At least one line item is required." }
  if (raw.length > MAX_LINE_ITEMS) return { ok: false, message: `At most ${MAX_LINE_ITEMS} line items are allowed.` }

  const lines: CreateQuotePreviewLineItem[] = []
  for (const item of raw) {
    if (!isRecord(item)) return { ok: false, message: "Invalid line item." }
    const kind = pickString(item.kind)?.trim()
    if (!kind || !ALLOWED_KINDS.has(kind)) {
      return { ok: false, message: "Line item has invalid kind." }
    }
    const description = (pickString(item.description) ?? "").trim()
    if (!description) return { ok: false, message: "Each line item needs a description." }
    if (description.length > MAX_DESC_LEN) {
      return { ok: false, message: `Line descriptions may be at most ${MAX_DESC_LEN} characters.` }
    }

    const quantity = pickFiniteNumber(item.quantity)
    if (quantity == null || quantity <= 0 || quantity > MAX_QTY) {
      return { ok: false, message: "Line quantity must be a positive number within allowed bounds." }
    }

    const unitCents = pickFiniteNumber(item.unitCents)
    const lineTotalCentsRaw = pickFiniteNumber(item.lineTotalCents)
    if (unitCents == null || !Number.isInteger(unitCents) || Math.abs(unitCents) > MAX_ABS_UNIT_CENTS) {
      return { ok: false, message: "Line unit price (cents) is invalid or out of range." }
    }
    if (lineTotalCentsRaw == null || !Number.isInteger(lineTotalCentsRaw)) {
      return { ok: false, message: "Line total (cents) must be a whole number." }
    }

    const lineTotalCents = normalizeLineTotalCents(quantity, unitCents, lineTotalCentsRaw)

    if (kind === "recommended") {
      lines.push({
        kind: "recommended",
        description,
        quantity,
        unitCents,
        lineTotalCents,
        source: "repair_log_task",
      })
      continue
    }

    const src = pickString(item.source)?.trim()
    let source: "work_order_line_items" | "work_order_totals" | "manual"
    if (kind === "manual") {
      source = "manual"
    } else if (src === "work_order_line_items") {
      source = "work_order_line_items"
    } else {
      source = "work_order_totals"
    }

    lines.push({
      kind: kind as "labor" | "parts" | "materials" | "fee" | "manual",
      description,
      quantity,
      unitCents,
      lineTotalCents,
      source,
    })
  }

  return { ok: true, lines }
}

export function mergeAndValidateQuotePreviewForPatch(
  existingPreviewPayload: Record<string, unknown>,
  incomingBody: unknown,
):
  | { ok: true; previewPayload: Record<string, unknown> }
  | { ok: false; message: string } {
  const base = parseQuotePreviewPayloadFromPreparedAction(existingPreviewPayload)
  if (!base.ok) {
    return { ok: false, message: "Existing preview is not valid; cannot patch." }
  }

  if (!isRecord(incomingBody)) {
    return { ok: false, message: "Request body must be a JSON object." }
  }
  const incomingPreview = incomingBody.preview
  if (!isRecord(incomingPreview)) {
    return { ok: false, message: "Body must include a preview object." }
  }

  const linesParsed = parseIncomingQuoteLineItems(incomingPreview.lineItems)
  if (!linesParsed.ok) return linesParsed

  const notesRaw = pickString(incomingPreview.notes) ?? ""
  if (notesRaw.length > MAX_NOTES_LEN) {
    return { ok: false, message: `Notes may be at most ${MAX_NOTES_LEN} characters.` }
  }

  const p0 = base.preview
  const customerId = p0.customer.id
  const workOrderId = p0.workOrder.id
  if (!UUID_RE.test(customerId) || !UUID_RE.test(workOrderId)) {
    return { ok: false, message: "Existing preview is missing stable customer or work order ids." }
  }

  const sumLineCents = linesParsed.lines.reduce((s, l) => s + l.lineTotalCents, 0)
  const subtotalMajor = Math.round(sumLineCents) / 100
  const totalMajor = subtotalMajor

  const merged: CreateQuoteFromWorkOrderPreviewPayload = {
    customer: p0.customer,
    workOrder: p0.workOrder,
    lineItems: linesParsed.lines,
    subtotal: subtotalMajor,
    taxEstimate: null,
    total: totalMajor,
    notes: notesRaw,
    diagnosis: p0.diagnosis,
    recommendedRepairsSummary: p0.recommendedRepairsSummary,
    warnings: p0.warnings,
    recommendedQuoteTitle: p0.recommendedQuoteTitle,
    sourceSummary: p0.sourceSummary,
  }

  const previewPayload = { preview: merged }
  const roundTrip = parseQuotePreviewPayloadFromPreparedAction(previewPayload as Record<string, unknown>)
  if (!roundTrip.ok) {
    return { ok: false, message: roundTrip.message }
  }

  return { ok: true, previewPayload }
}
