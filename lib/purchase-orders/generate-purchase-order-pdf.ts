import "server-only"

import { PDFDocument } from "pdf-lib"
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
import type { PurchaseOrderDocumentContext } from "@/lib/purchase-orders/purchase-order-document-context"

export async function generatePurchaseOrderPdfBuffer(
  ctx: PurchaseOrderDocumentContext,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fonts = await createPdfFonts(pdf)
  const layout = new PdfDocumentLayout(pdf, fonts)

  layout.setContinuationHeader({
    organizationName: ctx.organizationName,
    documentTypeLabel: "Purchase Order",
    documentNumberLabel: ctx.purchaseOrderNumberLabel,
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

  layout.page.drawText("PURCHASE ORDER", {
    x: PDF_MARGIN,
    y: layout.y,
    size: 10,
    font: fonts.bold,
    color: PDF_COLOR_LABEL,
  })
  layout.y -= PDF_LINE

  layout.page.drawText(ctx.purchaseOrderNumberLabel, {
    x: PDF_MARGIN,
    y: layout.y,
    size: 13,
    font: fonts.bold,
    color: PDF_COLOR_TITLE,
  })
  layout.y -= PDF_LINE + PDF_GAP_MD

  layout.drawTextLine(`Order date: ${ctx.orderDateLabel}`)
  layout.drawTextLine(`Expected: ${ctx.expectedDateLabel}`)
  layout.drawTextLine(`Status: ${ctx.statusDisplay}`)
  layout.y -= PDF_GAP_SM

  layout.drawSectionLabel("Vendor")
  layout.drawWrappedBlock(ctx.vendorName, { size: 10, bold: true })
  layout.y -= PDF_GAP_SM
  layout.drawOptionalMetaLine("Contact", ctx.vendorContactName)
  layout.drawOptionalMetaLine("Email", ctx.vendorEmail)
  layout.drawOptionalMetaLine("Phone", ctx.vendorPhone)
  layout.y -= PDF_GAP_MD

  if (ctx.customerCompanyName?.trim()) {
    layout.drawSectionLabel("Customer")
    layout.drawWrappedBlock(ctx.customerCompanyName.trim(), { size: 10, bold: true })
    layout.y -= PDF_GAP_SM
    if (ctx.customerPhone?.trim()) layout.drawTextLine(ctx.customerPhone.trim())
    if (ctx.customerEmail?.trim()) layout.drawTextLine(ctx.customerEmail.trim())
    layout.y -= PDF_GAP_MD
  }

  layout.drawOptionalAddressSection("Ship to", ctx.shipToBlock)
  layout.drawOptionalAddressSection("Bill to", ctx.billToBlock)

  if (ctx.workOrderLabel?.trim()) {
    layout.drawSectionLabel("Work order")
    layout.drawWrappedBlock(ctx.workOrderLabel.trim(), { size: 9 })
    layout.y -= PDF_GAP_MD
  }

  layout.ensureSpace(8)
  layout.drawSectionLabel("Line items")
  layout.y -= PDF_GAP_SM

  const colDesc = PDF_MARGIN
  const colQty = PDF_PAGE_W - PDF_MARGIN - 200
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
  layout.page.drawText("Unit", { x: colUnit, y: layout.y, size: 8, font: fonts.bold, color: PDF_COLOR_LABEL })
  layout.page.drawText("Amount", { x: colAmt, y: layout.y, size: 8, font: fonts.bold, color: PDF_COLOR_LABEL })
  layout.y -= 16

  const lineItems =
    ctx.lineItems.length > 0
      ? ctx.lineItems
      : [
          {
            description: "Purchase order total",
            itemName: "Purchase order total",
            detailNotes: null,
            qty: 1,
            unitUsd: ctx.totalCents / 100,
            lineTotalUsd: ctx.totalCents / 100,
          },
        ]

  const MIN_LINE_ROW = 16

  for (const li of lineItems) {
    const desc = li.sku ? `${li.itemName} (SKU ${li.sku})` : li.itemName
    const qtyStr = String(Number.isInteger(li.qty) ? Math.round(li.qty) : li.qty)
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
  layout.ensureSpace(4)
  layout.drawMoneyRow("Total", pdfMoneyFromCents(ctx.totalCents), true)
  layout.y -= PDF_GAP_MD

  if (ctx.notes) {
    layout.ensureSpace(6)
    layout.drawSectionLabel("Notes")
    layout.y -= PDF_GAP_SM
    layout.drawWrappedBlock(ctx.notes, { size: 9 })
    layout.y -= PDF_GAP_MD
  }

  layout.ensureSpace(4)
  layout.drawWrappedBlock(
    `Purchase order issued by ${ctx.organizationName}.`,
    { size: 8, color: PDF_COLOR_MUTED },
  )

  layout.stampPageNumbers()
  return pdf.save()
}
