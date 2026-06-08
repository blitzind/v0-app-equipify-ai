import "server-only"

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import { formatUsdFromCents } from "@/lib/billing/invoice-financial-display"

export const PDF_PAGE_W = 595.28
export const PDF_PAGE_H = 841.89
export const PDF_MARGIN = 48
export const PDF_GAP_SM = 4
export const PDF_GAP_MD = 10
export const PDF_GAP_LG = 16
export const PDF_LINE = 14
export const PDF_MAX_LOGO_H = 44

export const PDF_COLOR_TITLE = rgb(0.06, 0.09, 0.16)
export const PDF_COLOR_LABEL = rgb(0.35, 0.42, 0.52)
export const PDF_COLOR_META = rgb(0.25, 0.32, 0.42)
export const PDF_COLOR_BODY = rgb(0.12, 0.16, 0.22)
export const PDF_COLOR_MUTED = rgb(0.4, 0.45, 0.52)

export function pdfMoneyFromCents(cents: number): string {
  return formatUsdFromCents(Math.max(0, Math.round(cents)))
}

export function pickDocumentLogoUrl(
  documentLogoUrl: string | null | undefined,
  logoUrl: string | null | undefined,
): string | null {
  const d = documentLogoUrl?.trim()
  if (d) return d
  const l = logoUrl?.trim()
  return l || null
}

export async function tryFetchPdfImageBytes(url: string): Promise<Uint8Array | null> {
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
export function drawWrappedDown(
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
      curY -= size + PDF_GAP_SM
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
          curY -= size + PDF_GAP_SM
        }
        line = w
      }
    }
    if (line) {
      page.drawText(line, { x, y: curY, size, font, color })
      curY -= size + PDF_GAP_SM
    }
  }
  return curY
}

export type PdfFonts = {
  regular: PDFFont
  bold: PDFFont
}

export async function createPdfFonts(pdf: PDFDocument): Promise<PdfFonts> {
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  return { regular, bold }
}

export type PdfContinuationHeader = {
  organizationName: string
  documentTypeLabel: string
  documentNumberLabel: string
  statusDisplay?: string | null
}

export class PdfDocumentLayout {
  readonly pdf: PDFDocument
  readonly fonts: PdfFonts
  page: PDFPage
  y: number
  private continuationHeader: PdfContinuationHeader | null = null

  constructor(pdf: PDFDocument, fonts: PdfFonts) {
    this.pdf = pdf
    this.fonts = fonts
    this.page = pdf.addPage([PDF_PAGE_W, PDF_PAGE_H])
    this.y = PDF_PAGE_H - PDF_MARGIN - 14
  }

  setContinuationHeader(header: PdfContinuationHeader): void {
    this.continuationHeader = header
  }

  ensureSpace(minLines: number): void {
    if (this.y >= PDF_MARGIN + minLines * PDF_LINE) return
    this.page = this.pdf.addPage([PDF_PAGE_W, PDF_PAGE_H])
    this.y = PDF_PAGE_H - PDF_MARGIN - 12
    if (this.continuationHeader) {
      this.drawContinuationHeader()
    }
  }

  private drawContinuationHeader(): void {
    const h = this.continuationHeader
    if (!h) return
    const bits = [h.organizationName, h.statusDisplay?.trim(), h.documentTypeLabel, h.documentNumberLabel].filter(
      Boolean,
    ) as string[]
    this.page.drawText(bits.join(" · "), {
      x: PDF_MARGIN,
      y: this.y,
      size: 8,
      font: this.fonts.regular,
      color: PDF_COLOR_META,
    })
    this.y -= PDF_LINE
  }

  drawSectionLabel(label: string): void {
    this.page.drawText(label, {
      x: PDF_MARGIN,
      y: this.y,
      size: 9,
      font: this.fonts.bold,
      color: PDF_COLOR_LABEL,
    })
    this.y -= PDF_LINE
  }

  drawTextLine(text: string, opts?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> }): void {
    const size = opts?.size ?? 9
    const font = opts?.bold ? this.fonts.bold : this.fonts.regular
    this.page.drawText(text, {
      x: PDF_MARGIN,
      y: this.y,
      size,
      font,
      color: opts?.color ?? PDF_COLOR_META,
    })
    this.y -= PDF_LINE - 2
  }

  drawWrappedBlock(
    text: string,
    opts?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; maxWidth?: number },
  ): void {
    const size = opts?.size ?? 9
    const font = opts?.bold ? this.fonts.bold : this.fonts.regular
    const maxWidth = opts?.maxWidth ?? PDF_PAGE_W - PDF_MARGIN * 2
    this.y = drawWrappedDown(
      this.page,
      text,
      PDF_MARGIN,
      this.y,
      maxWidth,
      font,
      size,
      opts?.color ?? PDF_COLOR_BODY,
    )
  }

  drawOptionalAddressSection(label: string, block: string | null | undefined): void {
    const trimmed = block?.trim()
    if (!trimmed) return
    this.ensureSpace(6)
    this.drawSectionLabel(label)
    this.drawWrappedBlock(trimmed, { size: 9 })
    this.y -= PDF_GAP_SM
  }

  drawOptionalMetaLine(prefix: string, value: string | null | undefined): void {
    const trimmed = value?.trim()
    if (!trimmed) return
    this.drawTextLine(`${prefix}: ${trimmed}`)
  }

  drawMoneyRow(label: string, value: string, bold = false): void {
    const labelX = PDF_PAGE_W - PDF_MARGIN - 200
    const font = bold ? this.fonts.bold : this.fonts.regular
    this.page.drawText(label, { x: labelX, y: this.y, size: 10, font, color: PDF_COLOR_BODY })
    const w = font.widthOfTextAtSize(value, 10)
    this.page.drawText(value, {
      x: PDF_PAGE_W - PDF_MARGIN - w,
      y: this.y,
      size: 10,
      font,
      color: PDF_COLOR_BODY,
    })
    this.y -= PDF_LINE + 2
  }

  async drawLogo(logoUrl: string | null): Promise<void> {
    if (!logoUrl) return
    const bytes = await tryFetchPdfImageBytes(logoUrl)
    if (!bytes || bytes.byteLength <= 16) return
    try {
      let img
      try {
        img = await this.pdf.embedPng(bytes)
      } catch {
        img = await this.pdf.embedJpg(bytes)
      }
      const iw = img.width
      const ih = img.height
      const scale = Math.min(150 / iw, PDF_MAX_LOGO_H / ih)
      const dw = iw * scale
      const dh = ih * scale
      this.page.drawImage(img, {
        x: PDF_PAGE_W - PDF_MARGIN - dw,
        y: this.y - dh + 10,
        width: dw,
        height: dh,
      })
    } catch {
      /* ignore */
    }
  }

  stampPageNumbers(): void {
    const pages = this.pdf.getPages()
    const total = pages.length
    if (total <= 1) return
    for (let i = 0; i < total; i++) {
      const page = pages[i]
      const label = `${i + 1} / ${total}`
      const w = this.fonts.regular.widthOfTextAtSize(label, 8)
      page.drawText(label, {
        x: PDF_PAGE_W - PDF_MARGIN - w,
        y: PDF_MARGIN - 18,
        size: 8,
        font: this.fonts.regular,
        color: PDF_COLOR_META,
      })
    }
  }
}
