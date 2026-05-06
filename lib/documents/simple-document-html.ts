import type { OrganizationDocumentBranding } from "@/lib/organization/document-branding"
import {
  buildDocumentRootCssDeclarations,
  buildOrganizationDocumentHeaderHtml,
} from "@/lib/organization/document-branding"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function sharedStyles(): string {
  return `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px; line-height: 1.45;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .page { max-width: 7.5in; margin: 0 auto; padding: 24px; }
    .doc-org-header-inner { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; max-width: 360px; }
    .logo-slot { display: inline-block; max-width: min(280px, 100%); }
    .logo { max-height: 48px; max-width: min(280px, 100%); width: auto; height: auto; object-fit: contain; object-position: left center; display: block; }
    .logo-text { font-size: 14px; font-weight: 700; color: #111; max-width: 280px; line-height: 1.2; }
    .doc-org-contact { font-size: 10px; line-height: 1.35; color: #444; }
    .doc-org-contact-line { margin: 0 0 2px; }
    .doc-head-row {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
      margin-bottom: 16px; padding-bottom: 12px;
      border-bottom: 2px solid var(--doc-accent, #cbd5e1);
    }
    .doc-title { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.03em; color: var(--doc-accent, #0a0a0a); }
    .doc-sub { margin: 6px 0 0; font-size: 12px; font-weight: 600; color: #444; }
    table.lines { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
    table.lines th, table.lines td { padding: 8px 10px 8px 0; border-bottom: 1px solid #eee; text-align: left; }
    table.lines th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
    table.lines td.num { text-align: right; white-space: nowrap; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 28px; margin: 16px 0; font-size: 11px; }
    .kv-label { font-size: 10px; font-weight: 600; color: #64748b; display: block; margin-bottom: 2px; }
    .footer-note { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #777; }
    @media print { .page { max-width: none; } }
  `
}

function wrapDocument(params: {
  title: string
  branding: OrganizationDocumentBranding
  innerHtml: string
}): string {
  const rootDecl = buildDocumentRootCssDeclarations(params.branding.accentColor)
  const rootStyle = rootDecl ? `:root { ${rootDecl} }` : ""

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.title)}</title>
  <style>${rootStyle}${sharedStyles()}</style>
</head>
<body>
  <div class="page">
    ${params.innerHtml}
  </div>
</body>
</html>`
}

export function buildQuoteDocumentHtml(params: {
  branding: OrganizationDocumentBranding
  quoteNumber: string
  customerName: string
  equipmentLabel: string
  description: string
  status: string
  amount: number
  expiresDate: string
  createdDate: string
  lineItemsHtml: string
  notes?: string | null
}): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n)

  const inner = `
    <div class="doc-head-row">
      <div>${buildOrganizationDocumentHeaderHtml(params.branding)}</div>
      <div style="text-align:right">
        <h1 class="doc-title">QUOTE</h1>
        <p class="doc-sub">${escapeHtml(params.quoteNumber)}</p>
        <p style="margin:8px 0 0;font-size:10px;color:#64748b;">Expires ${escapeHtml(params.expiresDate)}</p>
      </div>
    </div>
    <div class="meta-grid">
      <div><span class="kv-label">Customer</span>${escapeHtml(params.customerName)}</div>
      <div><span class="kv-label">Equipment</span>${escapeHtml(params.equipmentLabel)}</div>
      <div><span class="kv-label">Status</span>${escapeHtml(params.status)}</div>
      <div><span class="kv-label">Issued</span>${escapeHtml(params.createdDate)}</div>
    </div>
    <p style="margin:0 0 8px;font-size:11px;color:#334155;"><strong>Scope:</strong> ${escapeHtml(params.description)}</p>
    <table class="lines">
      <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>${params.lineItemsHtml}</tbody>
    </table>
    <p style="margin-top:16px;font-size:13px;font-weight:700;text-align:right;">Total ${fmt(params.amount)}</p>
    ${params.notes?.trim() ? `<div style="margin-top:18px;padding:12px;background:#f8fafc;border-radius:6px;font-size:11px;color:#334155;"><strong>Notes</strong><br/>${escapeHtml(params.notes.trim()).replace(/\n/g, "<br/>")}</div>` : ""}
    <p class="footer-note">Quote prepared by ${escapeHtml(params.branding.organizationName)}. Values are estimates until approved in writing.</p>
  `
  return wrapDocument({
    title: `${params.branding.organizationName} — Quote ${params.quoteNumber}`,
    branding: params.branding,
    innerHtml: inner,
  })
}

export function buildPurchaseOrderDocumentHtml(params: {
  branding: OrganizationDocumentBranding
  poNumber: string
  vendor: string
  vendorEmail?: string | null
  vendorPhone?: string | null
  shipTo: string
  billTo: string
  status: string
  orderedDate: string
  eta: string
  totalCents: number
  lineRowsHtml: string
  notes?: string | null
  workOrderLabel?: string | null
}): string {
  const fmt = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(cents / 100)

  const inner = `
    <div class="doc-head-row">
      <div>${buildOrganizationDocumentHeaderHtml(params.branding)}</div>
      <div style="text-align:right">
        <h1 class="doc-title">PURCHASE ORDER</h1>
        <p class="doc-sub">${escapeHtml(params.poNumber)}</p>
      </div>
    </div>
    <div class="meta-grid">
      <div><span class="kv-label">Vendor</span>${escapeHtml(params.vendor)}</div>
      <div><span class="kv-label">Status</span>${escapeHtml(params.status)}</div>
      ${params.vendorEmail?.trim() ? `<div><span class="kv-label">Vendor email</span>${escapeHtml(params.vendorEmail.trim())}</div>` : "<div></div>"}
      ${params.vendorPhone?.trim() ? `<div><span class="kv-label">Vendor phone</span>${escapeHtml(params.vendorPhone.trim())}</div>` : "<div></div>"}
      <div><span class="kv-label">Order date</span>${escapeHtml(params.orderedDate)}</div>
      <div><span class="kv-label">Expected</span>${escapeHtml(params.eta)}</div>
      ${params.workOrderLabel?.trim() ? `<div style="grid-column:1/-1"><span class="kv-label">Work order</span>${escapeHtml(params.workOrderLabel.trim())}</div>` : ""}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;font-size:11px;">
      <div><span class="kv-label">Ship to</span>${escapeHtml(params.shipTo).replace(/\n/g, "<br/>")}</div>
      <div><span class="kv-label">Bill to</span>${escapeHtml(params.billTo).replace(/\n/g, "<br/>")}</div>
    </div>
    <table class="lines">
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Line total</th></tr></thead>
      <tbody>${params.lineRowsHtml}</tbody>
    </table>
    <p style="margin-top:16px;font-size:13px;font-weight:700;text-align:right;">Total ${fmt(params.totalCents)}</p>
    ${params.notes?.trim() ? `<div style="margin-top:18px;font-size:11px;"><strong>Notes</strong><br/>${escapeHtml(params.notes.trim()).replace(/\n/g, "<br/>")}</div>` : ""}
    <p class="footer-note">Purchase order issued by ${escapeHtml(params.branding.organizationName)}.</p>
  `
  return wrapDocument({
    title: `${params.branding.organizationName} — PO ${params.poNumber}`,
    branding: params.branding,
    innerHtml: inner,
  })
}

export function buildWorkOrderSummaryDocumentHtml(params: {
  branding: OrganizationDocumentBranding
  workOrderLabel: string
  title: string
  status: string
  priority: string
  type: string
  customerName: string
  equipmentSummary: string
  scheduledOn?: string | null
  completedAt?: string | null
  problemReported?: string | null
  diagnosis?: string | null
  technicianNotes?: string | null
}): string {
  const inner = `
    <div class="doc-head-row">
      <div>${buildOrganizationDocumentHeaderHtml(params.branding)}</div>
      <div style="text-align:right">
        <h1 class="doc-title">WORK ORDER</h1>
        <p class="doc-sub">${escapeHtml(params.workOrderLabel)}</p>
      </div>
    </div>
    <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(params.title)}</p>
    <div class="meta-grid">
      <div><span class="kv-label">Customer</span>${escapeHtml(params.customerName)}</div>
      <div><span class="kv-label">Equipment</span>${escapeHtml(params.equipmentSummary)}</div>
      <div><span class="kv-label">Status</span>${escapeHtml(params.status)}</div>
      <div><span class="kv-label">Priority</span>${escapeHtml(params.priority)}</div>
      <div><span class="kv-label">Type</span>${escapeHtml(params.type)}</div>
      ${params.scheduledOn?.trim() ? `<div><span class="kv-label">Scheduled</span>${escapeHtml(params.scheduledOn)}</div>` : "<div></div>"}
      ${params.completedAt?.trim() ? `<div><span class="kv-label">Completed</span>${escapeHtml(params.completedAt)}</div>` : "<div></div>"}
    </div>
    ${params.problemReported?.trim() ? `<div style="margin-bottom:12px;"><span class="kv-label">Problem reported</span><div style="font-size:11px;color:#334155;">${escapeHtml(params.problemReported.trim()).replace(/\n/g, "<br/>")}</div></div>` : ""}
    ${params.diagnosis?.trim() ? `<div style="margin-bottom:12px;"><span class="kv-label">Diagnosis</span><div style="font-size:11px;color:#334155;">${escapeHtml(params.diagnosis.trim()).replace(/\n/g, "<br/>")}</div></div>` : ""}
    ${params.technicianNotes?.trim() ? `<div style="margin-bottom:12px;"><span class="kv-label">Technician notes</span><div style="font-size:11px;color:#334155;">${escapeHtml(params.technicianNotes.trim()).replace(/\n/g, "<br/>")}</div></div>` : ""}
    <p class="footer-note">Service summary from ${escapeHtml(params.branding.organizationName)}. Retain for your records.</p>
  `
  return wrapDocument({
    title: `${params.branding.organizationName} — ${params.workOrderLabel}`,
    branding: params.branding,
    innerHtml: inner,
  })
}
