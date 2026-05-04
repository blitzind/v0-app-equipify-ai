"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  Heading,
  Hash,
  CheckSquare,
  ListChecks,
  StickyNote,
  Type,
  Upload,
  Loader2,
  Trash2,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CalibrationFieldType, CalibrationTemplateField } from "@/lib/calibration-certificates"
import { runCertificateTemplateImport } from "@/lib/calibration-templates/import-template-from-file"
import { cn } from "@/lib/utils"

const FIELD_TYPE_OPTIONS: Array<{ value: CalibrationFieldType; label: string }> = [
  { value: "section_heading", label: "Section Heading" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "checkbox", label: "Checkbox" },
  { value: "pass_fail", label: "Pass / Fail" },
  { value: "notes", label: "Notes" },
]

const QUICK_FIELD_TYPES: Array<{
  type: CalibrationFieldType
  label: string
  icon: typeof Heading
}> = [
  { type: "section_heading", label: "Section Heading", icon: Heading },
  { type: "text", label: "Text Field", icon: Type },
  { type: "number", label: "Number / Measurement", icon: Hash },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "pass_fail", label: "Pass / Fail", icon: ListChecks },
  { type: "notes", label: "Notes", icon: StickyNote },
]

function mergeFieldPatch(
  f: CalibrationTemplateField,
  patch: Partial<CalibrationTemplateField>,
): CalibrationTemplateField {
  const merged: CalibrationTemplateField = { ...f, ...patch }
  if (merged.type === "section_heading") merged.required = false
  if (merged.type !== "number") {
    const { unit: _omit, ...rest } = merged as CalibrationTemplateField & { unit?: string }
    return rest
  }
  if (merged.unit === undefined) merged.unit = ""
  return merged
}

function labelPlaceholder(type: CalibrationFieldType): string {
  switch (type) {
    case "section_heading":
      return "e.g. Electrical Safety Tests"
    case "text":
      return "e.g. Asset ID or description"
    case "number":
      return "e.g. Output voltage"
    case "checkbox":
      return "e.g. Ground bond verified"
    case "pass_fail":
      return "e.g. Insulation resistance"
    case "notes":
      return "e.g. Technician observations"
    default:
      return "Field label"
  }
}

export type ImportReviewDraft = {
  name: string
  equipmentCategoryId: string
  fields: CalibrationTemplateField[]
  confidenceMessage: string
  extractionWarnings: string[]
}

type Step = "upload" | "processing" | "review"

const MAX_BYTES = 20 * 1024 * 1024

export function ImportTemplateDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCommit: (draft: ImportReviewDraft) => Promise<void>
  saving?: boolean
}) {
  const { open, onOpenChange, onCommit, saving } = props
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>("upload")
  const [review, setReview] = useState<ImportReviewDraft | null>(null)
  const [pendingFieldFocusId, setPendingFieldFocusId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useLayoutEffect(() => {
    if (!pendingFieldFocusId) return
    const el = document.querySelector<HTMLInputElement>(`[data-field-label-input="${pendingFieldFocusId}"]`)
    el?.focus()
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    setPendingFieldFocusId(null)
  }, [pendingFieldFocusId, review?.fields])

  const reset = useCallback(() => {
    setStep("upload")
    setReview(null)
    setLocalError(null)
    setPendingFieldFocusId(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset()
      onOpenChange(next)
    },
    [onOpenChange, reset],
  )

  function updateField(id: string, patch: Partial<CalibrationTemplateField>) {
    setReview((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        fields: prev.fields.map((f) => (f.id === id ? mergeFieldPatch(f, patch) : f)),
      }
    })
  }

  function moveField(index: number, dir: -1 | 1) {
    setReview((prev) => {
      if (!prev) return prev
      const j = index + dir
      if (j < 0 || j >= prev.fields.length) return prev
      const fields = [...prev.fields]
      const tmp = fields[index]!
      fields[index] = fields[j]!
      fields[j] = tmp
      return { ...prev, fields }
    })
  }

  function removeField(id: string) {
    setReview((prev) => (prev ? { ...prev, fields: prev.fields.filter((f) => f.id !== id) } : prev))
  }

  function addFieldOfType(type: CalibrationFieldType) {
    const id = crypto.randomUUID()
    const field: CalibrationTemplateField =
      type === "number"
        ? { id, type, label: "", required: false, helpText: "", unit: "" }
        : { id, type, label: "", required: false, helpText: "" }
    setReview((prev) => (prev ? { ...prev, fields: [...prev.fields, field] } : prev))
    setPendingFieldFocusId(id)
  }

  async function processFile(file: File) {
    setLocalError(null)
    if (file.size > MAX_BYTES) {
      setLocalError(`File is too large (max ${Math.round(MAX_BYTES / (1024 * 1024))} MB).`)
      return
    }
    setStep("processing")
    try {
      const result = await runCertificateTemplateImport(file)
      setReview({
        name: result.suggestedName,
        equipmentCategoryId: result.equipmentCategoryId,
        fields: result.fields,
        confidenceMessage: result.confidenceMessage,
        extractionWarnings: result.extractionWarnings,
      })
      setStep("review")
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e))
      setStep("upload")
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    void processFile(file)
  }

  async function handleCommit() {
    if (!review?.name.trim()) {
      setLocalError("Template name is required.")
      return
    }
    setLocalError(null)
    await onCommit(review)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 p-0 overflow-hidden max-h-[min(90vh,880px)] flex flex-col sm:max-w-2xl",
          step === "review" && "sm:max-w-3xl",
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0 space-y-1">
          <DialogTitle className="text-lg">
            {step === "review" ? "Review Imported Template" : "Import Template"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {step === "review"
              ? "AI created a draft. Review all fields before using this template."
              : "Upload a PDF or image (PNG, JPEG). Analysis runs securely on the server."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {localError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {localError}
            </div>
          ) : null}

          {step === "upload" ? (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={onPickFile}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-border bg-muted/20 hover:bg-muted/35 transition-colors px-6 py-12 flex flex-col items-center gap-3 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Choose a file</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    PDF, PNG, or JPEG. The file is sent to your server for OpenAI analysis and is not stored.
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" className="gap-2 mt-1">
                  <Upload className="w-4 h-4" />
                  Browse
                </Button>
              </button>
            </div>
          ) : null}

          {step === "processing" ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Analyzing file and building draft…</p>
            </div>
          ) : null}

          {step === "review" && review ? (
            <div className="space-y-4">
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <AlertTitle className="text-sm">Draft quality</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed space-y-2">
                  <p>{review.confidenceMessage}</p>
                  {review.extractionWarnings.length > 0 ? (
                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                      {review.extractionWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Template name</p>
                  <Input
                    value={review.name}
                    onChange={(e) => setReview((r) => (r ? { ...r, name: e.target.value } : r))}
                    placeholder="Calibration checklist"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Equipment category (optional)</p>
                  <Input
                    value={review.equipmentCategoryId}
                    onChange={(e) =>
                      setReview((r) => (r ? { ...r, equipmentCategoryId: e.target.value } : r))
                    }
                    placeholder="Forklift"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fields</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_FIELD_TYPES.map((q) => {
                    const Icon = q.icon
                    return (
                      <Button
                        key={q.type}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => addFieldOfType(q.type)}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {q.label}
                      </Button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3 max-h-[min(48vh,420px)] overflow-y-auto pr-1 -mr-1">
                {review.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-xl border border-border p-3 space-y-2 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_10rem_auto] lg:items-end">
                      <div className="space-y-1 min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground">Field label</p>
                        <Input
                          data-field-label-input={field.id}
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          placeholder={labelPlaceholder(field.type)}
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground">Field type</p>
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateField(field.id, { type: e.target.value as CalibrationFieldType })
                          }
                          className="w-full h-9 rounded-md border border-border bg-white px-2 py-1.5 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        >
                          {FIELD_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 lg:justify-end">
                        {field.type !== "section_heading" ? (
                          <label className="inline-flex items-center gap-2 h-9 px-2 rounded-md border border-border bg-background text-xs cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={Boolean(field.required)}
                              onChange={(e) => updateField(field.id, { required: e.target.checked })}
                              className="rounded border-input"
                            />
                            Required
                          </label>
                        ) : (
                          <span className="text-[10px] text-muted-foreground h-9 inline-flex items-center">Section</span>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() => moveField(index, -1)}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          aria-label="Move down"
                          disabled={index >= review.fields.length - 1}
                          onClick={() => moveField(index, 1)}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label="Remove field"
                          onClick={() => removeField(field.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {field.type === "number" ? (
                      <div className="grid grid-cols-1 sm:max-w-xs gap-1">
                        <p className="text-[10px] font-medium text-muted-foreground">Unit (optional)</p>
                        <Input
                          value={field.unit ?? ""}
                          onChange={(e) => updateField(field.id, { unit: e.target.value })}
                          placeholder="e.g. V, PSI, °F"
                          autoComplete="off"
                        />
                      </div>
                    ) : null}
                    {field.type !== "section_heading" ? (
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium text-muted-foreground">Help text (optional)</p>
                        <Textarea
                          rows={2}
                          value={field.helpText ?? ""}
                          onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                          placeholder="Shown under the field on the work order"
                          className="resize-none text-sm"
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/10 shrink-0 gap-2 sm:gap-2 flex-row sm:justify-end">
          {step === "review" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReview(null)
                setStep("upload")
                setLocalError(null)
              }}
              disabled={saving}
            >
              Back
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {step === "review" && review ? (
            <Button type="button" onClick={() => void handleCommit()} disabled={saving} className="min-w-[9rem]">
              {saving ? "Creating…" : "Create Template"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
