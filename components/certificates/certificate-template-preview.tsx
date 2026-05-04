"use client"

import { Eye } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CalibrationTemplateField } from "@/lib/calibration-certificates"

type CertificateTemplatePreviewProps = {
  templateName: string
  fields: CalibrationTemplateField[]
}

/**
 * Read-only mock of the Work Order certificate form — for template authoring only.
 */
export function CertificateTemplatePreview({ templateName, fields }: CertificateTemplatePreviewProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Eye className="w-3.5 h-3.5" />
        Work order preview
      </div>
      <p className="text-xs text-muted-foreground -mt-0.5">Read-only — how technicians will see this certificate on a work order.</p>
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Certificate</p>
        <p className="text-sm font-medium text-foreground border-b border-border pb-2">{templateName.trim() || "Untitled template"}</p>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No fields — add fields above to preview them here.</p>
        ) : (
          fields.map((field) => {
            if (field.type === "section_heading") {
              return (
                <div key={field.id} className="pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {field.label.trim() || "Section"}
                  </p>
                  <div className="mt-1 border-t border-border" />
                </div>
              )
            }
            const unit = field.type === "number" && field.unit?.trim() ? field.unit.trim() : null
            return (
              <div key={field.id} className="space-y-1">
                <p className="text-[11px] font-medium text-foreground">
                  {field.label.trim() || "Field"}
                  {field.required ? " *" : ""}
                  {unit ? <span className="text-muted-foreground font-normal"> ({unit})</span> : null}
                </p>
                {field.type === "text" && (
                  <Input disabled value="" placeholder="Technician enters text" className="h-9 bg-muted/30" readOnly />
                )}
                {field.type === "number" && (
                  <div className="flex gap-2 items-center">
                    <Input type="number" disabled value="" placeholder="0" className="h-9 flex-1 bg-muted/30" readOnly />
                  </div>
                )}
                {field.type === "checkbox" && (
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" disabled className="rounded border-input opacity-70" />
                    Checked
                  </label>
                )}
                {field.type === "pass_fail" && (
                  <select
                    disabled
                    className="w-full rounded border border-border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground cursor-not-allowed"
                    value="pass"
                  >
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                  </select>
                )}
                {field.type === "notes" && (
                  <Textarea
                    disabled
                    rows={3}
                    value=""
                    placeholder="Technician observations"
                    className="bg-muted/30 text-muted-foreground resize-none"
                    readOnly
                  />
                )}
                {field.helpText?.trim() ? (
                  <p className="text-[10px] text-muted-foreground">{field.helpText}</p>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
