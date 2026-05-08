"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Loader2, PauseCircle, PlayCircle, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { IMPORT_STRATEGIES } from "@/lib/migration-imports/strategy"
import type { MigrationImportStrategy } from "@/lib/migration-imports/types"
import type { PreviewResult } from "@/lib/migration-imports/public-types"

type CommitJson = {
  ok?: boolean
  successCount?: number
  updatedCount?: number
  errorCount?: number
  skippedCount?: number
  importRef?: string
  message?: string
  strategy?: MigrationImportStrategy
  outcomes?: {
    rowIndex: number
    status: string
    message: string | null
    codes: string[]
    ref?: string
    matchedLabel?: string
  }[]
}

type UploadInspection = {
  fileName?: string
  fileSize?: number
  sourceType?: "csv" | "xlsx"
  worksheets?: string[]
  selectedWorksheet?: string | null
  detectedColumns?: string[]
  sampleValues?: Record<string, string>
  rowCountEstimate?: number
  message?: string
}

type AsyncRun = {
  runId: string
  status: string
  chunkSize: number
  totalRows: number
  totalChunks: number
  currentChunkIndex: number
  processedCount: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  cancelRequestedAt: string | null
}

type CustomerMappingField = {
  field: string
  label: string
  required?: boolean
  description?: string
}

const CUSTOMER_MAPPING_FIELDS: CustomerMappingField[] = [
  { field: "source_record_id", label: "Source record ID", description: "Preserved for source-system mapping." },
  { field: "company_name", label: "Customer name", required: true, description: "Required for creating customers." },
  { field: "external_code", label: "External ID" },
  { field: "contact_full_name", label: "Primary contact name" },
  { field: "contact_email", label: "Primary contact email" },
  { field: "contact_phone", label: "Primary contact phone" },
  { field: "billing_name", label: "Billing name" },
  { field: "billing_contact_name", label: "Billing contact name" },
  { field: "billing_contact_email", label: "Billing contact email" },
  { field: "billing_contact_phone", label: "Billing contact phone" },
  { field: "billing_address_line_1", label: "Billing address line 1" },
  { field: "billing_address_line_2", label: "Billing address line 2" },
  { field: "billing_city", label: "Billing city" },
  { field: "billing_state", label: "Billing state" },
  { field: "billing_postal_code", label: "Billing ZIP" },
  { field: "billing_country", label: "Billing country" },
  { field: "address_line1", label: "Billing address line 1" },
  { field: "address_line2", label: "Billing address line 2" },
  { field: "city", label: "Billing city" },
  { field: "state", label: "Billing state" },
  { field: "postal_code", label: "Billing ZIP" },
  { field: "country", label: "Billing country" },
  { field: "service_address_line1", label: "Service address line 1" },
  { field: "service_address_line2", label: "Service address line 2" },
  { field: "service_city", label: "Service city" },
  { field: "service_state", label: "Service state" },
  { field: "service_postal_code", label: "Service ZIP" },
  { field: "service_country", label: "Service country" },
  { field: "location_name", label: "Site name" },
  { field: "location_group", label: "Location group" },
  { field: "notes", label: "Notes" },
  { field: "po_requirements", label: "PO requirements" },
  { field: "po_required", label: "PO required" },
  { field: "default_po_number", label: "Default PO number" },
  { field: "invoice_instructions", label: "Invoice instructions" },
  { field: "billing_behavior", label: "Billing behavior" },
  { field: "default_payment_terms_key", label: "Default payment terms" },
  { field: "default_payment_terms_days", label: "Default payment terms days" },
  { field: "default_payment_terms_label", label: "Default payment terms label" },
  { field: "tax_exempt", label: "Tax exempt" },
  { field: "tax_exemption_id", label: "Tax exemption ID" },
  { field: "tax_exemption_notes", label: "Tax exemption notes" },
  { field: "default_tax_basis", label: "Default tax basis" },
  { field: "tax_id", label: "Tax ID" },
  { field: "legacy_source_ids", label: "Legacy source ID" },
  { field: "parent_external_code", label: "Parent external code", description: "Preserved for future hierarchy support." },
  { field: "parent_company_name", label: "Parent company name", description: "Preserved for future hierarchy support." },
] as const

const EQUIPMENT_MAPPING_FIELDS: CustomerMappingField[] = [
  { field: "source_record_id", label: "Source record ID", description: "Preserved for source-system mapping." },
  { field: "name", label: "Equipment name" },
  { field: "equipment_code", label: "External equipment ID" },
  { field: "serial_number", label: "Serial number", required: true },
  { field: "customer_external_code", label: "Customer external ID" },
  { field: "customer_company", label: "Customer company" },
  { field: "location_label", label: "Location / site" },
  { field: "manufacturer", label: "Make / manufacturer" },
  { field: "category", label: "Equipment type / category" },
  { field: "subcategory", label: "Model / subcategory" },
  { field: "install_date", label: "Install date" },
  { field: "warranty_expires_at", label: "Warranty expires" },
  { field: "next_due_at", label: "Next service due" },
  { field: "next_calibration_due_at", label: "Next calibration due" },
  { field: "calibration_interval_months", label: "Calibration interval months" },
  { field: "notes", label: "Notes" },
]

const WORK_ORDER_MAPPING_FIELDS: CustomerMappingField[] = [
  { field: "source_record_id", label: "Source record ID", description: "Preserved for source-system mapping." },
  { field: "work_order_number", label: "Job / work order ID" },
  { field: "title", label: "Title / summary", required: true },
  { field: "customer_external_code", label: "Customer external ID" },
  { field: "customer_company", label: "Customer company" },
  { field: "equipment_serial", label: "Equipment serial" },
  { field: "status", label: "Status" },
  { field: "priority", label: "Priority" },
  { field: "type", label: "Service type" },
  { field: "scheduled_on", label: "Service / appointment date" },
  { field: "completed_at", label: "Completed date" },
  { field: "technician_name", label: "Technician" },
  { field: "legacy_invoice_number", label: "Legacy invoice number" },
  { field: "notes", label: "Notes" },
]

const INVOICE_MAPPING_FIELDS: CustomerMappingField[] = [
  { field: "source_record_id", label: "Source record ID", description: "Preserved for source-system mapping." },
  { field: "invoice_number", label: "Invoice number", required: true },
  { field: "customer_external_code", label: "Customer external ID" },
  { field: "customer_company", label: "Customer company" },
  { field: "work_order_number", label: "Job / work order ID" },
  { field: "equipment_serial", label: "Equipment serial" },
  { field: "title", label: "Title / memo" },
  { field: "amount", label: "Total amount" },
  { field: "balance", label: "Balance" },
  { field: "issued_at", label: "Invoice date" },
  { field: "due_date", label: "Due date" },
  { field: "paid_at", label: "Paid date" },
  { field: "status", label: "Status" },
  { field: "notes", label: "Notes" },
]

const MAPPING_FIELDS_BY_KIND: Record<"customer" | "equipment" | "invoice" | "work_order", CustomerMappingField[]> = {
  customer: CUSTOMER_MAPPING_FIELDS,
  equipment: EQUIPMENT_MAPPING_FIELDS,
  invoice: INVOICE_MAPPING_FIELDS,
  work_order: WORK_ORDER_MAPPING_FIELDS,
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CsvImportFlow({
  kind,
  title,
  description,
  backHref,
  defaultSourceSystem = "",
}: {
  kind: "customer" | "equipment" | "invoice" | "work_order"
  title: string
  description: string
  backHref: string
  defaultSourceSystem?: string
}) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { toast } = useToast()

  const [file, setFile] = useState<File | null>(null)
  const [fileMeta, setFileMeta] = useState<UploadInspection | null>(null)
  const [worksheetName, setWorksheetName] = useState("")
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [inspectBusy, setInspectBusy] = useState(false)
  const [sourceSystem, setSourceSystem] = useState(defaultSourceSystem)
  const [busy, setBusy] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [importRef, setImportRef] = useState<string | null>(null)
  const [columnMappingText, setColumnMappingText] = useState("{}")
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewMeta, setPreviewMeta] = useState<{ rowCount: number; truncated: boolean } | null>(null)
  const [commitResult, setCommitResult] = useState<CommitJson | null>(null)
  const [strategy, setStrategy] = useState<MigrationImportStrategy>("skip_duplicates")
  const [linkChildrenToExistingParents, setLinkChildrenToExistingParents] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [asyncMode, setAsyncMode] = useState(false)
  const [asyncRun, setAsyncRun] = useState<AsyncRun | null>(null)
  const [asyncBusy, setAsyncBusy] = useState(false)

  const inspectFile = useCallback(
    async (nextFile: File) => {
      if (!organizationId) return
      setInspectBusy(true)
      try {
        const form = new FormData()
        form.append("file", nextFile)
        form.append("kind", kind)
        form.append("inspectOnly", "true")
        const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports`, {
          method: "POST",
          body: form,
        })
        const json = (await res.json()) as UploadInspection
        if (!res.ok) {
          toast({ title: "File inspection failed", description: json.message ?? "Could not inspect file.", variant: "destructive" })
          setFileMeta(null)
          setDetectedColumns([])
          return
        }
        setFileMeta(json)
        setDetectedColumns(json.detectedColumns ?? [])
        setWorksheetName(json.selectedWorksheet ?? "")
      } catch {
        toast({ title: "File inspection failed", description: "Network error.", variant: "destructive" })
      } finally {
        setInspectBusy(false)
      }
    },
    [kind, organizationId, toast],
  )

  useEffect(() => {
    if (!file || !organizationId) return
    setPreview(null)
    setPreviewMeta(null)
    setCommitResult(null)
    setJobId(null)
    setImportRef(null)
    setAsyncRun(null)
    void inspectFile(file)
  }, [file, inspectFile, organizationId])

  const runUpload = useCallback(async () => {
    if (!organizationId || !file) return
    setBusy(true)
    setCommitResult(null)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("kind", kind)
      if (sourceSystem.trim()) form.append("sourceSystem", sourceSystem.trim())
      if (worksheetName.trim()) form.append("worksheetName", worksheetName.trim())

      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports`, {
        method: "POST",
        body: form,
      })
      const json = (await res.json()) as {
        jobId?: string
        columnMapping?: Record<string, string>
        preview?: PreviewResult
        rowCount?: number
        fileName?: string
        fileSize?: number
        sourceType?: "csv" | "xlsx"
        worksheets?: string[]
        selectedWorksheet?: string | null
        detectedColumns?: string[]
        sampleValues?: Record<string, string>
        rowCountEstimate?: number
        truncated?: boolean
        message?: string
      }
      if (!res.ok) {
        toast({ title: "Upload failed", description: json.message ?? "Could not start import.", variant: "destructive" })
        return
      }
      setJobId(json.jobId ?? null)
      setPreview(json.preview ?? null)
      setPreviewMeta({
        rowCount: json.rowCount ?? json.preview?.rowCount ?? 0,
        truncated: Boolean(json.truncated),
      })
      setFileMeta({
        fileName: json.fileName ?? file.name,
        fileSize: json.fileSize ?? file.size,
        sourceType: json.sourceType,
        worksheets: json.worksheets,
        selectedWorksheet: json.selectedWorksheet,
        detectedColumns: json.detectedColumns,
        sampleValues: json.sampleValues,
        rowCountEstimate: json.rowCountEstimate,
      })
      setDetectedColumns(json.detectedColumns ?? json.preview?.sampleRows.flatMap((row) => Object.keys(row.cells)) ?? [])
      setWorksheetName(json.selectedWorksheet ?? worksheetName)
      setColumnMappingText(JSON.stringify(json.columnMapping ?? {}, null, 2))
      setImportRef(null)
      setAsyncRun(null)
      toast({ title: "Preview ready", description: "Review validation and outcome estimates, then adjust mapping if needed." })
    } catch {
      toast({ title: "Upload failed", description: "Network error.", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }, [organizationId, file, kind, sourceSystem, toast, worksheetName])

  const runPreviewRefresh = useCallback(async () => {
    if (!organizationId || !jobId) return
    let mapping: Record<string, string>
    try {
      mapping = JSON.parse(columnMappingText) as Record<string, string>
    } catch {
      toast({ title: "Invalid mapping", description: "Column mapping must be valid JSON.", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnMapping: mapping, options: { strategy, linkChildrenToExistingParents } }),
        },
      )
      const json = (await res.json()) as { preview?: PreviewResult; message?: string }
      if (!res.ok) {
        toast({ title: "Preview failed", description: json.message ?? "Could not refresh preview.", variant: "destructive" })
        return
      }
      setPreview(json.preview ?? null)
      toast({ title: "Preview updated" })
    } catch {
      toast({ title: "Preview failed", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }, [organizationId, jobId, columnMappingText, strategy, linkChildrenToExistingParents, toast])

  const runCommit = useCallback(async () => {
    if (!organizationId || !jobId) return
    let mapping: Record<string, string>
    try {
      mapping = JSON.parse(columnMappingText) as Record<string, string>
    } catch {
      toast({ title: "Invalid mapping", description: "Column mapping must be valid JSON.", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columnMapping: mapping,
            options: { strategy, linkChildrenToExistingParents },
          }),
        },
      )
      const json = (await res.json()) as CommitJson & { message?: string }
      if (!res.ok) {
        toast({ title: "Import failed", description: json.message ?? "Commit rejected.", variant: "destructive" })
        return
      }
      setCommitResult(json)
      setImportRef(json.importRef ?? null)
      toast({
        title: json.ok ? "Import finished" : "Import completed with issues",
        description: `${json.successCount ?? 0} created${json.updatedCount ? ` · ${json.updatedCount} updated` : ""}`,
      })
    } catch {
      toast({ title: "Import failed", variant: "destructive" })
    } finally {
      setBusy(false)
      setConfirmOpen(false)
    }
  }, [organizationId, jobId, columnMappingText, strategy, linkChildrenToExistingParents, toast])

  const runAsyncAction = useCallback(
    async (action: "start" | "tick" | "cancel") => {
      if (!organizationId || !jobId) return null
      let mapping: Record<string, string> = {}
      try {
        mapping = JSON.parse(columnMappingText) as Record<string, string>
      } catch {
        if (action === "start") {
          toast({ title: "Invalid mapping", description: "Column mapping must be valid JSON.", variant: "destructive" })
        }
      }
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}/async`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            columnMapping: mapping,
            options: { strategy, linkChildrenToExistingParents },
          }),
        },
      )
      const json = (await res.json()) as { run?: AsyncRun | null; message?: string; accepted?: boolean }
      if (!res.ok) {
        toast({ title: "Background import", description: json.message ?? "Action failed.", variant: "destructive" })
        return null
      }
      return json
    },
    [organizationId, jobId, columnMappingText, strategy, linkChildrenToExistingParents, toast],
  )

  const startAsyncRun = useCallback(async () => {
    setAsyncBusy(true)
    try {
      const json = await runAsyncAction("start")
      if (!json) return
      setAsyncMode(true)
      setAsyncRun(json.run ?? null)
      toast({
        title: "Background import started",
        description: "Processing chunks in the background. Keep this tab open for best progress.",
      })
    } finally {
      setAsyncBusy(false)
      setConfirmOpen(false)
    }
  }, [runAsyncAction, toast])

  const cancelAsyncRun = useCallback(async () => {
    setAsyncBusy(true)
    try {
      const json = await runAsyncAction("cancel")
      setAsyncRun(json?.run ?? null)
      toast({ title: "Cancellation requested", description: "Current chunk will stop at the next checkpoint." })
    } finally {
      setAsyncBusy(false)
    }
  }, [runAsyncAction, toast])

  useEffect(() => {
    if (!asyncMode) return
    const id = setInterval(() => {
      void (async () => {
        const json = await runAsyncAction("tick")
        if (!json) return
        const run = json.run ?? null
        setAsyncRun(run)
        if (!run) {
          setAsyncMode(false)
          toast({ title: "Background import completed", description: "Open job detail to review full outcomes." })
        }
      })()
    }, 2500)
    return () => clearInterval(id)
  }, [asyncMode, runAsyncAction, toast])

  if (orgStatus !== "ready" || !organizationId) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace…
      </div>
    )
  }

  const totalRows = previewMeta?.rowCount ?? preview?.rowCount ?? 0
  const proj = preview?.projection
  const validationErrors = preview?.summary.errorRows ?? 0

  const confirmSummary =
    proj != null
      ? `You are about to import ${totalRows.toLocaleString()} row${totalRows === 1 ? "" : "s"}. About ${proj.willCreate.toLocaleString()} will be created, ${proj.willUpdate.toLocaleString()} may update existing records, ${proj.willSkip.toLocaleString()} will be skipped, and ${Math.max(validationErrors, proj.willFail).toLocaleString()} rows have validation or merge issues in this estimate.`
      : `You are about to import ${totalRows.toLocaleString()} row${totalRows === 1 ? "" : "s"}. Refresh preview for a detailed estimate. ${validationErrors} row${validationErrors === 1 ? "" : "s"} show validation errors in the sample.`

  let parsedColumnMapping: Record<string, string> = {}
  try {
    parsedColumnMapping = JSON.parse(columnMappingText) as Record<string, string>
  } catch {
    parsedColumnMapping = {}
  }

  const updateMappedField = (field: string, value: string) => {
    const next = { ...parsedColumnMapping }
    if (value === "__ignore") {
      delete next[field]
    } else {
      next[field] = value
    }
    setColumnMappingText(JSON.stringify(next, null, 2))
  }

  const updateSourceColumnMapping = (column: string, targetField: string) => {
    const next = Object.fromEntries(
      Object.entries(parsedColumnMapping).filter(([field, mappedColumn]) => field !== targetField && mappedColumn !== column),
    )
    if (targetField !== "__ignore") {
      next[targetField] = column
    }
    setColumnMappingText(JSON.stringify(next, null, 2))
  }

  const targetForSourceColumn = (column: string) =>
    Object.entries(parsedColumnMapping).find(([, mappedColumn]) => mappedColumn === column)?.[0] ?? "__ignore"

  const hasRequiredCustomerName = kind !== "customer" || Boolean(parsedColumnMapping.company_name)
  const hasReliableCustomerMatch =
    kind !== "customer" ||
    Boolean(parsedColumnMapping.company_name || parsedColumnMapping.external_code || parsedColumnMapping.contact_email)
  const canStartImport = Boolean(jobId) && !asyncMode && hasRequiredCustomerName && hasReliableCustomerMatch

  const issueCounts = preview?.summary.issueCounts ?? {}
  const issueEntries = Object.entries(issueCounts).sort((a, b) => b[1] - a[1])
  const rowsWithIssues = (preview?.summary.errorRows ?? 0) + (preview?.summary.warningRows ?? 0)
  const recommendedAction =
    strategy === "skip_duplicates"
      ? "These rows will be skipped unless you choose an update strategy."
      : strategy === "update_empty_fields"
        ? "Only blank fields on matching customers will be filled."
        : strategy === "update_existing"
          ? "Mapped fields on matching customers may be replaced."
          : "Matching rows will fail instead of updating existing customers."

  const mappingFields = MAPPING_FIELDS_BY_KIND[kind]
  const mappingStorageKey = sourceSystem.trim()
    ? `equipify:migration-mapping:${kind}:${sourceSystem.trim().toLowerCase()}`
    : null

  const saveMapping = () => {
    if (!mappingStorageKey) {
      toast({ title: "Add a legacy system", description: "Enter a source name before saving a reusable mapping." })
      return
    }
    window.localStorage.setItem(mappingStorageKey, columnMappingText)
    toast({ title: "Mapping saved", description: `Saved for ${sourceSystem.trim()}.` })
  }

  const loadSavedMapping = () => {
    if (!mappingStorageKey) return
    const saved = window.localStorage.getItem(mappingStorageKey)
    if (!saved) {
      toast({ title: "No saved mapping", description: `No mapping is saved for ${sourceSystem.trim()}.` })
      return
    }
    setColumnMappingText(saved)
    toast({ title: "Mapping loaded" })
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2 mb-2">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            Migration center
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="csv-file">Import file</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            UTF-8 CSV or XLSX with a header row. Maximum 5,000 rows per preview batch; larger imports can use background processing.
          </p>
        </div>
        {file ? (
          <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">File:</span> {file.name}
              </span>
              <span>
                <span className="font-medium text-foreground">Size:</span> {formatBytes(file.size)}
              </span>
              {inspectBusy ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Inspecting…
                </span>
              ) : null}
              {fileMeta?.rowCountEstimate != null ? (
                <span>
                  <span className="font-medium text-foreground">Estimated rows:</span>{" "}
                  {fileMeta.rowCountEstimate.toLocaleString()}
                </span>
              ) : null}
            </div>
            {fileMeta?.worksheets && fileMeta.worksheets.length > 0 ? (
              <div className="grid gap-2 max-w-sm">
                <Label htmlFor="worksheet-name">Worksheet</Label>
                <Select value={worksheetName} onValueChange={setWorksheetName}>
                  <SelectTrigger id="worksheet-name">
                    <SelectValue placeholder="Choose worksheet" />
                  </SelectTrigger>
                  <SelectContent>
                    {fileMeta.worksheets.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {detectedColumns.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detected columns</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {detectedColumns.slice(0, 24).map((column) => (
                    <span key={column} className="rounded-full border border-border bg-background px-2 py-0.5 text-xs">
                      {column}
                    </span>
                  ))}
                  {detectedColumns.length > 24 ? (
                    <span className="px-2 py-0.5 text-xs text-muted-foreground">+{detectedColumns.length - 24} more</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="source-system">Legacy system (optional)</Label>
          <Input
            id="source-system"
            placeholder="e.g. FieldPulse, Jobber, spreadsheet export"
            value={sourceSystem}
            onChange={(e) => setSourceSystem(e.target.value)}
          />
        </div>
        <Button type="button" onClick={() => void runUpload()} disabled={!file || busy || inspectBusy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload &amp; preview
        </Button>
      </div>

      {preview ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-foreground">Validation summary</h2>
            {previewMeta?.truncated ? (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Truncated to 5,000 rows — split larger files.
              </span>
            ) : null}
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Import safety</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Every batch is logged with per-row outcomes. Duplicates are not overwritten when you use the default strategy.</li>
              <li>Reverting a large import may require support — contact your workspace admin before running very wide updates.</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Rows" value={String(previewMeta?.rowCount ?? preview.rowCount)} />
            <Stat label="OK" value={String(preview.summary.okRows)} />
            <Stat label="Warnings" value={String(preview.summary.warningRows)} tone="amber" />
            <Stat label="Errors" value={String(preview.summary.errorRows)} tone="destructive" />
          </div>

          {proj ? (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Outcome estimate (current strategy)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Stat label="Likely new customers" value={String(proj.willCreate)} tone="positive" />
                <Stat label="Likely updates" value={String(proj.willUpdate)} tone="amber" />
                <Stat label="Likely skipped" value={String(proj.willSkip)} />
                <Stat label="Rows with issues" value={String(Math.max(rowsWithIssues, proj.willFail))} tone="destructive" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Estimates use your mapping and existing workspace data. Refresh preview after changing strategy or mapping.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Refresh preview to compute outcome estimates for the selected strategy.</p>
          )}

          {issueEntries.length > 0 ? (
            <div className="grid gap-2">
              <h3 className="text-sm font-medium text-foreground">Validation issues</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {issueEntries.slice(0, 8).map(([code, count]) => (
                  <div key={code} className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{code.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{count} row{count === 1 ? "" : "s"} affected</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {(preview.duplicateHints.length > 0 || preview.unresolvedRefs.length > 0) && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm space-y-2">
              {preview.duplicateHints.length > 0 ? (
                <div className="text-amber-800 dark:text-amber-200 space-y-1">
                  <p>
                    <span className="font-medium">Possible matches:</span> {preview.duplicateHints.length} row
                    {preview.duplicateHints.length === 1 ? "" : "s"} flagged — review before commit.
                  </p>
                  <div className="overflow-x-auto rounded-md border border-amber-500/20 bg-background/70 mt-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-amber-500/20">
                          <th className="text-left px-2 py-1.5">Row</th>
                          <th className="text-left px-2 py-1.5">Imported</th>
                          <th className="text-left px-2 py-1.5">Existing match</th>
                          <th className="text-left px-2 py-1.5">Reason</th>
                          <th className="text-left px-2 py-1.5">Recommended action</th>
                        </tr>
                      </thead>
                      <tbody>
                    {preview.duplicateHints.slice(0, 6).map((hint) => (
                          <tr key={`${hint.rowIndex}-${hint.message}`} className="border-b border-amber-500/10 last:border-0">
                            <td className="px-2 py-1.5 font-mono">{hint.rowIndex}</td>
                            <td className="px-2 py-1.5">{hint.importedLabel ?? "—"}</td>
                            <td className="px-2 py-1.5">{hint.matchedLabel ?? "Existing customer"}</td>
                            <td className="px-2 py-1.5">
                              {hint.matchReason ?? hint.message}
                              {hint.confidence ? ` · ${hint.confidence}` : ""}
                            </td>
                            <td className="px-2 py-1.5">{recommendedAction}</td>
                          </tr>
                    ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              {preview.unresolvedRefs.length > 0 ? (
                <p className="text-amber-800 dark:text-amber-200">
                  <span className="font-medium">Unresolved references:</span> {preview.unresolvedRefs.length} row
                  {preview.unresolvedRefs.length === 1 ? "" : "s"} may fail without matching customer, location, or equipment.
                </p>
              ) : null}
            </div>
          )}

          {preview.sampleRows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-2 py-1.5">#</th>
                    <th className="text-left px-2 py-1.5">Sample</th>
                    <th className="text-left px-2 py-1.5">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.slice(0, 10).map((s) => (
                    <tr key={s.rowIndex} className="border-t border-border/70">
                      <td className="px-2 py-1.5 font-mono text-xs">{s.rowIndex}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {Object.entries(s.cells)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </td>
                      <td className="px-2 py-1.5 text-xs">
                        {s.issues.length === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">None</span>
                        ) : (
                          <ul className="list-disc pl-4 space-y-0.5">
                            {s.issues.map((i) => (
                              <li key={`${s.rowIndex}-${i.code}`} className="text-muted-foreground">
                                <span
                                  className={cn(
                                    i.severity === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-400",
                                  )}
                                >
                                  {i.code}
                                </span>
                                : {i.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {detectedColumns.length > 0 ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Field mapping</h3>
                  <p className="text-xs text-muted-foreground">
                    Review each source column, confirm the suggested Equipify field, or ignore columns you do not want imported.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={loadSavedMapping} disabled={!mappingStorageKey}>
                    Load saved
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={saveMapping}>
                    Save mapping
                  </Button>
                </div>
              </div>
              {!hasRequiredCustomerName || !hasReliableCustomerMatch ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
                  {!hasRequiredCustomerName ? (
                    <p className="font-medium">Map a Customer name column before importing.</p>
                  ) : null}
                  {!hasReliableCustomerMatch ? (
                    <p>For safer matching, map at least one of Customer name, External ID, or Primary contact email.</p>
                  ) : null}
                  <p className="text-xs mt-1">
                    Preview refresh is still available while you tune the mapping; commit and background import remain disabled until required mapping is valid.
                  </p>
                </div>
              ) : null}
              {parsedColumnMapping.parent_external_code || parsedColumnMapping.parent_company_name || parsedColumnMapping.location_group ? (
                <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-sm text-sky-800 dark:text-sky-200">
                  <p>
                    Hierarchy and site grouping fields are preserved in import row snapshots. Enable parent linking below to connect children to existing parent accounts when there is a safe match.
                  </p>
                  <label className="mt-2 flex items-start gap-2 text-xs text-sky-900 dark:text-sky-100">
                    <input
                      type="checkbox"
                      checked={linkChildrenToExistingParents}
                      onChange={(event) => setLinkChildrenToExistingParents(event.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-border"
                    />
                    <span>Link children to existing parents when matched by parent external code or parent company name.</span>
                  </label>
                </div>
              ) : null}
              <div className="rounded-md border border-border overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(150px,1fr)_minmax(160px,1fr)_minmax(220px,260px)] bg-muted/40 text-xs font-medium text-muted-foreground">
                  <div className="px-3 py-2">Source column</div>
                  <div className="px-3 py-2">Sample value</div>
                  <div className="px-3 py-2">Equipify field</div>
                </div>
                {detectedColumns.map((column) => {
                  const target = targetForSourceColumn(column)
                  const targetMeta = mappingFields.find((field) => field.field === target)
                  return (
                    <div
                      key={column}
                      className="grid grid-cols-1 sm:grid-cols-[minmax(150px,1fr)_minmax(160px,1fr)_minmax(220px,260px)] gap-2 border-t border-border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{column}</p>
                        {targetMeta?.required ? <p className="text-xs text-destructive">Required field</p> : null}
                      </div>
                      <p className="text-sm text-muted-foreground truncate py-2">
                        {fileMeta?.sampleValues?.[column] || "—"}
                      </p>
                      <Select value={target} onValueChange={(value) => updateSourceColumnMapping(column, value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ignore">Ignore column</SelectItem>
                          {mappingFields.map((item) => (
                            <SelectItem key={`${column}-${item.field}`} value={item.field}>
                              {item.label}
                              {item.required ? " *" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {targetMeta?.description ? (
                        <p className="sm:col-start-3 text-xs text-muted-foreground -mt-1">{targetMeta.description}</p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void runPreviewRefresh()} disabled={busy}>
                  Refresh preview
                </Button>
              </div>
              <details className="rounded-md border border-border bg-muted/20 p-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">Advanced JSON mapping</summary>
                <textarea
                  className={cn(
                    "mt-3 w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  value={columnMappingText}
                  onChange={(e) => setColumnMappingText(e.target.value)}
                />
              </details>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="column-map">Column mapping (JSON)</Label>
              <textarea
                id="column-map"
                className={cn(
                  "w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                value={columnMappingText}
                onChange={(e) => setColumnMappingText(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void runPreviewRefresh()} disabled={busy}>
                  Refresh preview
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-2 max-w-md">
            <Label htmlFor="import-strategy">Merge strategy</Label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as MigrationImportStrategy)}>
              <SelectTrigger id="import-strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_STRATEGIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {IMPORT_STRATEGIES.find((s) => s.value === strategy)?.description ?? ""}
            </p>
            {strategy === "update_existing" ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                This strategy can replace mapped fields on existing customers. Use it only after reviewing duplicate matches.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={busy || !canStartImport}
              className="gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Commit import…
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void startAsyncRun()}
              disabled={busy || asyncBusy || !canStartImport}
              className="gap-2"
            >
              {asyncBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              Start background import (beta)
            </Button>
            {asyncMode ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void cancelAsyncRun()}
                disabled={asyncBusy}
                className="gap-2"
              >
                <PauseCircle className="h-4 w-4" />
                Request cancel
              </Button>
            ) : null}
          </div>

          {asyncRun ? (
            <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-2">
              <p className="font-medium text-foreground">Background import status: {asyncRun.status.replace(/_/g, " ")}</p>
              <p className="text-muted-foreground">
                Processed {asyncRun.processedCount.toLocaleString()} / {asyncRun.totalRows.toLocaleString()} rows · chunk{" "}
                {asyncRun.currentChunkIndex}/{Math.max(asyncRun.totalChunks, 1)}
              </p>
              <p className="text-muted-foreground">
                Created {asyncRun.createdCount} · Updated {asyncRun.updatedCount} · Skipped {asyncRun.skippedCount} · Errors{" "}
                {asyncRun.errorCount}
              </p>
              {asyncRun.cancelRequestedAt ? (
                <p className="text-amber-700 dark:text-amber-300">Cancellation requested; waiting for chunk checkpoint.</p>
              ) : null}
            </div>
          ) : null}

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm import</AlertDialogTitle>
                <AlertDialogDescription className="text-left space-y-3">
                  <span className="block">{confirmSummary}</span>
                  {strategy === "update_existing" ? (
                    <span className="block text-amber-700 dark:text-amber-300 font-medium">
                      You chose to update existing records. Mapped columns can overwrite current field values. Confirm only
                      if you intend to merge legacy data into live records.
                    </span>
                  ) : null}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                <Button type="button" disabled={busy} onClick={() => void runCommit()}>
                  {busy ? "Working…" : "Run import"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}

      {commitResult ? (
        <div className="rounded-lg border border-border bg-muted/20 p-5 space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Result
            {importRef ? (
              <span className="text-sm font-mono text-primary ml-2">#{importRef}</span>
            ) : null}
          </h3>
          <p className="text-sm text-muted-foreground">
            Created {commitResult.successCount ?? 0}
            {commitResult.updatedCount ? ` · Updated ${commitResult.updatedCount}` : ""}
            {` · Skipped ${commitResult.skippedCount ?? 0} · Errors ${commitResult.errorCount ?? 0}`}
          </p>
          {jobId ? (
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link href={`/settings/imports/${jobId}`}>Open job detail</Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a
                  href={`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}/export?filter=all`}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Full outcome CSV
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a
                  href={`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}/export?filter=failed`}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Errors only
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a
                  href={`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/${encodeURIComponent(jobId)}/export?filter=skipped`}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Skipped only
                </a>
              </Button>
            </div>
          ) : null}
          {commitResult.outcomes && commitResult.outcomes.length > 0 ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-primary font-medium">Row details</summary>
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
                {commitResult.outcomes.slice(0, 80).map((o) => (
                  <li key={o.rowIndex}>
                    Row {o.rowIndex}: {o.status}
                    {o.matchedLabel ? ` · ${o.matchedLabel}` : o.ref ? ` · ${o.ref}` : ""}
                    {o.message ? ` — ${o.message}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "amber" | "destructive" | "positive"
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border px-3 py-2",
        tone === "amber" && "border-amber-500/30 bg-amber-500/5",
        tone === "destructive" && "border-destructive/30 bg-destructive/5",
        tone === "positive" && "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
