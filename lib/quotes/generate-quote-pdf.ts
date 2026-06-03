import "server-only"

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import { formatUsdFromCents } from "@/lib/billing/invoice-financial-display"
import type { QuoteDocumentContext } from "@/lib/quotes/quote-document-context"

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

function pickLogoUrl(ctx: QuoteDocumentContext): string | null {
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

export async function generateQuotePdfBuffer(ctx: QuoteDocumentContext): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page = pdf.addPage([PAGE_W, PAGE_H])
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

  page.drawText("QUOTE", { x: MARGIN, y, size: 10, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
  y -= LINE

  page.drawText(ctx.quoteNumberLabel, {
    x: MARGIN,
    y,
    size: 13,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  })
  y -= LINE + GAP_MD

  const meta = [
    `Issued: ${ctx.createdDateLabel}`,
    `Valid through: ${ctx.expiresDateLabel}`,
    `Status: ${ctx.statusDisplay}`,
  ]
  for (const line of meta) {
    page.drawText(line, { x: MARGIN, y, size: 9, font, color: rgb(0.25, 0.32, 0.42) })
    y -= LINE - 2
  }
  y -= GAP_SM

  page.drawText("Customer", { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
  y -= LINE
  y = drawWrappedDown(page, ctx.customerCompanyName, MARGIN, y, PAGE_W - MARGIN * 2, fontBold, 10)
  y -= GAP_MD

  const refBits = [
    ctx.equipmentName ? `Equipment: ${ctx.equipmentName}` : null,
  ].filter(Boolean) as string[]

  if (refBits.length) {
    page.drawText("Reference", { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
    y -= LINE
    for (const line of refBits) {
      y = drawWrappedDown(page, line, MARGIN, y, PAGE_W - MARGIN * 2, font, 9)
    }
    y -= GAP_MD
  }

  if (ctx.quoteTitle) {
    page.drawText("Scope", { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
    y -= LINE
    y = drawWrappedDown(page, ctx.quoteTitle, MARGIN, y, PAGE_W - MARGIN * 2, font, 10)
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
  const colAmt = PAGE_W - MARGIN - 62

  page.drawText("Description", {
    x: colDesc,
    y,
    size: 8,
    font: fontBold,
    color: rgb(0.35, 0.42, 0.52),
  })
  page.drawText("Amount", { x: colAmt, y, size: 8, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
  y -= 16

  const lineItems =
    ctx.lineItems.length > 0
      ? ctx.lineItems
      : [
          {
            description: ctx.quoteTitle?.trim() || "Quoted services",
            qty: 1,
            unitUsd: ctx.totalCents / 100,
            lineTotalUsd: ctx.totalCents / 100,
          },
        ]

  const MIN_LINE_ROW = 16

  for (const li of lineItems) {
    const desc =
      li.qty !== 1 || li.unitUsd !== li.lineTotalUsd
        ? `${li.description} (${li.qty} × ${moneyFromCents(Math.round(li.unitUsd * 100))})`
        : li.description
    const amtStr = moneyFromCents(Math.round(li.lineTotalUsd * 100))

    ensureSpace(MIN_LINE_ROW + 4)
    const yBefore = y
    const yAfterDesc = drawWrappedDown(page, desc, colDesc, y, colAmt - colDesc - 10, font, 9)
    page.drawText(amtStr, { x: colAmt, y: yBefore, size: 9, font, color: rgb(0.12, 0.16, 0.22) })
    y = Math.min(yAfterDesc, yBefore - MIN_LINE_ROW) - GAP_MD
  }

  y -= GAP_LG
  ensureSpace(4)

  const labelX = PAGE_W - MARGIN - 200
  page.drawText("Total", { x: labelX, y, size: 10, font: fontBold, color: rgb(0.12, 0.16, 0.22) })
  const totalStr = moneyFromCents(ctx.totalCents)
  const totalW = fontBold.widthOfTextAtSize(totalStr, 10)
  page.drawText(totalStr, {
    x: PAGE_W - MARGIN - totalW,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.22),
  })
  y -= LINE + GAP_MD

  if (ctx.customerNotes) {
    ensureSpace(6)
    page.drawText("Notes", { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.35, 0.42, 0.52) })
    y -= LINE + GAP_SM
    y = drawWrappedDown(page, ctx.customerNotes, MARGIN, y, PAGE_W - MARGIN * 2, font, 9)
    y -= GAP_MD
  }

  ensureSpace(3)
  y = drawWrappedDown(
    page,
    `Quote prepared by ${ctx.organizationName}. Values are estimates until approved in writing.`,
    MARGIN,
    y,
    PAGE_W - MARGIN * 2,
    font,
    8,
    rgb(0.4, 0.45, 0.52),
  )

  return pdf.save()
}
