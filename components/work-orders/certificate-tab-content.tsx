"use client"

import { useMemo } from "react"
import Link from "next/link"
import { CheckCircle2, FileDown, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CalibrationTemplate } from "@/lib/calibration-certificates"

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
  manageTemplatesHref?: string
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

export function printCertificateDocument(args: {
  companyName: string
  workOrderLabel: string
  equipmentName: string
  customerName: string
  templateName: string
  renderedRows: Array<{ label: string; value: string }>
}) {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Certificate</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 28px; color: #0f172a; }
      h1 { margin: 0 0 6px; font-size: 20px; }
      .meta { margin: 0 0 16px; font-size: 12px; color: #475569; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom: 18px; }
      .grid p { margin: 0; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; vertical-align: top; }
      th { background: #f8fafc; text-align: left; }
    </style>
  </head>
  <body>
    <h1>${args.companyName} - Calibration Certificate</h1>
    <p class="meta">${args.templateName}</p>
    <div class="grid">
      <p><strong>Work Order:</strong> ${args.workOrderLabel}</p>
      <p><strong>Printed:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Customer:</strong> ${args.customerName}</p>
      <p><strong>Equipment:</strong> ${args.equipmentName}</p>
    </div>
    <table>
      <thead>
        <tr><th>Field</th><th>Value</th></tr>
      </thead>
      <tbody>
        ${args.renderedRows.map((r) => `<tr><td>${r.label}</td><td>${r.value}</td></tr>`).join("")}
      </tbody>
    </table>
  </body>
</html>`

  const win = window.open("", "_blank", "noopener,noreferrer,width=980,height=720")
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
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
  manageTemplatesHref,
}: CertificateTabContentProps) {
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  )

  const printableRows = useMemo(() => {
    if (!selectedTemplate) return []
    return selectedTemplate.fields
      .filter((f) => f.type !== "section_heading")
      .map((f) => {
        const raw = values[f.id]
        let out = "—"
        if (f.type === "checkbox") out = raw ? "Yes" : "No"
        else if (f.type === "pass_fail") out = raw === "fail" ? "Fail" : "Pass"
        else if (typeof raw === "number") out = String(raw)
        else if (typeof raw === "string" && raw.trim()) out = raw.trim()
        return { label: f.label, value: out }
      })
  }, [selectedTemplate, values])

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
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-end">
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
              printCertificateDocument({
                companyName,
                workOrderLabel,
                customerName,
                equipmentName,
                templateName: selectedTemplate.name,
                renderedRows: printableRows,
              })
            }}
          >
            <FileDown className="w-3.5 h-3.5" />
            Generate Certificate PDF
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
