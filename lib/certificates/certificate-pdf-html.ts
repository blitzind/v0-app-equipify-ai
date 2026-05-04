import type { CalibrationTemplate, CalibrationTemplateField } from "@/lib/calibration-certificates"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function dashIfEmpty(s: string): string {
  const t = s.trim()
  return t ? t : "—"
}

/** Split display value for template fields into primary cell + unit column. */
function formatFieldCells(
  field: CalibrationTemplateField,
  raw: unknown,
): { valueHtml: string; unitText: string } {
  if (field.type === "section_heading") {
    return { valueHtml: "", unitText: "" }
  }
  if (field.type === "checkbox") {
    return { valueHtml: escapeHtml(raw ? "Yes" : "No"), unitText: "—" }
  }
  if (field.type === "pass_fail") {
    const v = raw === "fail" ? "fail" : "pass"
    const badge =
      v === "fail"
        ? `<span class="badge badge-fail">${escapeHtml("FAIL")}</span>`
        : `<span class="badge badge-pass">${escapeHtml("PASS")}</span>`
    return { valueHtml: badge, unitText: "—" }
  }
  if (field.type === "number") {
    if (raw === "" || raw === undefined || raw === null) {
      return { valueHtml: "—", unitText: dashIfEmpty(field.unit?.trim() ?? "") }
    }
    const n = typeof raw === "number" ? raw : Number(raw)
    if (!Number.isFinite(n)) return { valueHtml: "—", unitText: dashIfEmpty(field.unit?.trim() ?? "") }
    const unit = field.unit?.trim() ?? ""
    return {
      valueHtml: escapeHtml(String(n)),
      unitText: unit ? escapeHtml(unit) : "—",
    }
  }
  if (raw == null) return { valueHtml: "—", unitText: "—" }
  const t = String(raw).trim()
  return { valueHtml: escapeHtml(t || "—"), unitText: "—" }
}

export type CertificatePdfModel = {
  companyName: string
  logoUrl?: string | null
  /** Template name (shown as subtitle under main title). */
  templateName: string
  workOrderLabel: string
  workOrderDescription?: string
  customerName: string
  /** Site / service address line. */
  serviceLocation?: string
  equipmentName: string
  /** Equipment code / model identifier when available. */
  equipmentCode?: string | null
  equipmentSerialNumber?: string | null
  /** Certificate / calibration record id (full uuid ok). */
  calibrationRecordId?: string | null
  completedAtLabel?: string
  /** Preferred service date label (e.g. completion date). */
  serviceDateLabel?: string
  template: CalibrationTemplate
  values: Record<string, unknown>
  technicianName: string
  technicianSignatureDataUrl?: string | null
  customerSignatureUrl?: string | null
  customerSignedBy?: string | null
  /** ISO or display date for technician signature line. */
  technicianSignedDateLabel?: string | null
  /** ISO or display date for customer signature line. */
  customerSignedDateLabel?: string | null
  /** Printed / generated timestamp label (defaults to now). */
  printedAtLabel?: string
  technicianNotes?: string
}

function shortCertificateId(id: string | null | undefined): string {
  if (!id?.trim()) return ""
  const t = id.trim()
  if (t.length <= 13) return t
  return `${t.slice(0, 8)}…${t.slice(-4)}`
}

export function buildCertificatePdfHtml(model: CertificatePdfModel): string {
  const printed = model.printedAtLabel ?? new Date().toLocaleString("en-US")

  const bodyRows: string[] = []
  for (const field of model.template.fields) {
    if (field.type === "section_heading") {
      bodyRows.push(`<tr class="section-heading-row"><td colspan="3">${escapeHtml(field.label)}</td></tr>`)
      continue
    }
    const { valueHtml, unitText } = formatFieldCells(field, model.values[field.id])
    bodyRows.push(`<tr class="field-row">
  <td class="col-label">${escapeHtml(field.label)}${field.required ? ' <span class="req">*</span>' : ""}</td>
  <td class="col-value">${valueHtml}</td>
  <td class="col-unit">${unitText}</td>
</tr>`)
  }

  const logoBlock = model.logoUrl
    ? `<img class="logo" src="${escapeHtml(model.logoUrl)}" alt="" />`
    : `<div class="logo-text">${escapeHtml(model.companyName)}</div>`

  const certIdLine =
    model.calibrationRecordId?.trim() &&
    `<p class="cert-meta-line">Certificate ID: <strong>${escapeHtml(shortCertificateId(model.calibrationRecordId))}</strong></p>`

  const woLine = `<p class="cert-meta-line">Work Order: <strong>${escapeHtml(model.workOrderLabel)}</strong></p>`

  const notesBlock =
    model.technicianNotes?.trim()
      ? `<section class="notes-section">
  <h2 class="section-title">Technician Notes</h2>
  <div class="notes-body">${escapeHtml(model.technicianNotes.trim()).replace(/\n/g, "<br />")}</div>
</section>`
      : ""

  const techDate = dashIfEmpty(model.technicianSignedDateLabel?.trim() ?? "")
  const custDate = dashIfEmpty(model.customerSignedDateLabel?.trim() ?? "")
  const custName = dashIfEmpty(model.customerSignedBy?.trim() ?? "")

  const techSigImg =
    model.technicianSignatureDataUrl && model.technicianSignatureDataUrl.length > 2
      ? `<img class="sig-img" src="${escapeHtml(model.technicianSignatureDataUrl)}" alt="" />`
      : `<div class="sig-placeholder">Signature on file</div>`

  const custSigImg =
    model.customerSignatureUrl && model.customerSignatureUrl.length > 2
      ? `<img class="sig-img" src="${escapeHtml(model.customerSignatureUrl)}" alt="" />`
      : `<div class="sig-placeholder muted">Not captured</div>`

  const serviceDate = dashIfEmpty(model.serviceDateLabel?.trim() ?? model.completedAtLabel?.trim() ?? "")

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(model.companyName)} — Calibration Certificate</title>
  <style>
    @page {
      size: letter;
      margin: 40px;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      font-weight: 400;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      max-width: 7.5in;
      margin: 0 auto;
      padding: 0;
    }
    /* --- Header --- */
    .header-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 8px;
    }
    .logo {
      max-height: 40px;
      max-width: 220px;
      object-fit: contain;
      display: block;
    }
    .logo-text {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #111;
      max-width: 240px;
      line-height: 1.2;
    }
    .header-right {
      text-align: right;
      flex: 1;
      min-width: 0;
    }
    .doc-title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #0a0a0a;
    }
    .doc-subtitle {
      margin: 6px 0 0;
      font-size: 13px;
      font-weight: 600;
      color: #444;
    }
    .divider {
      height: 1px;
      background: #ccc;
      margin: 14px 0 18px;
      border: 0;
    }
    .cert-meta-line {
      margin: 4px 0 0;
      font-size: 11px;
      color: #333;
      font-weight: 400;
    }
    .cert-meta-line strong { font-weight: 600; }

    /* --- Job grid --- */
    .section-title {
      margin: 0 0 10px;
      font-size: 15px;
      font-weight: 600;
      color: #111;
      letter-spacing: -0.02em;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 32px;
      margin-bottom: 22px;
    }
    .info-col { display: flex; flex-direction: column; gap: 10px; }
    .kv {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .kv-label {
      font-size: 11px;
      font-weight: 600;
      color: #444;
      text-transform: none;
    }
    .kv-value {
      font-size: 12px;
      font-weight: 400;
      color: #111;
    }

    /* --- Certificate fields table --- */
    .fields-section { margin-bottom: 20px; }
    .fields-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .fields-table thead th {
      font-size: 11px;
      font-weight: 600;
      text-align: left;
      padding: 8px 10px 8px 0;
      border-bottom: 1px solid #bbb;
      color: #333;
    }
    .fields-table thead th:nth-child(2) { width: 42%; }
    .fields-table thead th:nth-child(3) { width: 18%; text-align: left; }
    .section-heading-row td {
      font-size: 14px;
      font-weight: 600;
      padding: 16px 0 8px;
      border-bottom: none;
      color: #111;
    }
    .field-row td {
      padding: 8px 10px 8px 0;
      vertical-align: top;
      border-bottom: 1px solid #e8e8e8;
    }
    .col-label { font-weight: 500; color: #222; }
    .col-value { font-weight: 400; color: #111; }
    .col-unit { font-weight: 400; color: #444; }
    .req { color: #666; font-weight: 400; }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .badge-pass {
      color: #14532d;
      background: #ecfdf3;
      border: 1px solid #86efac;
    }
    .badge-fail {
      color: #7f1d1d;
      background: #fef2f2;
      border: 1px solid #fca5a5;
    }

    /* --- Notes --- */
    .notes-section {
      margin: 20px 0 24px;
      padding-top: 4px;
    }
    .notes-body {
      margin-top: 8px;
      padding: 12px 14px;
      background: #fafafa;
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.55;
      color: #222;
      border: 1px solid #eee;
    }

    /* --- Signatures --- */
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-top: 8px;
      padding-top: 8px;
    }
    .sig-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sig-label-top {
      font-size: 11px;
      font-weight: 600;
      color: #333;
      margin-bottom: 2px;
    }
    .sig-line {
      border-top: 1px solid #333;
      padding-top: 8px;
      min-height: 56px;
    }
    .sig-img {
      max-height: 52px;
      max-width: 100%;
      object-fit: contain;
      display: block;
    }
    .sig-placeholder {
      font-size: 11px;
      color: #555;
      font-style: italic;
      padding: 8px 0;
    }
    .sig-placeholder.muted { color: #888; }
    .sig-name {
      font-size: 12px;
      font-weight: 600;
      margin-top: 6px;
      color: #111;
    }
    .sig-date {
      font-size: 11px;
      color: #444;
      margin-top: 2px;
    }

    .footer-note {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e5e5e5;
      font-size: 10px;
      color: #777;
    }
    .print-stamp {
      margin-top: 10px;
      font-size: 10px;
      color: #888;
    }

    @media print {
      .page { max-width: none; }
      .field-row td { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div class="header-top">
        <div class="header-left">${logoBlock}</div>
        <div class="header-right">
          <h1 class="doc-title">Calibration Certificate</h1>
          <p class="doc-subtitle">${escapeHtml(model.templateName)}</p>
        </div>
      </div>
      <hr class="divider" />
      ${woLine}
      ${certIdLine || ""}
      <p class="print-stamp">Generated ${escapeHtml(printed)}</p>
    </header>

    <section class="job-section">
      <h2 class="section-title">Job &amp; Equipment</h2>
      <div class="info-grid">
        <div class="info-col">
          <div class="kv">
            <span class="kv-label">Customer Name</span>
            <span class="kv-value">${escapeHtml(model.customerName)}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Service Location</span>
            <span class="kv-value">${escapeHtml(dashIfEmpty(model.serviceLocation ?? ""))}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Technician Name</span>
            <span class="kv-value">${escapeHtml(model.technicianName)}</span>
          </div>
        </div>
        <div class="info-col">
          <div class="kv">
            <span class="kv-label">Work Order Number</span>
            <span class="kv-value">${escapeHtml(model.workOrderLabel)}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Service Date</span>
            <span class="kv-value">${escapeHtml(serviceDate)}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Equipment Name</span>
            <span class="kv-value">${escapeHtml(model.equipmentName)}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Model</span>
            <span class="kv-value">${escapeHtml(dashIfEmpty(model.equipmentCode ?? ""))}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Serial Number</span>
            <span class="kv-value">${escapeHtml(dashIfEmpty(model.equipmentSerialNumber ?? ""))}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="fields-section">
      <h2 class="section-title">Calibration Results</h2>
      <table class="fields-table" role="table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Value</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows.join("\n")}
        </tbody>
      </table>
    </section>

    ${notesBlock}

    <section class="signatures-section">
      <h2 class="section-title">Authorization</h2>
      <div class="signatures">
        <div class="sig-col">
          <span class="sig-label-top">Technician Signature</span>
          <div class="sig-line">${techSigImg}</div>
          <div class="sig-name">${escapeHtml(model.technicianName)}</div>
          <div class="sig-date">${escapeHtml(techDate)}</div>
        </div>
        <div class="sig-col">
          <span class="sig-label-top">Customer Signature</span>
          <div class="sig-line">${custSigImg}</div>
          <div class="sig-name">${escapeHtml(custName)}</div>
          <div class="sig-date">${escapeHtml(custDate)}</div>
        </div>
      </div>
    </section>

    <p class="footer-note">
      This document reflects calibration data recorded at the time of service. For archival or regulatory use, retain the signed copy issued by ${escapeHtml(model.companyName)}.
    </p>
  </div>
</body>
</html>`
}

export type CertificatePrintResult = {
  success: boolean
  /** Legacy: previously true when `window.open` was used; always false with iframe printing. */
  openedPrintTab: boolean
  /** Reserved; print never downloads HTML — use {@link downloadCertificateHtmlFile}. */
  downloadedHtmlFallback: boolean
  /** User-facing detail when success is false. */
  message?: string
}

function waitNextFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/**
 * Prints certificate HTML using a **hidden same-document iframe** (no new tab, no blob URL, no app navigation).
 * Expects a full document string from {@link buildCertificatePdfHtml} (`<!doctype html>`, `<html>`, `<head>`, `<body>`).
 */
export async function printCertificatePdfHtml(html: string): Promise<CertificatePrintResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      success: false,
      openedPrintTab: false,
      downloadedHtmlFallback: false,
      message: "Printing is only available in the browser.",
    }
  }

  let iframe: HTMLIFrameElement | null = null

  const removeFrame = () => {
    if (!iframe?.parentNode) return
    try {
      iframe.parentNode.removeChild(iframe)
    } catch {
      /* ignore */
    }
    iframe = null
  }

  try {
    iframe = document.createElement("iframe")
    iframe.setAttribute("aria-hidden", "true")
    iframe.title = "Print certificate"
    Object.assign(iframe.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
      margin: "0",
      padding: "0",
      opacity: "0",
      pointerEvents: "none",
    })
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    const pwin = iframe.contentWindow
    if (!doc || !pwin) {
      removeFrame()
      return {
        success: false,
        openedPrintTab: false,
        downloadedHtmlFallback: false,
        message: "Unable to access print frame.",
      }
    }

    doc.open()
    doc.write(html)
    doc.close()

    await waitNextFrames()
    await new Promise<void>((r) => setTimeout(r, 100))

    let cleaned = false
    /** Browser timer id (`window.setTimeout`) — avoid NodeJS.Timeout typing conflicts. */
    let fallbackTimer: number | undefined

    const safeCleanup = () => {
      if (cleaned) return
      cleaned = true
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)
      try {
        pwin.removeEventListener("afterprint", safeCleanup)
      } catch {
        /* ignore */
      }
      removeFrame()
    }

    fallbackTimer = window.setTimeout(safeCleanup, 120_000) as unknown as number
    pwin.addEventListener("afterprint", safeCleanup, { once: true })

    try {
      pwin.focus()
      pwin.print()
    } catch (e) {
      safeCleanup()
      return {
        success: false,
        openedPrintTab: false,
        downloadedHtmlFallback: false,
        message: e instanceof Error ? e.message : String(e),
      }
    }

    return { success: true, openedPrintTab: false, downloadedHtmlFallback: false }
  } catch (e) {
    removeFrame()
    return {
      success: false,
      openedPrintTab: false,
      downloadedHtmlFallback: false,
      message: e instanceof Error ? e.message : String(e),
    }
  }
}

/** Download as HTML for offline printing / PDF conversion (Save as PDF from browser). */
export function downloadCertificateHtmlFile(html: string, filenameBase: string): void {
  if (typeof window === "undefined") return
  const safe = filenameBase.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "calibration-certificate"
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${safe}.html`
  a.rel = "noopener"
  a.click()
  URL.revokeObjectURL(url)
}
