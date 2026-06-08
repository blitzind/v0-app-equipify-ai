import "server-only"

import { PDFDocument } from "pdf-lib"
import type { InvoiceDocumentContext } from "@/lib/invoices/invoice-document-context"
import { invoiceTaxRowLabel } from "@/lib/billing/invoice-financial-display"
import { formatTaxedIndicator } from "@/lib/documents/document-address"
import {
  PdfDocumentLayout,
  PDF_COLOR_BODY,
  PDF_COLOR_LABEL,
  PDF_COLOR_META,
  PDF_COLOR_MUTED,
  PDF_COLOR_TITLE,
  PDF_GAP_LG,
  PDF_GAP_MD,
  PDF_GAP_SM,
  PDF_LINE,
  PDF_MARGIN,
  PDF_PAGE_W,
  createPdfFonts,
  drawWrappedDown,
  pdfMoneyFromCents,
  pickDocumentLogoUrl,
} from "@/lib/documents/pdf-lib-shared"

export async function generateInvoicePdfBuffer(ctx: InvoiceDocumentContext): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fonts = await createPdfFonts(pdf)
  const layout = new PdfDocumentLayout(pdf, fonts)

  layout.setContinuationHeader({
    organizationName: ctx.organizationName,
    documentTypeLabel: "Invoice",
    documentNumberLabel: ctx.invoiceNumberLabel,
    statusDisplay: ctx.statusDisplay,
  })

  await layout.drawLogo(pickDocumentLogoUrl(ctx.documentLogoUrl, ctx.logoUrl))

  layout.page.drawText(ctx.organizationName, {
    x: PDF_MARGIN,
    y: layout.y,
    size: 15,
    font: fonts.bold,
    color: PDF_COLOR_TITLE,
  })
  layout.y -= PDF_LINE + 6

  if (ctx.companyAddress?.trim()) {
    layout.drawWrappedBlock(ctx.companyAddress.trim(), { size: 8, color: PDF_COLOR_META })
    layout.y -= PDF_GAP_SM
  }
  for (const line of [ctx.companyPhone, ctx.companyWebsite, ctx.companyEmail]) {
    if (!line?.trim()) continue
    layout.drawTextLine(line.trim(), { size: 8 })
  }
  layout.y -= PDF_GAP_SM

  layout.page.drawText("INVOICE", {
    x: PDF_MARGIN,
    y: layout.y,
    size: 10,
    font: fonts.bold,
    color: PDF_COLOR_LABEL,
  })
  layout.y -= PDF_LINE

  layout.page.drawText(ctx.invoiceNumberLabel, {
    x: PDF_MARGIN,
    y: layout.y,
    size: 13,
    font: fonts.bold,
    color: PDF_COLOR_TITLE,
  })
  layout.y -= PDF_LINE + PDF_GAP_MD

  layout.drawTextLine(`Issue date: ${ctx.issuedDateLabel}`)
  layout.drawTextLine(`Due date: ${ctx.dueDateLabel}`)
  layout.drawTextLine(`Status: ${ctx.statusDisplay}`)
  if (ctx.paymentTermsLabel?.trim()) {
    layout.drawTextLine(`Terms: ${ctx.paymentTermsLabel.trim()}`)
  }
  layout.drawOptionalMetaLine("Author", ctx.authorName)
  layout.drawOptionalMetaLine("PO Number", ctx.poNumber)
  layout.y -= PDF_GAP_SM

  layout.drawSectionLabel("Bill to")
  const billName = ctx.billToName?.trim() || ctx.customerCompanyName
  layout.drawWrappedBlock(billName, { size: 10, bold: true })
  layout.y -= PDF_GAP_SM
  if (ctx.billToAddressBlock) {
    layout.drawWrappedBlock(ctx.billToAddressBlock, { size: 9 })
  }
  if (ctx.customerPhone?.trim()) {
    layout.drawTextLine(ctx.customerPhone.trim())
  }
  if (ctx.customerEmail?.trim()) {
    layout.drawTextLine(ctx.customerEmail.trim())
  }
  layout.drawOptionalAddressSection("Service address", ctx.serviceAddressBlock)
  layout.y -= PDF_GAP_MD

  const svcBits = [
    ctx.equipmentName ? `Equipment / service: ${ctx.equipmentName}` : null,
    ctx.workOrderLabel ? `Work order: ${ctx.workOrderLabel}` : null,
    ctx.serviceDateLabel ? `Service date: ${ctx.serviceDateLabel}` : null,
  ].filter(Boolean) as string[]

  if (svcBits.length) {
    layout.drawSectionLabel("Job reference")
    for (const line of svcBits) {
      layout.drawWrappedBlock(line, { size: 9 })
    }
    layout.y -= PDF_GAP_MD
  }

  if (ctx.invoiceTitle) {
    layout.drawSectionLabel("Subject")
    layout.drawWrappedBlock(ctx.invoiceTitle, { size: 10 })
    layout.y -= PDF_GAP_MD
  }

  layout.ensureSpace(8)
  layout.drawSectionLabel("Line items")
  layout.y -= PDF_GAP_SM

  const colDesc = PDF_MARGIN
  const colQty = PDF_PAGE_W - PDF_MARGIN - 230
  const colTaxed = PDF_PAGE_W - PDF_MARGIN - 170
  const colUnit = PDF_PAGE_W - PDF_MARGIN - 128
  const colAmt = PDF_PAGE_W - PDF_MARGIN - 62

  layout.page.drawText("Description", {
    x: colDesc,
    y: layout.y,
    size: 8,
    font: fonts.bold,
    color: PDF_COLOR_LABEL,
  })
  layout.page.drawText("Qty", { x: colQty, y: layout.y, size: 8, font: fonts.bold, color: PDF_COLOR_LABEL })
  layout.page.drawText("Taxed", { x: colTaxed, y: layout.y, size: 8, font: fonts.bold, color: PDF_COLOR_LABEL })
  layout.page.drawText("Unit", { x: colUnit, y: layout.y, size: 8, font: fonts.bold, color: PDF_COLOR_LABEL })
  layout.page.drawText("Amount", { x: colAmt, y: layout.y, size: 8, font: fonts.bold, color: PDF_COLOR_LABEL })
  layout.y -= 16

  const lineItems =
    ctx.lineItems.length > 0
      ? ctx.lineItems
      : [
          {
            description: "Invoice total (stored as a single amount)",
            itemName: "Invoice total (stored as a single amount)",
            detailNotes: null,
            qty: 1,
            unitUsd: ctx.subtotalCents / 100,
            lineTotalUsd: ctx.subtotalCents / 100,
          },
        ]

  const MIN_LINE_ROW = 16

  for (const li of lineItems) {
    const desc = li.sku ? `${li.itemName} (SKU ${li.sku})` : li.itemName
    const qtyStr = String(Number.isInteger(li.qty) ? Math.round(li.qty) : li.qty)
    const taxedStr = formatTaxedIndicator(li.taxable) ?? "—"
    const unitStr = pdfMoneyFromCents(Math.round(li.unitUsd * 100))
    const amtStr = pdfMoneyFromCents(Math.round(li.lineTotalUsd * 100))

    layout.ensureSpace(MIN_LINE_ROW + (li.detailNotes ? 8 : 4))
    const yBefore = layout.y
    const yAfterDesc = drawWrappedDown(
      layout.page,
      desc,
      colDesc,
      layout.y,
      colQty - colDesc - 10,
      fonts.regular,
      9,
    )

    layout.page.drawText(qtyStr, { x: colQty, y: yBefore, size: 9, font: fonts.regular, color: PDF_COLOR_BODY })
    layout.page.drawText(taxedStr, { x: colTaxed, y: yBefore, size: 9, font: fonts.regular, color: PDF_COLOR_BODY })
    layout.page.drawText(unitStr, { x: colUnit, y: yBefore, size: 9, font: fonts.regular, color: PDF_COLOR_BODY })
    layout.page.drawText(amtStr, { x: colAmt, y: yBefore, size: 9, font: fonts.regular, color: PDF_COLOR_BODY })

    let rowBottom = Math.min(yAfterDesc, yBefore - MIN_LINE_ROW)
    if (li.detailNotes?.trim()) {
      rowBottom = drawWrappedDown(
        layout.page,
        li.detailNotes.trim(),
        colDesc + 8,
        rowBottom - PDF_GAP_SM,
        colQty - colDesc - 18,
        fonts.regular,
        8,
        PDF_COLOR_META,
      )
    }
    layout.y = rowBottom - PDF_GAP_MD
  }

  layout.y -= PDF_GAP_LG
  layout.ensureSpace(10)

  layout.drawMoneyRow("Subtotal", pdfMoneyFromCents(ctx.subtotalCents))
  if (ctx.taxCents > 0) {
    layout.drawMoneyRow(
      invoiceTaxRowLabel({ taxRatePercent: ctx.taxRatePercent }),
      pdfMoneyFromCents(ctx.taxCents),
    )
  }
  layout.drawMoneyRow("Total", pdfMoneyFromCents(ctx.grandTotalCents), true)
  layout.drawMoneyRow("Amount paid", pdfMoneyFromCents(ctx.totalPaidCents))
  layout.drawMoneyRow("Balance due", pdfMoneyFromCents(Math.max(0, ctx.balanceDueCents)), true)
  layout.y -= PDF_GAP_MD

  const notesParts: string[] = []
  if (ctx.invoiceInstructions) notesParts.push(`Instructions\n${ctx.invoiceInstructions}`)
  if (ctx.customerNotes) notesParts.push(`Notes\n${ctx.customerNotes}`)

  if (notesParts.length) {
    layout.ensureSpace(6)
    layout.drawSectionLabel("Terms & notes")
    layout.y -= PDF_GAP_SM
    for (const block of notesParts) {
      layout.ensureSpace(4)
      layout.drawWrappedBlock(block, { size: 9 })
      layout.y -= PDF_GAP_MD
    }
  }

  layout.ensureSpace(8)
  layout.drawWrappedBlock("Thank you for your business!", { size: 9, bold: true })
  layout.y -= PDF_GAP_SM

  if (ctx.companyAddress?.trim()) {
    layout.drawSectionLabel("Please remit payment to")
    layout.drawWrappedBlock(ctx.companyAddress.trim(), { size: 8, color: PDF_COLOR_META })
    layout.y -= PDF_GAP_MD
  }

  if (ctx.invoiceInstructions?.trim()) {
    layout.drawWrappedBlock(ctx.invoiceInstructions.trim(), { size: 8, color: PDF_COLOR_MUTED })
  }

  layout.stampPageNumbers()
  return pdf.save()
}
