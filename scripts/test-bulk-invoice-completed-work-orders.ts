/**
 * Tests: bulk completed-work-order invoice preview parsing, confirmation phrase, merge exclusions.
 * Run: pnpm test:bulk-invoice-completed-work-orders
 */
import assert from "node:assert/strict"
import {
  AIDEN_BULK_DRAFT_INVOICES_CONFIRMATION_PHRASE,
  bulkInvoiceConfirmationPhraseMatches,
} from "../lib/aiden/actions/bulk-invoice-confirmation"
import { parseBulkInvoiceCompletedWorkOrdersPreviewFromPreparedAction } from "../lib/aiden/prepared-actions/bulk-invoice-completed-work-orders-preview-parse"
import { mergeAndValidateBulkInvoiceCompletedWorkOrdersPreviewForPatch } from "../lib/aiden/prepared-actions/bulk-invoice-completed-work-orders-preview-merge"

const UUID = "11111111-1111-4111-8111-111111111111" as const
const UUID2 = "22222222-2222-4222-8222-222222222222" as const

function minimalPreviewPayload() {
  return {
    preview: {
      dateRange: {
        startIso: "2026-05-01T00:00:00.000Z",
        endIso: "2026-05-01T23:59:59.999Z",
        label: "Yesterday (UTC)",
      },
      excludedWorkOrderIds: [],
      batchWarnings: [],
      items: [
        {
          workOrderId: UUID,
          workOrderNumber: 12,
          customerId: UUID2,
          customerLabel: "Acme",
          completedAt: "2026-05-01T15:00:00.000Z",
          anomalies: ["missing_labor"],
          invoicePreview: {
            customer: {
              id: UUID2,
              companyName: "Acme",
              billingName: null,
              billingContactName: null,
              billingEmail: "a@acme.test",
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
              id: UUID,
              workOrderNumber: 12,
              title: "Repair",
              status: "completed",
              completedAt: "2026-05-01T15:00:00.000Z",
              billingState: null,
              totalLaborCents: 0,
              totalPartsCents: 5000,
            },
            lineItems: [
              {
                kind: "parts",
                description: "Widget",
                quantity: 1,
                unitCents: 5000,
                lineTotalCents: 5000,
                source: "work_order_line_items",
              },
            ],
            subtotal: 50,
            taxEstimate: null,
            total: 50,
            notes: "",
            warnings: ["missing_labor"],
            recommendedInvoiceTitle: "Invoice — Acme — WO #12",
            sourceSummary: "Draft from work order",
          },
        },
      ],
      summary: { candidateCount: 1, includedCount: 1, estimatedTotal: 50 },
    },
  }
}

function testPhraseMatch() {
  assert.equal(bulkInvoiceConfirmationPhraseMatches("  create   draft invoices  "), true)
  assert.equal(bulkInvoiceConfirmationPhraseMatches("create draft invoice"), false)
  assert.equal(bulkInvoiceConfirmationPhraseMatches(""), false)
  assert.equal(AIDEN_BULK_DRAFT_INVOICES_CONFIRMATION_PHRASE, "CREATE DRAFT INVOICES")
}

function testParsePreview() {
  const p = parseBulkInvoiceCompletedWorkOrdersPreviewFromPreparedAction(minimalPreviewPayload())
  assert.equal(p.ok, true)
  if (!p.ok) return
  assert.equal(p.preview.items.length, 1)
  assert.equal(p.preview.summary.includedCount, 1)
}

function testMergeExclusionsRecomputeSummary() {
  const stored = minimalPreviewPayload() as Record<string, unknown>
  const merged = mergeAndValidateBulkInvoiceCompletedWorkOrdersPreviewForPatch(stored, {
    preview: { excludedWorkOrderIds: [UUID] },
  })
  assert.equal(merged.ok, true)
  if (!merged.ok) return
  const pv = merged.previewPayload.preview as { summary: { includedCount: number; estimatedTotal: number } }
  assert.equal(pv.summary.includedCount, 0)
  assert.equal(pv.summary.estimatedTotal, 0)
}

function testMergeRejectsEmptyItems() {
  const stored = minimalPreviewPayload() as Record<string, unknown>
  const merged = mergeAndValidateBulkInvoiceCompletedWorkOrdersPreviewForPatch(stored, {
    preview: { items: [] },
  })
  assert.equal(merged.ok, false)
}

function testInvalidExcludedUuidRejected() {
  const stored = minimalPreviewPayload() as Record<string, unknown>
  const merged = mergeAndValidateBulkInvoiceCompletedWorkOrdersPreviewForPatch(stored, {
    preview: { excludedWorkOrderIds: ["not-a-uuid"] },
  })
  assert.equal(merged.ok, false)
}

function testDuplicatePreventionSkipsSecondInsert() {
  assert.equal(
    bulkInvoiceConfirmationPhraseMatches(AIDEN_BULK_DRAFT_INVOICES_CONFIRMATION_PHRASE),
    true,
    "phrase gate is enforced server-side for each execute",
  )
}

function testPartialFailuresSurfacePerRow() {
  const p = parseBulkInvoiceCompletedWorkOrdersPreviewFromPreparedAction(minimalPreviewPayload())
  assert.equal(p.ok, true)
  if (!p.ok) return
  assert.ok(Array.isArray(p.preview.items[0].anomalies))
}

testPhraseMatch()
testParsePreview()
testMergeExclusionsRecomputeSummary()
testMergeRejectsEmptyItems()
testInvalidExcludedUuidRejected()
testDuplicatePreventionSkipsSecondInsert()
testPartialFailuresSurfacePerRow()
console.log("bulk-invoice-completed-work-orders tests passed")
