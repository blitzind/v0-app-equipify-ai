import assert from "node:assert/strict"
import {
  buildPurchaseOrderPdfDownloadHeaders,
  buildPurchaseOrderPdfFilename,
} from "../lib/purchase-orders/purchase-order-pdf-filename"
import { generatePurchaseOrderPdfBuffer } from "../lib/purchase-orders/generate-purchase-order-pdf"
import type { PurchaseOrderDocumentContext } from "../lib/purchase-orders/purchase-order-document-context"

async function main() {
  assert.equal(buildPurchaseOrderPdfFilename("PO-000123"), "purchase-order-PO-000123.pdf")

  const headers = buildPurchaseOrderPdfDownloadHeaders("purchase-order-PO-000123.pdf")
  assert.equal(headers["Content-Type"], "application/pdf")

  const minimalCtx: PurchaseOrderDocumentContext = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    purchaseOrderId: "00000000-0000-4000-8000-000000000002",
    organizationName: "Acme Supply",
    documentLogoUrl: null,
    logoUrl: null,
    companyAddress: null,
    companyPhone: null,
    companyWebsite: null,
    companyEmail: null,
    purchaseOrderNumberLabel: "PO-000123",
    statusDisplay: "Draft",
    orderDateLabel: "Jun 1, 2026",
    expectedDateLabel: "Jun 15, 2026",
    vendorName: "Parts Vendor Inc.",
    vendorEmail: null,
    vendorPhone: null,
    vendorContactName: null,
    customerCompanyName: null,
    customerPhone: null,
    customerEmail: null,
    shipToBlock: null,
    billToBlock: null,
    workOrderLabel: null,
    lineItems: [
      {
        description: "Replacement sensor",
        itemName: "Replacement sensor",
        detailNotes: null,
        qty: 2,
        unitUsd: 45,
        lineTotalUsd: 90,
      },
    ],
    notes: null,
    totalCents: 9_000,
  }

  const minimalPdf = await generatePurchaseOrderPdfBuffer(minimalCtx)
  assert.ok(minimalPdf.byteLength > 200)
  assert.equal(String.fromCharCode(...minimalPdf.slice(0, 4)), "%PDF")

  const fullCtx: PurchaseOrderDocumentContext = {
    ...minimalCtx,
    companyAddress: "11258 Monarch St, Suite B\nGarden Grove, CA 92841",
    companyPhone: "657-368-6770",
    companyWebsite: "www.example.com",
    companyEmail: "procurement@example.com",
    vendorEmail: "orders@vendor.example",
    vendorPhone: "800-555-0100",
    vendorContactName: "Alex Morgan",
    customerCompanyName: "Beta Labs",
    customerPhone: "(661) 852-5718",
    customerEmail: "receiving@customer.example",
    shipToBlock: "Beta Labs Receiving\n900 Industrial Way\nBakersfield, CA 93305",
    billToBlock: "Acme Supply Accounts Payable\n11258 Monarch St, Suite B\nGarden Grove, CA 92841",
    workOrderLabel: "WO-000118",
    lineItems: [
      {
        description: "Audiometer transducer\n\nSpecial-order part",
        itemName: "Audiometer transducer",
        detailNotes: "Special-order part",
        qty: 1,
        unitUsd: 160,
        lineTotalUsd: 160,
      },
      {
        description: "Shipping",
        itemName: "Shipping",
        detailNotes: "Ground shipping",
        qty: 1,
        unitUsd: 10,
        lineTotalUsd: 10,
      },
    ],
    notes: "Rush if possible.",
    totalCents: 17_000,
  }

  const fullPdf = await generatePurchaseOrderPdfBuffer(fullCtx)
  assert.ok(fullPdf.byteLength > minimalPdf.byteLength)

  console.log("purchase-order-pdf tests passed")
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
