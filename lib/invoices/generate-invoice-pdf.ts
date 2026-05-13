import "server-only"

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import type { InvoiceDocumentContext } from "@/lib/invoices/invoice-document-context"
import { formatUsdFromCents, invoiceTaxRowLabel } from "@/lib/billing/invoice-financial-display"

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48
const GAP_SM = 4
const GAP_MD = 10
const GAP_LG = 16
const LINE = 14
const MAX_LOGO_H = 44

function moneyFromCents(cents: number): string {
  return formatUsdFromCents(Math.max(0, Math.round(cents)))
}

function pickLogoUrl(ctx: InvoiceDocumentContext): string | null {
  const d = ctx.documentLogoUrl?.trim()
  if (d) return d
  const l = ctx.logoUrl?.trim()
  return l || null
}

async function tryFetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const u = new URL(url)
    if (u.protocol !== "https:" && u.protocol !== "http:") return null
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

/** `y` is pdf baseline (from bottom). Returns next baseline below wrapped text. */
function drawWrappedDown(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = rgb(0.1, 0.12, 0.18),
): number {
  const paragraphs = text.split(/\r?\n/)
  let curY = y
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      curY -= size + GAP_SM
      continue
    }
    let line = ""
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next
      } else {
        if (line) {
          page.drawText(line, { x, y: curY, size, font, color })
          curY -= size + GAP_SM
        }
        line = w
      }
    }
    if (line) {
      page.drawText(line, { x, y: curY, size, font, color })
      curY -= size + GAP_SM
    }
  }
  return curY
}

export async function generateInvoicePdfBuffer(ctx: InvoiceDocumentContext): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page = pdf.addPage([PAGE_W, PAGE_H])
  /** Baseline from bottom — start below top margin. */
  let y = PAGE_H - MARGIN - 14

  const logoUrl = pickLogoUrl(ctx)
  if (logoUrl) {
    const bytes = await tryFetchBytes(logoUrl)
    if (bytes && bytes.byteLength > 16) {
      try {
        let img
        try {
          img = await pdf.embedPng(bytes)
        } catch {
          img = await pdf.embedJpg(bytes)
        }
        const iw = img.width
        const ih = img.height
        const scale = Math.min(150 / iw, MAX_LOGO_H / ih)
        const dw = iw * scale
        const dh = ih * scale
        page.drawImage(img, {
          x: PAGE_W - MARGIN - dw,
          y: y - dh + 10,
          width: dw,
          height: dh,
        })
      } catch {
        /* ignore */
      }
    }
  }

  page.drawText(ctx.organizationName, {
    x: MARGIN,
    y,
    size: 15,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  })
  y -= LINE + 6

  page.drawText("INVOICE", { x: MARGIN, y, size: 10, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
  y -= LINE

  page.drawText(ctx.invoiceNumberLabel, {
    x: MARGIN,
    y,
    size: 13,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  })
  y -= LINE + GAP_MD

  const meta = [
    `Issue date: ${ctx.issuedDateLabel}`,
    `Due date: ${ctx.dueDateLabel}`,
    `Status: ${ctx.statusDisplay}`,
  ]
  for (const line of meta) {
    page.drawText(line, { x: MARGIN, y, size: 9, font, color: rgb(0.25, 0.32, 0.42) })
    y -= LINE - 2
  }
  y -= GAP_SM

  page.drawText("Bill to", { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
  y -= LINE

  const billName = ctx.billToName?.trim() || ctx.customerCompanyName
  y = drawWrappedDown(page, billName, MARGIN, y, PAGE_W - MARGIN * 2, fontBold, 10)
  y -= GAP_SM
  if (ctx.billToAddressBlock) {
    y = drawWrappedDown(page, ctx.billToAddressBlock, MARGIN, y, PAGE_W - MARGIN * 2, font, 9)
  }
  y -= GAP_MD

  const svcBits = [
    ctx.equipmentName ? `Equipment / service: ${ctx.equipmentName}` : null,
    ctx.workOrderLabel ? `Work order: ${ctx.workOrderLabel}` : null,
    ctx.serviceDateLabel ? `Service date: ${ctx.serviceDateLabel}` : null,
    ctx.poNumber ? `PO: ${ctx.poNumber}` : null,
  ].filter(Boolean) as string[]

  if (svcBits.length) {
    page.drawText("Job reference", { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
    y -= LINE
    for (const line of svcBits) {
      y = drawWrappedDown(page, line, MARGIN, y, PAGE_W - MARGIN * 2, font, 9)
    }
    y -= GAP_MD
  }

  if (ctx.invoiceTitle) {
    page.drawText("Subject", { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
    y -= LINE
    y = drawWrappedDown(page, ctx.invoiceTitle, MARGIN, y, PAGE_W - MARGIN * 2, font, 10)
    y -= GAP_MD
  }

  const ensureSpace = (minLines: number) => {
    if (y < MARGIN + minLines * LINE) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN - 12
    }
  }

  ensureSpace(8)
  page.drawText("Line items", { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
  y -= LINE + GAP_SM

  const colDesc = MARGIN
  const colQty = PAGE_W - MARGIN - 200
  const colUnit = PAGE_W - MARGIN - 128
  const colAmt = PAGE_W - MARGIN - 62

  page.drawText("Description", {
    x: colDesc,
    y,
    size: 8,
    font: fontBold,
    color: rgb(0.35, 0.42, 0.52),
  })
  page.drawText("Qty", { x: colQty, y, size: 8, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
  page.drawText("Unit", { x: colUnit, y, size: 8, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
  page.drawText("Amount", { x: colAmt, y, size: 8, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
  y -= 16

  const lineItems =
    ctx.lineItems.length > 0
      ? ctx.lineItems
      : [
          {
            description: "Invoice total (stored as a single amount)",
            qty: 1,
            unitUsd: ctx.subtotalCents / 100,
            lineTotalUsd: ctx.subtotalCents / 100,
          },
        ]

  const MIN_LINE_ROW = 16

  for (const li of lineItems) {
    const desc = li.sku ? `${li.description} (SKU ${li.sku})` : li.description
    const qtyStr = String(Number.isInteger(li.qty) ? Math.round(li.qty) : li.qty)
    const unitStr = moneyFromCents(Math.round(li.unitUsd * 100))
    const amtStr = moneyFromCents(Math.round(li.lineTotalUsd * 100))

    ensureSpace(MIN_LINE_ROW + 4)
    const yBefore = y
    const yAfterDesc = drawWrappedDown(page, desc, colDesc, y, colQty - colDesc - 10, font, 9)

    page.drawText(qtyStr, { x: colQty, y: yBefore, size: 9, font, color: rgb(0.12, 0.16, 0.22) })
    page.drawText(unitStr, { x: colUnit, y: yBefore, size: 9, font, color: rgb(0.12, 0.16, 0.22) })
    page.drawText(amtStr, { x: colAmt, y: yBefore, size: 9, font, color: rgb(0.12, 0.16, 0.22) })

    y = Math.min(yAfterDesc, yBefore - MIN_LINE_ROW) - GAP_MD
  }

  y -= GAP_LG
  ensureSpace(10)

  const labelX = PAGE_W - MARGIN - 200
  const drawMoneyRow = (label: string, value: string, bold = false) => {
    const f = bold ? fontBold : font
    page.drawText(label, { x: labelX, y, size: 10, font: f, color: rgb(0.12, 0.16, 0.22) })
    const w = f.widthOfTextAtSize(value, 10)
    page.drawText(value, { x: PAGE_W - MARGIN - w, y, size: 10, font: f, color: rgb(0.12, 0.16, 0.22) })
    y -= LINE + 2
  }

  drawMoneyRow("Subtotal", moneyFromCents(ctx.subtotalCents))
  if (ctx.taxCents > 0) {
    drawMoneyRow(`${invoiceTaxRowLabel({ taxRatePercent: ctx.taxRatePercent })}`, moneyFromCents(ctx.taxCents))
  }
  drawMoneyRow("Total", moneyFromCents(ctx.grandTotalCents), true)
  drawMoneyRow("Amount paid", moneyFromCents(ctx.totalPaidCents))
  drawMoneyRow("Balance due", moneyFromCents(Math.max(0, ctx.balanceDueCents)), true)

  y -= GAP_MD

  const notesParts: string[] = []
  if (ctx.invoiceInstructions) notesParts.push(`Instructions\n${ctx.invoiceInstructions}`)
  if (ctx.customerNotes) notesParts.push(`Notes\n${ctx.customerNotes}`)

  if (notesParts.length) {
    ensureSpace(6)
    page.drawText("Terms & notes", { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
    y -= LINE + GAP_SM
    for (const block of notesParts) {
      ensureSpace(4)
      y = drawWrappedDown(page, block, MARGIN, y, PAGE_W - MARGIN * 2, font, 9)
      y -= GAP_MD
    }
  }

  return pdf.save()
}
