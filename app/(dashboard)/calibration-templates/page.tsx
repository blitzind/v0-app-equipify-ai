"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  FileBadge2,
  FileDown,
  FileText,
  Plus,
  Printer,
  Rows3,
  ExternalLink,
  Trash2,
  PenLine,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Heading,
  Type,
  Hash,
  CheckSquare,
  ListChecks,
  StickyNote,
  Search,
  Upload,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  archiveCalibrationTemplate,
  buildCompletedCertificatePdfHtml,
  listCalibrationTemplates,
  listCompletedCertificatesForOrg,
  upsertCalibrationTemplate,
  type CalibrationFieldType,
  type CalibrationTemplate,
  type CalibrationTemplateField,
  type CompletedCertificateListItem,
} from "@/lib/calibration-certificates"
import {
  downloadCertificateHtmlFile,
  printCertificatePdfHtml,
} from "@/lib/certificates/certificate-pdf-html"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { CertificateTemplatePreview } from "@/components/certificates/certificate-template-preview"
import {
  ImportTemplateDialog,
  type ImportReviewDraft,
} from "@/components/calibration-templates/import-template-dialog"

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

function cloneDraft(d: DraftState): DraftState {
  return {
    id: d.id,
    name: d.name,
    equipmentCategoryId: d.equipmentCategoryId,
    fields: d.fields.map((f) => ({ ...f })),
  }
}

function draftsEqual(a: DraftState, b: DraftState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

const TEMPLATE_NAME_INPUT_ID = "certificate-template-name"

function formatListDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function normalizeCertSearchTokens(raw: string): string[] {
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function haystackIncludesAllTokens(haystackLower: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  return tokens.every((t) => haystackLower.includes(t))
}

function completedCertMatchesSearch(row: CompletedCertificateListItem, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const parts = [
    row.template.name,
    row.workOrderLabel,
    row.workOrderTitle,
    row.customerName,
    row.equipmentLabel,
    row.technicianName ?? "",
    row.workOrderStatusLabel,
  ]
  const haystack = parts.join(" ").toLowerCase()
  return haystackIncludesAllTokens(haystack, tokens)
}

export default function CertificatesPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const [templates, setTemplates] = useState<CalibrationTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** True after "+ New Template" / "+ Create Template" until save or cancel — distinct from "no selection" idle. */
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [draft, setDraft] = useState<DraftState>(emptyDraft())
  /** Last saved / loaded snapshot for unsaved-change detection. */
  const [baselineDraft, setBaselineDraft] = useState<DraftState>(emptyDraft())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("templates")
  /** Incremented when user starts a new template so we focus the name field after the Templates tab panel mounts. */
  const [newTemplateFocusTick, setNewTemplateFocusTick] = useState(0)
  /** After adding a field, focus and scroll to its label input. */
  const [pendingFieldFocusId, setPendingFieldFocusId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [completedRows, setCompletedRows] = useState<CompletedCertificateListItem[]>([])
  const [completedLoading, setCompletedLoading] = useState(false)
  const [completedError, setCompletedError] = useState<string | null>(null)
  const [completedCertificatesSearchQuery, setCompletedCertificatesSearchQuery] = useState("")

  const completedSearchTokens = useMemo(
    () => normalizeCertSearchTokens(completedCertificatesSearchQuery),
    [completedCertificatesSearchQuery],
  )

  const filteredCompletedRows = useMemo(() => {
    return completedRows.filter((r) => completedCertMatchesSearch(r, completedSearchTokens))
  }, [completedRows, completedSearchTokens])

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
        setSelectedId(null)
        setIsCreatingNew(false)
        setDraft(emptyDraft())
        setBaselineDraft(emptyDraft())
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

  const fetchCompletedCertificates = useCallback(async () => {
    if (!organizationId) return []
    const supabase = createBrowserSupabaseClient()
    return listCompletedCertificatesForOrg(supabase, organizationId)
  }, [organizationId])

  useEffect(() => {
    if (orgStatus !== "ready" || !organizationId) return
    if (activeTab !== "completed") return
    let cancelled = false
    setCompletedLoading(true)
    setCompletedError(null)
    void (async () => {
      try {
        const rows = await fetchCompletedCertificates()
        if (cancelled) return
        setCompletedRows(rows ?? [])
      } catch (e) {
        if (cancelled) return
        setCompletedError(e instanceof Error ? e.message : String(e))
        setCompletedRows([])
      } finally {
        if (!cancelled) setCompletedLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgStatus, organizationId, activeTab, fetchCompletedCertificates])

  const openWorkOrderCertificate = useCallback(
    (workOrderId: string) => {
      router.push(`/work-orders?open=${encodeURIComponent(workOrderId)}&tab=certificates`)
    },
    [router],
  )

  const handlePrintCertificate = useCallback(
    async (row: CompletedCertificateListItem) => {
      const supabase = createBrowserSupabaseClient()
      try {
        const html = await buildCompletedCertificatePdfHtml(supabase, row)
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
    },
    [toast],
  )

  const handleDownloadCertificateHtml = useCallback(
    async (row: CompletedCertificateListItem) => {
      const supabase = createBrowserSupabaseClient()
      try {
        const html = await buildCompletedCertificatePdfHtml(supabase, row)
        const safe = row.workOrderLabel.replace(/[^\w.-]+/g, "_")
        downloadCertificateHtmlFile(html, `Calibration-${safe}`)
        toast({
          title: "Download started",
          description: "Open the HTML file and use Print → Save as PDF.",
        })
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Could not generate certificate",
          description: e instanceof Error ? e.message : String(e),
        })
      }
    },
    [toast],
  )

  useLayoutEffect(() => {
    if (newTemplateFocusTick === 0) return
    if (activeTab !== "templates") return
    document.getElementById(TEMPLATE_NAME_INPUT_ID)?.focus()
  }, [newTemplateFocusTick, activeTab])

  useLayoutEffect(() => {
    if (!pendingFieldFocusId) return
    const el = document.querySelector<HTMLInputElement>(`[data-field-label-input="${pendingFieldFocusId}"]`)
    el?.focus()
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    setPendingFieldFocusId(null)
  }, [pendingFieldFocusId, draft.fields])

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  )

  const hasUnsavedChanges = useMemo(
    () => !draftsEqual(draft, baselineDraft),
    [draft, baselineDraft],
  )

  const panelMode = useMemo(() => {
    if (isCreatingNew) return "create" as const
    if (selectedId) return "edit" as const
    return "empty" as const
  }, [isCreatingNew, selectedId])

  function confirmDiscardIfNeeded(): boolean {
    if (!hasUnsavedChanges) return true
    return window.confirm("You have unsaved changes. Discard them and continue?")
  }

  function beginNewTemplate() {
    if (!confirmDiscardIfNeeded()) return
    setError(null)
    setSelectedId(null)
    setIsCreatingNew(true)
    const blank = emptyDraft()
    setDraft(blank)
    setBaselineDraft(emptyDraft())
    setActiveTab("templates")
    setNewTemplateFocusTick((n) => n + 1)
  }

  function selectTemplate(id: string) {
    if (selectedId === id && !isCreatingNew) return
    if (!confirmDiscardIfNeeded()) return
    const next = templates.find((t) => t.id === id)
    if (!next) return
    const d = copyTemplateToDraft(next)
    setIsCreatingNew(false)
    setSelectedId(id)
    setDraft(d)
    setBaselineDraft(cloneDraft(d))
  }

  function cancelPanel() {
    if (isCreatingNew) {
      if (hasUnsavedChanges && !window.confirm("Discard unsaved changes?")) return
      setIsCreatingNew(false)
      setDraft(emptyDraft())
      setBaselineDraft(emptyDraft())
      return
    }
    if (selectedId) {
      if (hasUnsavedChanges && !window.confirm("Discard unsaved changes?")) return
      setDraft(cloneDraft(baselineDraft))
    }
  }

  function addFieldOfType(type: CalibrationFieldType) {
    const id = crypto.randomUUID()
    const field: CalibrationTemplateField =
      type === "number"
        ? { id, type, label: "", required: false, helpText: "", unit: "" }
        : { id, type, label: "", required: false, helpText: "" }
    setDraft((prev) => ({ ...prev, fields: [...prev.fields, field] }))
    setPendingFieldFocusId(id)
  }

  function updateField(id: string, patch: Partial<CalibrationTemplateField>) {
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === id ? mergeFieldPatch(f, patch) : f)),
    }))
  }

  function moveField(index: number, dir: -1 | 1) {
    setDraft((prev) => {
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
    setDraft((prev) => ({ ...prev, fields: prev.fields.filter((f) => f.id !== id) }))
  }

  const saveDraftState = useCallback(
    async (state: DraftState): Promise<CalibrationTemplate> => {
      if (orgStatus !== "ready" || !organizationId) {
        throw new Error("WORKSPACE_NOT_READY")
      }
      if (!state.name.trim()) {
        throw new Error("NAME_REQUIRED")
      }
      if (!state.id) {
        const gate = await enforceCanCreateRecord(organizationId, "calibration_template")
        if (!gate.ok) throw new Error(gate.message)
      }
      const supabase = createBrowserSupabaseClient()
      return upsertCalibrationTemplate(supabase, organizationId, {
        id: state.id,
        name: state.name.trim(),
        equipmentCategoryId: state.equipmentCategoryId || null,
        fields: state.fields,
      })
    },
    [orgStatus, organizationId],
  )

  async function handleSave() {
    const wasNew = !draft.id
    setSaving(true)
    setError(null)
    try {
      const saved = await saveDraftState(draft)
      const supabase = createBrowserSupabaseClient()
      const rows = await listCalibrationTemplates(supabase, organizationId!)
      setTemplates(rows)
      setIsCreatingNew(false)
      setSelectedId(saved.id)
      const savedDraft = copyTemplateToDraft(saved)
      setDraft(savedDraft)
      setBaselineDraft(cloneDraft(savedDraft))
      toast({
        title: wasNew ? "Template created" : "Template saved",
        description: saved.name,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === "WORKSPACE_NOT_READY") {
        toast({
          variant: "destructive",
          title: "Cannot save yet",
          description: "Wait for your workspace to finish loading, then try again.",
        })
      } else if (msg === "NAME_REQUIRED") {
        const friendly = "Template name is required."
        setError(friendly)
        toast({ variant: "destructive", title: "Cannot save", description: friendly })
      } else {
        setError(msg)
        toast({
          variant: "destructive",
          title: wasNew ? "Could not create template" : "Could not save template",
          description: msg,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleImportCommit(importReview: ImportReviewDraft) {
    if (!confirmDiscardIfNeeded()) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveDraftState({
        name: importReview.name,
        equipmentCategoryId: importReview.equipmentCategoryId,
        fields: importReview.fields,
      })
      const supabase = createBrowserSupabaseClient()
      const rows = await listCalibrationTemplates(supabase, organizationId!)
      setTemplates(rows)
      setIsCreatingNew(false)
      setSelectedId(saved.id)
      const savedDraft = copyTemplateToDraft(saved)
      setDraft(savedDraft)
      setBaselineDraft(cloneDraft(savedDraft))
      setImportOpen(false)
      setActiveTab("templates")
      toast({
        title: "Template created",
        description: saved.name,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === "WORKSPACE_NOT_READY") {
        toast({
          variant: "destructive",
          title: "Cannot save yet",
          description: "Wait for your workspace to finish loading, then try again.",
        })
      } else if (msg === "NAME_REQUIRED") {
        const friendly = "Template name is required."
        toast({ variant: "destructive", title: "Cannot create template", description: friendly })
      } else {
        setError(msg)
        toast({
          variant: "destructive",
          title: "Could not create template",
          description: msg,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveCurrent() {
    if (!selectedTemplate || !organizationId) return
    const archiveMsg = hasUnsavedChanges
      ? `Discard unsaved changes and archive "${selectedTemplate.name}"?`
      : `Archive template "${selectedTemplate.name}"?`
    if (!window.confirm(archiveMsg)) return
    const supabase = createBrowserSupabaseClient()
    try {
      await archiveCalibrationTemplate(supabase, organizationId, selectedTemplate.id)
      const next = templates.filter((t) => t.id !== selectedTemplate.id)
      setTemplates(next)
      if (next.length > 0) {
        const first = next[0]
        const d = copyTemplateToDraft(first)
        setIsCreatingNew(false)
        setSelectedId(first.id)
        setDraft(d)
        setBaselineDraft(cloneDraft(d))
      } else {
        setIsCreatingNew(false)
        setSelectedId(null)
        setDraft(emptyDraft())
        setBaselineDraft(emptyDraft())
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <FileBadge2 className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex flex-col">
            <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight leading-tight text-balance">
              Certificates
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
              Create reusable calibration templates and manage completed certificates.
            </p>
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
              className="inline-flex grow-0 items-center gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <FileText className="h-4 w-4 shrink-0" aria-hidden />
              Templates
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="inline-flex grow-0 items-center gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2.5 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
              Completed Certificates
            </TabsTrigger>
          </TabsList>
          <div className="flex shrink-0 items-center gap-2 mb-px">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="w-4 h-4" />
              Import Template
            </Button>
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-9 gap-1.5"
              onClick={beginNewTemplate}
            >
              <Plus className="w-4 h-4" />
              New Template
            </Button>
          </div>
        </div>
        {activeTab === "completed" ? (
          <div className="border-b border-border bg-background px-1 py-2">
            <div className="relative max-w-md">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={completedCertificatesSearchQuery}
                onChange={(e) => setCompletedCertificatesSearchQuery(e.target.value)}
                placeholder="Search completed certificates..."
                autoComplete="off"
                className="h-9 w-full pl-8"
                aria-label="Search completed certificates"
              />
            </div>
          </div>
        ) : null}

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
                  templates.map((t) => {
                    const isSelected = selectedId === t.id && !isCreatingNew
                    const metaParts = [
                      t.fields.length === 1 ? "1 field" : `${t.fields.length} fields`,
                      t.equipmentCategoryId?.trim() || null,
                    ].filter(Boolean)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTemplate(t.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-sm border-b border-border/70 transition-colors",
                          isSelected
                            ? "bg-primary/12 border-l-[3px] border-l-primary pl-[9px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
                            : "border-l-[3px] border-l-transparent hover:bg-muted/40 pl-3",
                        )}
                      >
                        <p className={cn("font-medium", isSelected ? "text-primary" : "text-foreground")}>{t.name}</p>
                        {metaParts.length > 0 ? (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{metaParts.join(" · ")}</p>
                        ) : null}
                      </button>
                    )
                  })
                )}
              </div>
            </Card>

            {panelMode === "empty" ? (
              <Card className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center border-dashed bg-muted/10">
                <div className="w-12 h-12 rounded-full bg-muted/50 border border-border flex items-center justify-center mb-4">
                  <FileBadge2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-base font-semibold text-foreground">No template selected</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Select a template from the left or create a new one.
                </p>
                <Button type="button" className="mt-6 gap-1.5" onClick={beginNewTemplate}>
                  <Plus className="w-4 h-4" />
                  Create Template
                </Button>
              </Card>
            ) : (
              <Card
                className={cn(
                  "flex flex-col min-h-[min(560px,70vh)] max-h-[calc(100vh-12rem)] overflow-hidden border shadow-sm",
                  panelMode === "create" && "ring-1 ring-primary/20 bg-primary/[0.03]",
                )}
              >
                <div
                  className={cn(
                    "shrink-0 px-4 py-3 border-b",
                    panelMode === "create"
                      ? "bg-primary/5 border-primary/20"
                      : "bg-muted/30 border-border",
                  )}
                >
                  {panelMode === "create" ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="gap-1 font-normal">
                          <Sparkles className="w-3 h-3" />
                          New
                        </Badge>
                        <h2 className="text-sm font-semibold text-foreground">Create New Template</h2>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Add a name, optional category, and fields — then create your template.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                          <PenLine className="w-3 h-3" />
                          Editing
                        </Badge>
                      </div>
                      <h2 className="text-xl font-semibold text-foreground tracking-tight truncate">
                        {draft.name.trim() || "Untitled template"}
                      </h2>
                      <p className="text-xs text-muted-foreground">Rename below or adjust fields, then save changes.</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
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

                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Field builder</p>
                    <p className="text-xs text-muted-foreground -mt-2">Add a field type — the new row is focused for editing.</p>
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
                    {draft.fields.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                          No fields yet. Add a section or field type to build your certificate.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {draft.fields.map((field, index) => (
                          <div
                            key={field.id}
                            className="rounded-xl border border-border p-3 sm:p-4 space-y-3 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                          >
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_12rem_auto] xl:items-end">
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
                              <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
                                {field.type !== "section_heading" ? (
                                  <label className="inline-flex items-center gap-2 h-9 px-2.5 rounded-md border border-border bg-background text-xs text-foreground cursor-pointer shrink-0">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(field.required)}
                                      onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                      className="rounded border-input"
                                    />
                                    Required
                                  </label>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground h-9 inline-flex items-center px-1">
                                    Section divider
                                  </span>
                                )}
                                <div className="flex items-center gap-0.5">
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
                                    disabled={index >= draft.fields.length - 1}
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
                            </div>
                            {field.type === "number" ? (
                              <div className="grid grid-cols-1 sm:max-w-sm gap-1">
                                <p className="text-[10px] font-medium text-muted-foreground">Unit (optional)</p>
                                <Input
                                  value={field.unit ?? ""}
                                  onChange={(e) => updateField(field.id, { unit: e.target.value })}
                                  placeholder="e.g. V, PSI, °F"
                                  autoComplete="off"
                                />
                              </div>
                            ) : null}
                            {field.type === "pass_fail" ? (
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Technicians will select <span className="font-medium text-foreground">Pass</span> or{" "}
                                <span className="font-medium text-foreground">Fail</span> for this check.
                              </p>
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
                    )}

                    <CertificateTemplatePreview templateName={draft.name} fields={draft.fields} />
                  </div>
                </div>

                <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between gap-y-2">
                  <div className="min-h-[1.25rem] flex items-center">
                    {hasUnsavedChanges ? (
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Unsaved changes</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">All changes saved</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <Button type="button" size="sm" variant="outline" className="h-9 text-xs" onClick={cancelPanel}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 text-xs min-w-[8rem]"
                      onClick={() => void handleSave()}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : panelMode === "create" ? "Create Template" : "Save Changes"}
                    </Button>
                    {panelMode === "edit" && selectedTemplate ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => void handleArchiveCurrent()}
                      >
                        Archive Template
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-0">
          {completedError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {completedError}
            </div>
          ) : null}

          {completedLoading ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Loading completed certificates…</p>
            </Card>
          ) : completedError ? null : completedRows.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="mx-auto w-10 h-10 rounded-xl bg-muted/30 border border-border flex items-center justify-center mb-3">
                <Rows3 className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No saved certificates yet. Saved certificates from work orders will appear here.
              </p>
            </Card>
          ) : filteredCompletedRows.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No certificates match your search.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredCompletedRows.map((row) => (
                <Card
                  key={row.recordId}
                  role="button"
                  tabIndex={0}
                  onClick={() => openWorkOrderCertificate(row.workOrderId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openWorkOrderCertificate(row.workOrderId)
                    }
                  }}
                  className={cn(
                    "p-4 sm:p-5 text-left transition-colors cursor-pointer",
                    "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between gap-y-2">
                    <div className="min-w-0 space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground truncate">{row.template.name}</p>
                        <Badge variant="secondary" className="shrink-0 font-normal text-xs">
                          {row.workOrderStatusLabel}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">{row.workOrderLabel}</span>
                        {row.workOrderTitle ? (
                          <span className="text-muted-foreground"> · {row.workOrderTitle}</span>
                        ) : null}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground/80">Customer</span>{" "}
                          {row.customerName}
                        </p>
                        <p>
                          <span className="font-medium text-foreground/80">Equipment</span>{" "}
                          {row.equipmentLabel}
                        </p>
                        <p>
                          <span className="font-medium text-foreground/80">Technician</span>{" "}
                          {row.technicianName ?? "—"}
                        </p>
                        <p>
                          <span className="font-medium text-foreground/80">Saved</span>{" "}
                          {formatListDate(row.savedAt)}
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex flex-wrap items-center gap-2 shrink-0 sm:pt-0.5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => void handlePrintCertificate(row)}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print / PDF
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => void handleDownloadCertificateHtml(row)}
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        HTML
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => openWorkOrderCertificate(row.workOrderId)}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Work Order
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ImportTemplateDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        saving={saving}
        onCommit={handleImportCommit}
      />
    </div>
  )
}
