"use client"

import { useMemo } from "react"
import Link from "next/link"
import { CheckCircle2, FileDown, Save } from "lucide-react"
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
}: CertificateTabContentProps) {
  const { toast } = useToast()
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
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
              className="w-full rounded border border-border bg-white px-2 py-1.5 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
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
                      className="w-full rounded border border-border bg-white px-2 py-1.5 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
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
