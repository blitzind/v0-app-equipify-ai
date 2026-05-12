/**
 * Unit tests: create invoice from work order executor helpers (preview parse, line mapping, totals).
 * Run: pnpm test:create-invoice-from-work-order-executor
 */
import assert from "node:assert/strict"
import {
  computeSubtotalCentsFromPreviewLineItems,
  parseInvoicePreviewPayloadFromPreparedAction,
  previewLineItemsToLineItemJson,
} from "../lib/aiden/actions/executors/create-invoice-from-work-order-executor"
import { mergeAndValidateInvoicePreviewForPatch } from "../lib/aiden/prepared-actions/invoice-preview-merge"

const PREVIEW_BASE = {
  customer: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    companyName: "Acme",
    billingName: null,
    billingContactName: null,
    billingEmail: null,
    billingContactPhone: null,
    billingAddressLine1: null,
    billingAddressLine2: null,
    billingCity: null,
    billingState: null,
    billingPostalCode: null,
    billingCountry: null,
    taxExempt: false,
    defaultTaxBasis: null,
    defaultTaxCategory: null,
  },
  workOrder: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    workOrderNumber: 42,
    title: "Repair",
    status: "completed",
    completedAt: "2026-01-01",
    billingState: null,
    totalLaborCents: 10000,
    totalPartsCents: 5000,
  },
  lineItems: [
    {
      kind: "labor" as const,
      description: "Labor",
      quantity: 1,
      unitCents: 10000,
      lineTotalCents: 10000,
      source: "work_order_totals" as const,
    },
    {
      kind: "parts" as const,
      description: "Parts",
      quantity: 1,
      unitCents: 5000,
      lineTotalCents: 5000,
      source: "work_order_line_items" as const,
    },
  ],
  subtotal: 150,
  taxEstimate: null,
  total: 150,
  notes: "",
  warnings: [],
  recommendedInvoiceTitle: "Invoice — WO #42",
  sourceSummary: "test",
}

function testParseValidPreview() {
  const r = parseInvoicePreviewPayloadFromPreparedAction({ preview: PREVIEW_BASE })
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.preview.lineItems.length, 2)
  assert.equal(r.preview.customer.id, PREVIEW_BASE.customer.id)
}

function testParseRejectsMissingPreview() {
  const r = parseInvoicePreviewPayloadFromPreparedAction({})
  assert.equal(r.ok, false)
}

function testLineItemsMapping() {
  const paId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  const lines = previewLineItemsToLineItemJson(PREVIEW_BASE.lineItems, paId)
  assert.equal(lines.length, 2)
  assert.equal(lines[0].unit, 100)
  assert.ok(lines[0].source_ref?.includes(paId))
}

function testSubtotalCents() {
  const cents = computeSubtotalCentsFromPreviewLineItems(PREVIEW_BASE.lineItems)
  assert.equal(cents, 15000)
}

function testMergePatchManualLineAndExecutionParse() {
  const existing = { preview: { ...PREVIEW_BASE } }
  const incoming = {
    preview: {
      lineItems: [
        ...PREVIEW_BASE.lineItems,
        {
          kind: "manual",
          description: "Rush fee",
          quantity: 1,
          unitCents: 5000,
          lineTotalCents: 5000,
          source: "manual",
        },
      ],
      notes: "Edited in preview",
    },
  }
  const r = mergeAndValidateInvoicePreviewForPatch(existing as Record<string, unknown>, incoming)
  assert.equal(r.ok, true)
  if (!r.ok) return
  const inner = r.previewPayload.preview as typeof PREVIEW_BASE
  assert.equal(inner.lineItems.length, 3)
  assert.equal(inner.notes, "Edited in preview")
  assert.equal(inner.subtotal, 200)
  assert.equal(inner.total, 200)

  const execParse = parseInvoicePreviewPayloadFromPreparedAction(r.previewPayload as Record<string, unknown>)
  assert.equal(execParse.ok, true)
  if (!execParse.ok) return
  assert.equal(execParse.preview.lineItems[2]?.kind, "manual")
  const cents = computeSubtotalCentsFromPreviewLineItems(execParse.preview.lineItems)
  assert.equal(cents, 20000)
  const jsonLines = previewLineItemsToLineItemJson(execParse.preview.lineItems, "cccccccc-cccc-4ccc-8ccc-cccccccccccc")
  assert.equal(jsonLines.length, 3)
  assert.equal(jsonLines[2].unit, 50)
}

function testMergeRejectsBadLineKind() {
  const existing = { preview: { ...PREVIEW_BASE } }
  const incoming = {
    preview: {
      lineItems: [...PREVIEW_BASE.lineItems, { kind: "bogus", description: "x", quantity: 1, unitCents: 1, lineTotalCents: 1 }],
      notes: "",
    },
  }
  const r = mergeAndValidateInvoicePreviewForPatch(existing as Record<string, unknown>, incoming)
  assert.equal(r.ok, false)
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "parse valid preview payload", fn: testParseValidPreview },
  { name: "parse rejects missing preview", fn: testParseRejectsMissingPreview },
  { name: "preview line items map to LineItemJson", fn: testLineItemsMapping },
  { name: "subtotal cents from line items", fn: testSubtotalCents },
  { name: "merge patch manual line then execution parse + line json", fn: testMergePatchManualLineAndExecutionParse },
  { name: "merge rejects invalid line kind", fn: testMergeRejectsBadLineKind },
]

let failed = 0
for (const t of tests) {
  try {
    t.fn()
    console.log(`ok\t${t.name}`)
  } catch (e) {
    failed += 1
    console.error(`fail\t${t.name}`)
    console.error(e)
  }
}

if (failed > 0) process.exit(1)
console.log(`\nAll ${tests.length} tests passed.`)
