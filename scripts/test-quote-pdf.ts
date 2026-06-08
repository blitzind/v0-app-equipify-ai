import assert from "node:assert/strict"
import { buildQuoteEmailContent } from "../lib/email/templates"
import { buildQuotePdfDownloadHeaders, buildQuotePdfFilename } from "../lib/quotes/quote-pdf-filename"
import { generateQuotePdfBuffer } from "../lib/quotes/generate-quote-pdf"
import type { QuoteDocumentContext } from "../lib/quotes/quote-document-context"

async function main() {
  assert.equal(buildQuotePdfFilename("QT-000003"), "quote-QT-000003.pdf")
  assert.equal(buildQuotePdfFilename("  QT 000003  "), "quote-QT-000003.pdf")
  assert.equal(buildQuotePdfFilename(""), "quote-Quote.pdf")

  const headers = buildQuotePdfDownloadHeaders("quote-QT-000003.pdf")
  assert.equal(headers["Content-Type"], "application/pdf")
  assert.equal(headers["Content-Disposition"], 'attachment; filename="quote-QT-000003.pdf"')
  assert.equal(headers["Cache-Control"], "private, no-store")

  const emailBase = {
    organizationName: "Acme Calibration",
    customerName: "Beta Labs",
    quoteLabel: "QT-000003",
    amountLabel: "$1,250.00",
    expiresLabel: "Jul 15, 2026",
  }

  const withPdf = buildQuoteEmailContent({ ...emailBase, pdfAttached: true })
  assert.ok(!withPdf.html.includes("document generation is enabled"))
  assert.ok(withPdf.html.includes("attached as a PDF"))
  assert.ok(withPdf.text.includes("A PDF copy of this quote is attached."))

  const withoutPdf = buildQuoteEmailContent({ ...emailBase, pdfAttached: false })
  assert.ok(!withoutPdf.html.includes("document generation is enabled"))
  assert.ok(!withoutPdf.html.includes("attached as a PDF"))
  assert.ok(!withoutPdf.text.includes("A PDF copy of this quote is attached."))

  const minimalCtx: QuoteDocumentContext = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    quoteId: "00000000-0000-4000-8000-000000000002",
    customerId: "00000000-0000-4000-8000-000000000003",
    organizationName: "Acme Calibration",
    documentLogoUrl: null,
    logoUrl: null,
    companyAddress: null,
    companyPhone: null,
    companyWebsite: null,
    companyEmail: null,
    quoteNumberLabel: "QT-000003",
    quoteTitle: "Annual scale calibration",
    customerCompanyName: "Beta Labs",
    customerPhone: null,
    customerEmail: null,
    serviceAddressBlock: null,
    billingAddressBlock: null,
    equipmentName: "Floor scale FS-12",
    statusDisplay: "Sent",
    createdDateLabel: "Jun 1, 2026",
    expiresDateLabel: "Jul 15, 2026",
    authorName: null,
    poNumber: null,
    lineItems: [
      {
        description: "Calibration service",
        itemName: "Calibration service",
        detailNotes: null,
        qty: 1,
        unitUsd: 1250,
        lineTotalUsd: 1250,
      },
    ],
    customerNotes: "Please schedule during business hours.",
    subtotalCents: 125_000,
    taxCents: 0,
    taxRatePercent: null,
    totalCents: 125_000,
  }

  const minimalPdf = await generateQuotePdfBuffer(minimalCtx)
  assert.ok(minimalPdf.byteLength > 200)
  assert.equal(String.fromCharCode(...minimalPdf.slice(0, 4)), "%PDF")

  const fullCtx: QuoteDocumentContext = {
    ...minimalCtx,
    companyAddress: "11258 Monarch St, Suite B\nGarden Grove, CA 92841",
    companyPhone: "657-368-6770",
    companyWebsite: "www.example.com",
    companyEmail: "billing@example.com",
    customerPhone: "(661) 852-5718",
    customerEmail: "ap@customer.example",
    serviceAddressBlock: "Kern County Superintendent of Schools - ISEP\n315 East 18th Street\nBakersfield, California 93305",
    billingAddressBlock: "Kern County Superintendent of Schools\n1300 17th Street\nBakersfield, California 93301",
    authorName: "Josh Reynolds",
    poNumber: "PO-4455",
    lineItems: [
      {
        description: "Micro Audiometrics ES3M",
        itemName: "Micro Audiometrics ES3M",
        detailNotes: null,
        qty: 1,
        unitUsd: 160,
        lineTotalUsd: 160,
        taxable: true,
      },
      {
        description: "Screener Audiometer Calibration\n\nExhaustive Calibration, 1 transducer only",
        itemName: "Screener Audiometer Calibration",
        detailNotes: "Exhaustive Calibration, 1 transducer only",
        qty: 1,
        unitUsd: 160,
        lineTotalUsd: 160,
        taxable: false,
      },
      {
        description: "Shipping costs\n\nShipping costs associated with a special-order part",
        itemName: "Shipping costs",
        detailNotes: "Shipping costs associated with a special-order part",
        qty: 1,
        unitUsd: 10,
        lineTotalUsd: 10,
        taxable: false,
      },
    ],
    subtotalCents: 33_000,
    taxCents: 0,
    totalCents: 33_000,
  }

  const fullPdf = await generateQuotePdfBuffer(fullCtx)
  assert.ok(fullPdf.byteLength > minimalPdf.byteLength)

  const attachmentName = buildQuotePdfFilename(minimalCtx.quoteNumberLabel)
  assert.equal(attachmentName, "quote-QT-000003.pdf")

  console.log("quote-pdf tests passed")
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
