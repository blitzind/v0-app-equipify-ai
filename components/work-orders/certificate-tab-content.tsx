"use client"

import { useMemo, useState } from "react"
import {
  documentBrandingFromFields,
  type OrganizationDocumentBranding,
} from "@/lib/organization/document-branding"
import Link from "next/link"
import { CheckCircle2, FileDown, Loader2, Mail, Save, Shield } from "lucide-react"
import { DRAWER_FIELD_CLASS } from "@/components/detail-drawer"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CalibrationTemplate } from "@/lib/calibration-certificates"
import {
  buildCertificatePdfHtml,
  downloadCertificateHtmlFile,
  printCertificatePdfHtml,
} from "@/lib/certificates/certificate-pdf-html"

type CertificateTabContentProps = {
  templates: CalibrationTemplate[]
  selectedTemplateId: string
  onTemplateChange: (templateId: string) => void
  values: Record<string, unknown>
  onValueChange: (fieldId: string, value: unknown) => void
  onSave: () => void | Promise<void>
  saveBusy?: boolean
  lastSavedAt?: string | null
  workOrderLabel: string
  companyName: string
  /** Workspace logo URL from Organization settings; when absent, PDF shows company name as text. */
  logoUrl?: string | null
  /** Full org branding for print/PDF (accent, address, contact). Falls back to name + logo only. */
  documentBranding?: OrganizationDocumentBranding | null
  equipmentName: string
  customerName: string
  workOrderDescription?: string
  equipmentDetails?: string
  serviceLocation?: string
  equipmentCode?: string | null
  equipmentSerialNumber?: string | null
  calibrationRecordId?: string | null
  serviceDateLabel?: string | null
  technicianNotes?: string
  technicianSignedDateLabel?: string | null
  customerSignedDateLabel?: string | null
  technicianName?: string
  customerSignatureUrl?: string | null
  customerSignedBy?: string | null
  /** Legacy repair_log technician signature image. */
  technicianSignatureDataUrl?: string | null
  completedAtLabel?: string | null
  manageTemplatesHref?: string
  /** When true, shows a subtle note that some fields were prefilled from the work order. */
  showPrefillHelper?: boolean
  /** When set with workOrderId, shows "Email certificate" after a record is saved. */
  organizationId?: string | null
  workOrderId?: string | null
  /** When set, email API loads the certificate for this equipment row (multi-asset work orders). */
  equipmentScopeId?: string | null
  /** When true, used inside a parent card (Work Order Certificates tab) to avoid double chrome. */
  embedded?: boolean
  /** Staff-facing portal visibility summary for this certificate record. */
  staffPortalLines?: Array<{ tone: "neutral" | "info" | "warning" | "success"; text: string }>
  portalReleasedAt?: string | null
  onReleaseToPortal?: () => void | Promise<void>
  releaseToPortalBusy?: boolean
  /** Optional slot rendered above the template fields — used for the cert attachments card. */
  attachmentsSlot?: React.ReactNode
}

function fmtDateTime(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function CertificateTabContent({
  templates,
  selectedTemplateId,
  onTemplateChange,
  values,
  onValueChange,
  onSave,
  saveBusy = false,
  lastSavedAt,
  workOrderLabel,
  companyName,
  logoUrl,
  documentBranding,
  equipmentName,
  customerName,
  workOrderDescription,
  equipmentDetails,
  serviceLocation,
  equipmentCode,
  equipmentSerialNumber,
  calibrationRecordId,
  serviceDateLabel,
  technicianNotes,
  technicianSignedDateLabel,
  customerSignedDateLabel,
  technicianName,
  customerSignatureUrl,
  customerSignedBy,
  technicianSignatureDataUrl,
  completedAtLabel,
  manageTemplatesHref,
  showPrefillHelper = false,
  organizationId,
  workOrderId,
  equipmentScopeId = undefined,
  embedded = false,
  staffPortalLines,
  attachmentsSlot,
  portalReleasedAt,
  onReleaseToPortal,
  releaseToPortalBusy = false,
}: CertificateTabContentProps) {
  const { toast } = useToast()
  const resolvedLogoUrl = logoUrl?.trim() ? logoUrl.trim() : undefined
  const certificateBranding = useMemo(
    () =>
      documentBranding ??
      documentBrandingFromFields({
        name: companyName,
        documentLogoUrl: resolvedLogoUrl ?? null,
        logoUrl: resolvedLogoUrl ?? null,
      }),
    [documentBranding, companyName, resolvedLogoUrl],
  )
  const [certEmailTo, setCertEmailTo] = useState("")
  const [certEmailSending, setCertEmailSending] = useState(false)
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  )

  const canEmailCertificate =
    Boolean(organizationId?.trim() && workOrderId?.trim() && calibrationRecordId)

  async function sendCertificateToCustomer() {
    if (!organizationId?.trim() || !workOrderId?.trim()) return
    const to = certEmailTo.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast({ variant: "destructive", title: "Invalid email", description: "Enter a valid customer email address." })
      return
    }
    setCertEmailSending(true)
    try {
      const res = await fetch("/api/email/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organizationId.trim(),
          workOrderId: workOrderId.trim(),
          to,
          equipmentId: equipmentScopeId?.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not send email",
          description: typeof data.message === "string" ? data.message : "Request failed.",
        })
        return
      }
      toast({ title: "Certificate email sent", description: `Message sent to ${to}.` })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not send email",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setCertEmailSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={
          embedded
            ? "space-y-3"
            : "rounded-xl border border-border bg-card p-3 space-y-3"
        }
      >
        {manageTemplatesHref ? (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <Link href={manageTemplatesHref}>Manage templates</Link>
            </Button>
          </div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Certificate template</p>
            <select
              value={selectedTemplateId}
              onChange={(e) => onTemplateChange(e.target.value)}
              className={cn(
                DRAWER_FIELD_CLASS,
                "w-full px-2 py-1.5 cursor-pointer shadow-xs transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20",
              )}
            >
              <option value="">Select template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => void onSave()} disabled={!selectedTemplate || saveBusy}>
            <Save className="w-3.5 h-3.5" />
            {saveBusy ? "Saving…" : "Save Certificate"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            disabled={!selectedTemplate}
            onClick={() => {
              if (!selectedTemplate) return
              void (async () => {
                try {
                  const html = buildCertificatePdfHtml({
                    companyName,
                    logoUrl: certificateBranding.preferredLogoUrl,
                    branding: certificateBranding,
                    templateName: selectedTemplate.name,
                    template: selectedTemplate,
                    values,
                    workOrderLabel,
                    customerName,
                    serviceLocation,
                    equipmentName,
                    equipmentCode: equipmentCode ?? null,
                    equipmentSerialNumber: equipmentSerialNumber ?? null,
                    calibrationRecordId: calibrationRecordId ?? null,
                    completedAtLabel: completedAtLabel ?? undefined,
                    serviceDateLabel: serviceDateLabel ?? completedAtLabel ?? undefined,
                    technicianName: technicianName?.trim() || "Technician",
                    technicianSignatureDataUrl: technicianSignatureDataUrl ?? null,
                    customerSignatureUrl: customerSignatureUrl ?? null,
                    customerSignedBy: customerSignedBy ?? null,
                    technicianSignedDateLabel: technicianSignedDateLabel ?? undefined,
                    customerSignedDateLabel: customerSignedDateLabel ?? undefined,
                    technicianNotes: technicianNotes?.trim() || undefined,
                  })
                  const result = await printCertificatePdfHtml(html)
                  if (!result.success && result.message) {
                    toast({
                      variant: "destructive",
                      title: "Print preview unavailable",
                      description: result.message,
                    })
                  }
                } catch (e) {
                  toast({
                    variant: "destructive",
                    title: "Could not generate certificate",
                    description: e instanceof Error ? e.message : String(e),
                  })
                }
              })()
            }}
          >
            <FileDown className="w-3.5 h-3.5" />
            Print / PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            disabled={!selectedTemplate}
            onClick={() => {
              if (!selectedTemplate) return
              try {
                const html = buildCertificatePdfHtml({
                  companyName,
                  logoUrl: certificateBranding.preferredLogoUrl,
                  branding: certificateBranding,
                  templateName: selectedTemplate.name,
                  template: selectedTemplate,
                  values,
                  workOrderLabel,
                  customerName,
                  serviceLocation,
                  equipmentName,
                  equipmentCode: equipmentCode ?? null,
                  equipmentSerialNumber: equipmentSerialNumber ?? null,
                  calibrationRecordId: calibrationRecordId ?? null,
                  completedAtLabel: completedAtLabel ?? undefined,
                  serviceDateLabel: serviceDateLabel ?? completedAtLabel ?? undefined,
                  technicianName: technicianName?.trim() || "Technician",
                  technicianSignatureDataUrl: technicianSignatureDataUrl ?? null,
                  customerSignatureUrl: customerSignatureUrl ?? null,
                  customerSignedBy: customerSignedBy ?? null,
                  technicianSignedDateLabel: technicianSignedDateLabel ?? undefined,
                  customerSignedDateLabel: customerSignedDateLabel ?? undefined,
                  technicianNotes: technicianNotes?.trim() || undefined,
                })
                downloadCertificateHtmlFile(html, `Calibration-${workOrderLabel}`)
              } catch (e) {
                toast({
                  variant: "destructive",
                  title: "Could not download certificate",
                  description: e instanceof Error ? e.message : String(e),
                })
              }
            }}
          >
            HTML
          </Button>
        </div>
        {lastSavedAt ? (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--status-success)]/35 bg-[color:var(--status-success)]/10 px-2.5 py-1 text-[11px] text-[color:var(--status-success)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Last saved {fmtDateTime(lastSavedAt)}
          </div>
        ) : null}
      </div>

      {canEmailCertificate ? (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Send to customer</p>
          <p className="text-xs text-muted-foreground">
            Email a certificate summary to your customer. PDF attachments will be added when automated packaging is enabled.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px] space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Customer email</label>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={certEmailTo}
                onChange={(e) => setCertEmailTo(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5"
              disabled={certEmailSending}
              onClick={() => void sendCertificateToCustomer()}
            >
              {certEmailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              Email certificate
            </Button>
          </div>
        </div>
      ) : null}

      {(staffPortalLines?.length ||
        onReleaseToPortal ||
        (portalReleasedAt && portalReleasedAt.trim())) ? (
        <div className="rounded-xl border border-border bg-muted/15 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Customer portal (internal)
              </p>
              <p className="text-xs text-muted-foreground">
                How this certificate appears in the customer portal. Shown to staff only.
              </p>
            </div>
          </div>
          {staffPortalLines?.length ? (
            <ul className="space-y-1.5 border-t border-border pt-3">
              {staffPortalLines.map((b, i) => (
                <li
                  key={i}
                  className={cn(
                    "text-xs leading-snug",
                    b.tone === "warning" && "text-[color:var(--status-warning)]",
                    b.tone === "success" && "text-[color:var(--status-success)]",
                    b.tone === "info" && "text-[color:var(--status-info)]",
                    b.tone === "neutral" && "text-muted-foreground",
                  )}
                >
                  {b.text}
                </li>
              ))}
            </ul>
          ) : null}
          {calibrationRecordId && onReleaseToPortal ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="text-xs"
                disabled={
                  Boolean(portalReleasedAt?.trim()) ||
                  releaseToPortalBusy ||
                  !calibrationRecordId
                }
                onClick={() => void onReleaseToPortal()}
              >
                {releaseToPortalBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                ) : null}
                Release to portal
              </Button>
              {portalReleasedAt?.trim() ? (
                <span className="text-[11px] text-[color:var(--status-success)]">
                  Released to portal for customer access (manual rule satisfied).
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {attachmentsSlot ? <div>{attachmentsSlot}</div> : null}

      {!selectedTemplate ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 py-10 text-center">
          <p className="text-sm text-muted-foreground">Select a certificate template to begin.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          {showPrefillHelper ? (
            <p className="text-[11px] text-muted-foreground border-l-2 border-primary/20 pl-2.5 py-0.5 leading-relaxed">
              Some fields were prefilled from the work order. You can edit them.
            </p>
          ) : null}
          {selectedTemplate.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">This template has no fields yet.</p>
          ) : (
            selectedTemplate.fields.map((field) => {
              if (field.type === "section_heading") {
                return (
                  <div key={field.id} className="pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{field.label}</p>
                    <div className="mt-1 border-t border-border" />
                  </div>
                )
              }

              const raw = values[field.id]
              return (
                <div key={field.id} className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">
                    {field.label}
                    {field.required ? " *" : ""}
                    {field.type === "number" && field.unit?.trim() ? (
                      <span className="text-muted-foreground font-normal"> ({field.unit.trim()})</span>
                    ) : null}
                  </p>
                  {field.type === "text" && (
                    <Input
                      value={typeof raw === "string" ? raw : ""}
                      onChange={(e) => onValueChange(field.id, e.target.value)}
                      className="h-9"
                    />
                  )}
                  {field.type === "number" && (
                    <Input
                      type="number"
                      value={typeof raw === "number" ? raw : typeof raw === "string" ? raw : ""}
                      onChange={(e) => onValueChange(field.id, e.target.value)}
                      className="h-9"
                    />
                  )}
                  {field.type === "checkbox" && (
                    <label className="inline-flex items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={Boolean(raw)}
                        onChange={(e) => onValueChange(field.id, e.target.checked)}
                      />
                      Checked
                    </label>
                  )}
                  {field.type === "pass_fail" && (
                    <select
                      value={raw === "fail" ? "fail" : "pass"}
                      onChange={(e) => onValueChange(field.id, e.target.value)}
                      className={cn(
                DRAWER_FIELD_CLASS,
                "w-full px-2 py-1.5 cursor-pointer shadow-xs transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20",
              )}
                    >
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                    </select>
                  )}
                  {field.type === "notes" && (
                    <Textarea
                      value={typeof raw === "string" ? raw : ""}
                      onChange={(e) => onValueChange(field.id, e.target.value)}
                      rows={4}
                    />
                  )}
                  {field.helpText ? <p className="text-[10px] text-muted-foreground">{field.helpText}</p> : null}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
