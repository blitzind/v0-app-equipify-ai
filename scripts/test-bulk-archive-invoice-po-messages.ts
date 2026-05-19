import assert from "node:assert/strict"
import {
  invoiceBulkArchiveBlockMessage,
  isInvoiceBulkArchiveEligible,
} from "../lib/invoices/bulk-archive-eligibility"
import {
  bulkInvoiceArchivePartialToast,
  bulkInvoiceArchiveSuccessToast,
  invoiceAlreadyArchivedMessage,
} from "../lib/invoices/bulk-archive-messages"
import { friendlyBulkInvoiceArchiveApiError } from "../lib/invoices/bulk-archive-invoices-client"
import {
  isPurchaseOrderBulkArchiveEligible,
  purchaseOrderBulkArchiveBlockMessage,
} from "../lib/purchase-orders/bulk-archive-eligibility"
import {
  bulkPurchaseOrderArchivePartialToast,
  bulkPurchaseOrderArchiveSuccessToast,
  purchaseOrderAlreadyArchivedMessage,
} from "../lib/purchase-orders/bulk-archive-messages"
import { friendlyBulkPurchaseOrderArchiveApiError } from "../lib/purchase-orders/bulk-archive-purchase-orders-client"

assert.equal(invoiceAlreadyArchivedMessage(null), null)
assert.equal(invoiceAlreadyArchivedMessage("2026-01-01"), "This invoice is already archived.")
assert.equal(bulkInvoiceArchiveSuccessToast(1), "Invoice archived")
assert.equal(bulkInvoiceArchiveSuccessToast(2), "Invoices archived")
assert.equal(
  bulkInvoiceArchivePartialToast(1, 2),
  "1 invoice archived. 2 could not be archived.",
)
assert.equal(friendlyBulkInvoiceArchiveApiError(403, undefined), "You do not have permission to archive invoices.")

assert.equal(isInvoiceBulkArchiveEligible({ status: "Draft" }), true)
assert.equal(isInvoiceBulkArchiveEligible({ status: "Void" }), true)
assert.equal(isInvoiceBulkArchiveEligible({ status: "Paid" }), false)
assert.equal(
  invoiceBulkArchiveBlockMessage({ status: "Unpaid", balanceDueCents: 5000 }),
  "Invoices with an open balance cannot be bulk archived.",
)
assert.equal(
  invoiceBulkArchiveBlockMessage({ status: "Draft", paymentAllocationState: "partial" }),
  "Partially paid invoices cannot be bulk archived.",
)
assert.equal(
  invoiceBulkArchiveBlockMessage({ status: "Draft", sentAt: "2026-01-01T00:00:00Z" }),
  "Sent invoices cannot be bulk archived.",
)
assert.equal(
  invoiceBulkArchiveBlockMessage({ status: "Draft", accountingExported: true }),
  "Invoices exported to accounting cannot be bulk archived.",
)

assert.equal(purchaseOrderAlreadyArchivedMessage(null), null)
assert.equal(bulkPurchaseOrderArchiveSuccessToast(1), "Purchase order archived")
assert.equal(bulkPurchaseOrderArchiveSuccessToast(3), "Purchase orders archived")
assert.equal(
  bulkPurchaseOrderArchivePartialToast(2, 1),
  "2 purchase orders archived. 1 could not be archived.",
)
assert.equal(
  friendlyBulkPurchaseOrderArchiveApiError(403, undefined),
  "You do not have permission to archive purchase orders.",
)

assert.equal(isPurchaseOrderBulkArchiveEligible({ status: "Draft" }), true)
assert.equal(isPurchaseOrderBulkArchiveEligible({ status: "Ordered" }), true)
assert.equal(isPurchaseOrderBulkArchiveEligible({ status: "Received" }), false)
assert.equal(isPurchaseOrderBulkArchiveEligible({ status: "Closed" }), false)
assert.equal(
  purchaseOrderBulkArchiveBlockMessage({ status: "Received" }),
  "Received or closed purchase orders cannot be bulk archived.",
)

console.log("test-bulk-archive-invoice-po-messages: ok")
