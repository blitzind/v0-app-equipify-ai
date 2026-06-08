import assert from "node:assert/strict"
import { buildInvoicePdfFilename } from "../lib/invoices/invoice-pdf-filename"
import { generateInvoicePdfBuffer } from "../lib/invoices/generate-invoice-pdf"
import type { InvoiceDocumentContext } from "../lib/invoices/invoice-document-context"

async function main() {
  assert.equal(buildInvoicePdfFilename("INV-00042"), "invoice-INV-00042.pdf")

  const minimalCtx: InvoiceDocumentContext = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    invoiceId: "00000000-0000-4000-8000-000000000002",
    customerId: "00000000-0000-4000-8000-000000000003",
    organizationName: "Acme Calibration",
    documentLogoUrl: null,
    logoUrl: null,
    companyAddress: null,
    companyPhone: null,
    companyWebsite: null,
    companyEmail: null,
    invoiceNumberLabel: "INV-00042",
    invoiceTitle: "Annual calibration",
    customerCompanyName: "Beta Labs",
    customerPhone: null,
    customerEmail: null,
    billToName: null,
    billToAddressBlock: "",
    serviceAddressBlock: null,
    equipmentName: null,
    workOrderLabel: null,
    serviceDateLabel: null,
    issuedDateLabel: "Jun 1, 2026",
    dueDateLabel: "Jul 1, 2026",
    statusDisplay: "Unpaid",
    dbStatusLower: "unpaid",
    authorName: null,
    lineItems: [],
    customerNotes: null,
    invoiceInstructions: null,
    poNumber: null,
    subtotalCents: 50_000,
    taxCents: 0,
    taxRatePercent: null,
    grandTotalCents: 50_000,
    totalPaidCents: 0,
    balanceDueCents: 50_000,
    allocationState: "unpaid",
    workOrderId: null,
    calibrationRecordId: null,
  }

  const minimalPdf = await generateInvoicePdfBuffer(minimalCtx)
  assert.ok(minimalPdf.byteLength > 200)
  assert.equal(String.fromCharCode(...minimalPdf.slice(0, 4)), "%PDF")

  const fullCtx: InvoiceDocumentContext = {
    ...minimalCtx,
    companyAddress: "11258 Monarch St, Suite B\nGarden Grove, CA 92841",
    companyPhone: "657-368-6770",
    companyWebsite: "www.example.com",
    companyEmail: "billing@example.com",
    customerPhone: "(661) 852-5718",
    customerEmail: "ap@customer.example",
    billToName: "Kern County Superintendent of Schools",
    billToAddressBlock: "Kern County Superintendent of Schools\n1300 17th Street\nBakersfield, California 93301",
    serviceAddressBlock: "Kern County Superintendent of Schools - ISEP\n315 East 18th Street\nBakersfield, California 93305",
    equipmentName: "Audiometer ES3M",
    workOrderLabel: "WO-000118",
    serviceDateLabel: "May 30, 2026",
    authorName: "Josh Reynolds",
    poNumber: "PO-4455",
    paymentTermsLabel: "Net 30",
    lineItems: [
      {
        description: "Calibration service\n\nExhaustive calibration, 1 transducer only",
        itemName: "Calibration service",
        detailNotes: "Exhaustive calibration, 1 transducer only",
        qty: 1,
        unitUsd: 160,
        lineTotalUsd: 160,
        taxable: false,
      },
      {
        description: "Shipping",
        itemName: "Shipping",
        detailNotes: null,
        qty: 1,
        unitUsd: 10,
        lineTotalUsd: 10,
        taxable: false,
      },
    ],
    subtotalCents: 17_000,
    taxCents: 0,
    grandTotalCents: 17_000,
    invoiceInstructions: "Please include the PO number on your remittance.",
  }

  const fullPdf = await generateInvoicePdfBuffer(fullCtx)
  assert.ok(fullPdf.byteLength > minimalPdf.byteLength)

  console.log("invoice-pdf tests passed")
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
