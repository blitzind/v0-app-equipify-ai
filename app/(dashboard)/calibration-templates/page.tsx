"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FileBadge2, Plus, Rows3, Trash2 } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  archiveCalibrationTemplate,
  listCalibrationTemplates,
  upsertCalibrationTemplate,
  type CalibrationFieldType,
  type CalibrationTemplate,
  type CalibrationTemplateField,
} from "@/lib/calibration-certificates"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

const FIELD_TYPE_OPTIONS: Array<{ value: CalibrationFieldType; label: string }> = [
  { value: "section_heading", label: "Section Heading" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "checkbox", label: "Checkbox" },
  { value: "pass_fail", label: "Pass / Fail" },
  { value: "notes", label: "Notes" },
]

type DraftState = {
  id?: string
  name: string
  equipmentCategoryId: string
  fields: CalibrationTemplateField[]
}

function emptyDraft(): DraftState {
  return {
    name: "",
    equipmentCategoryId: "",
    fields: [],
  }
}

function copyTemplateToDraft(t: CalibrationTemplate): DraftState {
  return {
    id: t.id,
    name: t.name,
    equipmentCategoryId: t.equipmentCategoryId ?? "",
    fields: t.fields.map((f) => ({ ...f })),
  }
}

const TEMPLATE_NAME_INPUT_ID = "certificate-template-name"

export default function CertificatesPage() {
  const { toast } = useToast()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const [templates, setTemplates] = useState<CalibrationTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftState>(emptyDraft())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("templates")

  const fetchTemplates = useCallback(async () => {
    if (!organizationId) return []
    const supabase = createBrowserSupabaseClient()
    return listCalibrationTemplates(supabase, organizationId)
  }, [organizationId])

  useEffect(() => {
    if (orgStatus !== "ready" || !organizationId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const rows = await fetchTemplates()
        if (cancelled) return
        setTemplates(rows)
        if (rows.length > 0) {
          const first = rows[0]
          setSelectedId(first.id)
          setDraft(copyTemplateToDraft(first))
        } else {
          setSelectedId(null)
          setDraft(emptyDraft())
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgStatus, organizationId, fetchTemplates])

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  )

  function beginNewTemplate() {
    setError(null)
    setSelectedId(null)
    setDraft(emptyDraft())
    setActiveTab("templates")
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(TEMPLATE_NAME_INPUT_ID)?.focus()
      })
    })
  }

  function selectTemplate(id: string) {
    const next = templates.find((t) => t.id === id)
    if (!next) return
    setSelectedId(id)
    setDraft(copyTemplateToDraft(next))
  }

  function addField() {
    setDraft((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          id: crypto.randomUUID(),
          type: "text",
          label: "New field",
          required: false,
          helpText: "",
        },
      ],
    }))
  }

  function updateField(id: string, patch: Partial<CalibrationTemplateField>) {
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }))
  }

  function removeField(id: string) {
    setDraft((prev) => ({ ...prev, fields: prev.fields.filter((f) => f.id !== id) }))
  }

  async function handleSave() {
    if (orgStatus !== "ready" || !organizationId) return
    if (!draft.name.trim()) {
      const msg = "Template name is required."
      setError(msg)
      toast({ variant: "destructive", title: "Cannot save", description: msg })
      return
    }
    const wasNew = !draft.id
    setSaving(true)
    setError(null)
    const supabase = createBrowserSupabaseClient()
    try {
      const saved = await upsertCalibrationTemplate(supabase, organizationId, {
        id: draft.id,
        name: draft.name,
        equipmentCategoryId: draft.equipmentCategoryId || null,
        fields: draft.fields,
      })
      const rows = await listCalibrationTemplates(supabase, organizationId)
      setTemplates(rows)
      setSelectedId(saved.id)
      setDraft(copyTemplateToDraft(saved))
      toast({
        title: wasNew ? "Template created" : "Template saved",
        description: saved.name,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast({
        variant: "destructive",
        title: wasNew ? "Could not create template" : "Could not save template",
        description: msg,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveCurrent() {
    if (!selectedTemplate || !organizationId) return
    if (!window.confirm(`Archive template "${selectedTemplate.name}"?`)) return
    const supabase = createBrowserSupabaseClient()
    try {
      await archiveCalibrationTemplate(supabase, organizationId, selectedTemplate.id)
      const next = templates.filter((t) => t.id !== selectedTemplate.id)
      setTemplates(next)
      if (next.length > 0) {
        setSelectedId(next[0].id)
        setDraft(copyTemplateToDraft(next[0]))
      } else {
        beginNewTemplate()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 sm:p-5">
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-muted-foreground">
            Create reusable calibration templates and manage completed certificates.
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <FileBadge2 className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Certificates</h1>
          </div>
        </div>
      </Card>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-nowrap items-end justify-between gap-3 border-b border-border bg-background px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="h-auto min-h-0 min-w-0 flex flex-1 flex-nowrap overflow-x-auto justify-start gap-0 rounded-none bg-background p-0 border-0 shadow-none">
            <TabsTrigger
              value="templates"
              className="grow-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              Templates
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="grow-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              Completed Certificates
            </TabsTrigger>
          </TabsList>
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-9 shrink-0 gap-1.5 mb-px"
            onClick={beginNewTemplate}
          >
            <Plus className="w-4 h-4" />
            New Template
          </Button>
        </div>

        <TabsContent value="templates" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            <Card className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Templates</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={beginNewTemplate}
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </Button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {loading ? (
                  <p className="text-sm text-muted-foreground px-3 py-4">Loading templates…</p>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-3 py-4">No templates yet.</p>
                ) : (
                  templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTemplate(t.id)}
                      className={`w-full text-left px-3 py-2.5 text-sm border-b border-border/70 ${
                        selectedId === t.id ? "bg-primary/10 text-primary" : "hover:bg-muted/20 text-foreground"
                      }`}
                    >
                      <p className="font-medium">{t.name}</p>
                      {t.equipmentCategoryId ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{t.equipmentCategoryId}</p>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Template name</p>
                  <Input
                    id={TEMPLATE_NAME_INPUT_ID}
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Calibration checklist"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">Equipment category (optional)</p>
                  <Input
                    value={draft.equipmentCategoryId}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, equipmentCategoryId: e.target.value }))
                    }
                    placeholder="Forklift"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template fields</p>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={addField}>
                    <Plus className="w-3.5 h-3.5" />
                    Add field
                  </Button>
                </div>
                {draft.fields.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-3 py-6 text-sm text-muted-foreground text-center">
                    Add fields to define this certificate template.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {draft.fields.map((field) => (
                      <div key={field.id} className="rounded-lg border border-border p-3 space-y-2 bg-card">
                        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2">
                          <select
                            value={field.type}
                            onChange={(e) =>
                              updateField(field.id, { type: e.target.value as CalibrationFieldType })
                            }
                            className="rounded border border-border bg-white px-2 py-1.5 text-xs text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                          >
                            {FIELD_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <Input
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            placeholder={field.type === "section_heading" ? "Section title" : "Field label"}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            onClick={() => removeField(field.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {field.type !== "section_heading" ? (
                          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-2 items-center">
                            <label className="inline-flex items-center gap-2 text-xs text-foreground">
                              <input
                                type="checkbox"
                                checked={Boolean(field.required)}
                                onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                className="rounded border-input"
                              />
                              Required
                            </label>
                            <Textarea
                              rows={2}
                              value={field.helpText ?? ""}
                              onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                              placeholder="Help text (optional)"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? "Saving…" : draft.id ? "Save Template" : "Create Template"}
                </Button>
                {selectedTemplate ? (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void handleArchiveCurrent()}>
                    Archive Template
                  </Button>
                ) : null}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-0">
          <Card className="p-8 text-center">
            <div className="mx-auto w-10 h-10 rounded-xl bg-muted/30 border border-border flex items-center justify-center mb-3">
              <Rows3 className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Completed certificate records will appear here after work orders are completed.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
