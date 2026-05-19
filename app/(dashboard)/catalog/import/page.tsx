"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, Upload } from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import type { DuplicateAction, ExtractedCatalogRow, StoredPriceListPayload } from "@/lib/catalog/import-types"
import { CATALOG_ITEM_TYPES } from "@/lib/catalog/import-types"
import { validatePriceListFile } from "@/lib/catalog/price-list-file-validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  decideImportPollAction,
  friendlyImportPollStopMessage,
  normalizeUploadPriceListResponse,
} from "@/lib/catalog/import-poll-handling"
import {
  isCatalogImportPageDebugEnabled,
  pushCatalogImportDebug,
  type CatalogImportDebugEntry,
} from "@/lib/catalog/import-page-debug"

const SS_IMPORT = "equipify.catalogImport.importId"
const SS_JOB = "equipify.catalogImport.jobId"

export default function ImportPriceListPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { organizationId, status } = useActiveOrganization()

  const [manufacturerName, setManufacturerName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [importId, setImportId] = useState<string | null>(null)
  const [payload, setPayload] = useState<StoredPriceListPayload | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [extractBusy, setExtractBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [patchBusy, setPatchBusy] = useState(false)

  const [dupOpen, setDupOpen] = useState(false)
  const [dupConflicts, setDupConflicts] = useState<{ rowId: string; existingCatalogItemId: string }[]>([])
  const [dupChoices, setDupChoices] = useState<Record<string, DuplicateAction>>({})
  const [catalogAiAllowed, setCatalogAiAllowed] = useState(true)
  const [planAiLoading, setPlanAiLoading] = useState(false)

  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobPolling, setJobPolling] = useState(false)
  const [jobProgress, setJobProgress] = useState(0)
  const [jobStep, setJobStep] = useState<string | null>(null)
  const [jobError, setJobError] = useState<string | null>(null)
  const [importCancelled, setImportCancelled] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queuedPollCountRef = useRef(0)
  const pollNetworkFailuresRef = useRef(0)
  const pendingJobKindRef = useRef<"upload" | "reextract">("upload")
  /** Avoid duplicate toast when cancel dialog already showed success. */
  const suppressCancelPollToastRef = useRef(false)
  const [debugEntries, setDebugEntries] = useState<CatalogImportDebugEntry[]>([])
  const [flowStage, setFlowStage] = useState<string>("idle")

  const logDebug = useCallback((stage: string, detail?: Record<string, unknown>) => {
    setFlowStage(stage)
    setDebugEntries((prev) => pushCatalogImportDebug(prev, stage, detail))
  }, [])

  useEffect(() => {
    if (status !== "ready" || !organizationId) return
    let cancelled = false
    setPlanAiLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/ai-usage`, {
          cache: "no-store",
        })
        const data = (await res.json()) as {
          planAi?: { catalogExtractionAllowed?: boolean }
        }
        if (cancelled || !res.ok) return
        const allowed = data.planAi == null ? true : Boolean(data.planAi.catalogExtractionAllowed)
        setCatalogAiAllowed(allowed)
      } catch {
        if (!cancelled) setCatalogAiAllowed(true)
      } finally {
        if (!cancelled) setPlanAiLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, organizationId])

  /** Resume polling / draft after refresh using URL params or sessionStorage + active job from API. */
  useEffect(() => {
    if (status !== "ready" || !organizationId) return

    let cancelled = false
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "")
    const qImp = params.get("importId")
    const qJob = params.get("jobId")
    const sImp = typeof window !== "undefined" ? sessionStorage.getItem(SS_IMPORT) : null
    const sJob = typeof window !== "undefined" ? sessionStorage.getItem(SS_JOB) : null

    const imp = qImp ?? sImp
    const job = qJob ?? sJob

    if (!imp) return

    setImportId(imp)
    try {
      sessionStorage.setItem(SS_IMPORT, imp)
    } catch {
      /* ignore quota */
    }

    if (job) {
      try {
        sessionStorage.setItem(SS_JOB, job)
      } catch {
        /* ignore */
      }
      setActiveJobId(job)
      setJobPolling(true)
      setJobError(null)
      return
    }

    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(imp)}`,
          { cache: "no-store" },
        )
        const data = (await res.json()) as {
          activeJobId?: string | null
          import?: { status?: string; error_message?: string | null }
          payload?: StoredPriceListPayload | null
        }
        if (cancelled || !res.ok) return

        logDebug("resume_import_fetch", {
          importStatus: data.import?.status ?? null,
          activeJobId: data.activeJobId ?? null,
          payloadRowCount: data.payload?.rows?.length ?? 0,
        })

        if (data.activeJobId) {
          try {
            sessionStorage.setItem(SS_JOB, data.activeJobId)
          } catch {
            /* ignore */
          }
          setActiveJobId(data.activeJobId)
          setJobPolling(true)
          setJobError(null)
          return
        }

        if (data.import?.status === "cancelled") {
          setImportCancelled(true)
          setPayload(null)
          setJobError(null)
          return
        }

        if (data.import?.status === "failed") {
          const msg = data.import.error_message?.trim() || "Extraction failed."
          setJobError(msg)
          setFlowStage("resume_failed")
          return
        }

        if (data.import?.status === "processing" && !data.activeJobId) {
          const msg = "Extraction did not finish. Click Re-run extraction or upload again."
          setJobError(msg)
          setFlowStage("resume_stuck_processing")
          return
        }

        if (data.import?.status === "needs_review" && data.payload?.rows?.length) {
          setPayload(data.payload)
          setFlowStage("resume_payload")
          return
        }

        if (data.payload?.rows?.length) {
          setPayload(data.payload)
          setFlowStage("resume_payload")
        }
      } catch {
        if (!cancelled) {
          setJobError("Could not restore this import. Try uploading again.")
          setFlowStage("resume_error")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status, organizationId, logDebug])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setJobPolling(false)
    setActiveJobId(null)
    try {
      sessionStorage.removeItem(SS_JOB)
    } catch {
      /* ignore */
    }
  }, [])

  async function confirmCancelImport() {
    if (!organizationId || !importId) return
    setCancelBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}/cancel`,
        { method: "POST" },
      )
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not cancel",
          description: data.message ?? data.error ?? `Request failed (${res.status})`,
        })
        return
      }
      suppressCancelPollToastRef.current = true
      stopPolling()
      setPayload(null)
      setImportCancelled(true)
      setJobError(null)
      setCancelDialogOpen(false)
      toast({
        title: "Import cancelled",
        description: "You can upload a new price list, re-run extraction, or return to the catalog.",
      })
    } catch {
      toast({ variant: "destructive", title: "Network error", description: "Try again." })
    } finally {
      setCancelBusy(false)
    }
  }

  const loadImportPayload = useCallback(async (): Promise<
    { ok: true; rowCount: number } | { ok: false; message: string }
  > => {
    if (!organizationId || !importId) return { ok: false, message: "Import not ready." }
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}`,
        { cache: "no-store" },
      )
      const data = (await res.json()) as {
        payload?: StoredPriceListPayload | null
        import?: { status?: string; error_message?: string | null }
        message?: string
        error?: string
      }
      logDebug("load_import_payload", {
        httpStatus: res.status,
        importStatus: data.import?.status ?? null,
        payloadRowCount: data.payload?.rows?.length ?? 0,
      })
      if (!res.ok) {
        return {
          ok: false,
          message: data.message ?? data.error ?? "Could not load import results.",
        }
      }
      if (data.import?.status === "failed") {
        return {
          ok: false,
          message: data.import.error_message?.trim() || "Extraction failed.",
        }
      }
      if (!data.payload) {
        return { ok: false, message: "No extracted rows are available yet." }
      }
      setPayload(data.payload)
      return { ok: true, rowCount: data.payload.rows.length }
    } catch {
      return { ok: false, message: "Could not load import results. Check your connection." }
    }
  }, [organizationId, importId, logDebug])

  const applyExtractionResult = useCallback(
    async (kind: "upload" | "reextract") => {
      const loaded = await loadImportPayload()
      if (loaded.ok && loaded.rowCount > 0) {
        setJobError(null)
        toast({
          title: kind === "reextract" ? "Re-extracted" : "Extracted",
          description: "Review rows below before saving.",
        })
        logDebug("extraction_success", { rowCount: loaded.rowCount, kind })
        return
      }
      if (loaded.ok && loaded.rowCount === 0) {
        const msg =
          "No catalog rows were extracted. Check column headers (e.g. Invoice Item Name, Item #/SKU, Unit Price) and try again."
        setJobError(msg)
        toast({ variant: "destructive", title: "No rows extracted", description: msg })
        logDebug("extraction_zero_rows", { kind })
        return
      }
      const msg = loaded.message
      setJobError(msg)
      toast({
        variant: "destructive",
        title: "Could not load results",
        description: msg,
      })
      logDebug("extraction_load_failed", { kind, message: msg })
    },
    [loadImportPayload, logDebug, toast],
  )

  useEffect(() => {
    if (!organizationId || !importId || !activeJobId || !jobPolling) return

    queuedPollCountRef.current = 0
    pollNetworkFailuresRef.current = 0
    logDebug("poll_started", { importId, activeJobId })

    async function pollOnce() {
      if (!organizationId || !activeJobId) return
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/ai-jobs/${encodeURIComponent(activeJobId)}`,
          { cache: "no-store" },
        )
        const data = (await res.json()) as {
          job?: {
            status: string
            progress_percent?: number
            current_step?: string | null
            error_message?: string | null
          }
          error?: string
          message?: string
        }

        logDebug("poll_tick", {
          httpStatus: res.status,
          jobStatus: data.job?.status ?? null,
          progress: data.job?.progress_percent ?? null,
          step: data.job?.current_step ?? null,
        })

        if (data.job?.status === "queued") {
          queuedPollCountRef.current += 1
        } else {
          queuedPollCountRef.current = 0
        }

        const action = decideImportPollAction({
          httpOk: res.ok,
          hasJob: Boolean(data.job),
          job: data.job
            ? {
                status: data.job.status,
                progressPercent: data.job.progress_percent,
                currentStep: data.job.current_step,
                errorMessage: data.job.error_message,
              }
            : null,
          queuedPollCount: queuedPollCountRef.current,
          httpMessage: data.message ?? data.error,
        })

        if (action.type === "update_progress") {
          pollNetworkFailuresRef.current = 0
          setJobProgress(action.progressPercent)
          setJobStep(action.currentStep)
          return
        }

        stopPolling()
        pollNetworkFailuresRef.current = 0

        if (action.reason === "completed") {
          logDebug("poll_completed", { importId, activeJobId })
          await applyExtractionResult(pendingJobKindRef.current)
          return
        }

        if (action.reason === "cancelled") {
          setImportCancelled(true)
          setPayload(null)
          setJobError(null)
          logDebug("poll_cancelled", { importId, activeJobId })
          if (suppressCancelPollToastRef.current) {
            suppressCancelPollToastRef.current = false
          } else {
            toast({
              title: "Import cancelled",
              description: "You can upload a new price list or return to the catalog.",
            })
          }
          return
        }

        const detail =
          action.reason === "failed"
            ? data.job?.error_message ?? undefined
            : data.message ?? data.error
        const msg = friendlyImportPollStopMessage(action.reason, detail)
        setJobError(msg)
        toast({
          variant: "destructive",
          title:
            action.reason === "failed"
              ? "Extraction failed"
              : action.reason === "stuck_queued"
                ? "Extraction did not start"
                : "Extraction unavailable",
          description: msg,
        })
        logDebug("poll_stopped", { reason: action.reason, message: msg })
      } catch {
        pollNetworkFailuresRef.current += 1
        logDebug("poll_network_error", { failures: pollNetworkFailuresRef.current })
        if (pollNetworkFailuresRef.current >= 3) {
          stopPolling()
          const msg = "Lost connection while checking extraction status. Refresh or try Re-run extraction."
          setJobError(msg)
          toast({ variant: "destructive", title: "Connection problem", description: msg })
        }
      }
    }

    void pollOnce()
    pollRef.current = setInterval(() => void pollOnce(), 2500)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [organizationId, importId, activeJobId, jobPolling, applyExtractionResult, stopPolling, toast, logDebug])

  const updateRow = useCallback((id: string, patch: Partial<ExtractedCatalogRow>) => {
    setPayload((p) => {
      if (!p) return p
      return {
        ...p,
        rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }
    })
  }, [])

  const removeRow = useCallback((id: string) => {
    setPayload((p) => {
      if (!p) return p
      return { ...p, rows: p.rows.filter((r) => r.id !== id) }
    })
  }, [])

  const selectedRows = useMemo(() => (payload?.rows ?? []).filter((r) => r.selected), [payload])

  async function handleUploadAndExtract() {
    if (!organizationId || !file) {
      toast({
        variant: "destructive",
        title: "Choose a file",
        description: "Select a PDF or CSV price list first.",
      })
      return
    }

    const validation = validatePriceListFile(file.name, file.type, file.size)
    if (!validation.ok) {
      setFileError(validation.message)
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: validation.message,
      })
      return
    }
    pendingJobKindRef.current = "upload"
    stopPolling()
    setImportCancelled(false)
    setJobError(null)
    setPayload(null)
    setJobProgress(0)
    setJobStep(null)
    setUploadBusy(true)
    logDebug("upload_started", {
      fileName: file.name,
      fileType: file.type || null,
      fileSize: file.size,
    })
    try {
      const fd = new FormData()
      fd.set("file", file)
      if (manufacturerName.trim()) fd.set("manufacturerName", manufacturerName.trim())

      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports`, {
        method: "POST",
        body: fd,
      })
      let data: Record<string, unknown> = {}
      try {
        data = (await res.json()) as Record<string, unknown>
      } catch {
        data = {}
      }

      logDebug("upload_response", {
        httpStatus: res.status,
        body: data,
      })

      const normalized = normalizeUploadPriceListResponse(data)

      if (!res.ok || normalized.failed) {
        const msg = normalized.message ?? `Upload failed (${res.status}).`
        setJobError(msg)
        toast({
          variant: "destructive",
          title: "Upload / extraction failed",
          description: msg,
        })
        logDebug("upload_failed", { message: msg })
        return
      }

      const newImportId = normalized.importId
      const jobId = normalized.jobId
      setImportId(newImportId)
      if (!newImportId || !jobId) {
        const msg = normalized.message ?? "Missing import or job id. Try again."
        setJobError(msg)
        toast({
          variant: "destructive",
          title: "Unexpected response",
          description: msg,
        })
        logDebug("upload_missing_ids", { newImportId, jobId })
        return
      }

      try {
        sessionStorage.setItem(SS_IMPORT, newImportId)
        sessionStorage.setItem(SS_JOB, jobId)
      } catch {
        /* ignore */
      }

      if (normalized.extractionReady) {
        setActiveJobId(jobId)
        logDebug("upload_inline_complete", {
          importId: newImportId,
          jobId,
          rowCount: normalized.rowCount,
        })
        await applyExtractionResult("upload")
        return
      }

      setActiveJobId(jobId)
      setJobPolling(true)
      logDebug("upload_queued_poll", { importId: newImportId, jobId })
    } catch {
      const msg = "Network error while uploading. Try again."
      setJobError(msg)
      toast({ variant: "destructive", title: "Network error", description: msg })
      logDebug("upload_network_error", {})
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleReExtract() {
    if (!organizationId || !importId) return
    pendingJobKindRef.current = "reextract"
    stopPolling()
    setImportCancelled(false)
    setJobError(null)
    setJobProgress(0)
    setJobStep(null)
    setExtractBusy(true)
    logDebug("reextract_started", { importId })
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}/extract`,
        { method: "POST" },
      )
      let data: Record<string, unknown> = {}
      try {
        data = (await res.json()) as Record<string, unknown>
      } catch {
        data = {}
      }
      logDebug("reextract_response", { httpStatus: res.status, body: data })

      const normalized = normalizeUploadPriceListResponse({ ...data, importId })

      if (!res.ok || normalized.failed) {
        const msg = normalized.message ?? `Re-extract failed (${res.status}).`
        setJobError(msg)
        toast({
          variant: "destructive",
          title: "Re-extract failed",
          description: msg,
        })
        return
      }

      const jobId = normalized.jobId
      if (!jobId) {
        const msg = normalized.message ?? "Missing job id."
        setJobError(msg)
        toast({ variant: "destructive", title: "Unexpected response", description: msg })
        return
      }

      try {
        sessionStorage.setItem(SS_IMPORT, importId)
        sessionStorage.setItem(SS_JOB, jobId)
      } catch {
        /* ignore */
      }

      if (data.resumed === true) {
        toast({
          title: "Extraction in progress",
          description: "Already running for this import — reconnecting to progress.",
        })
      }

      if (normalized.extractionReady) {
        setActiveJobId(jobId)
        await applyExtractionResult("reextract")
        return
      }

      setActiveJobId(jobId)
      setJobPolling(true)
    } catch {
      const msg = "Network error while re-running extraction."
      setJobError(msg)
      toast({ variant: "destructive", title: "Network error", description: msg })
    } finally {
      setExtractBusy(false)
    }
  }

  async function handleApplyEdits() {
    if (!organizationId || !importId || !payload) return
    setPatchBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        },
      )
      const data = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not save edits",
          description: data.message ?? `Failed (${res.status})`,
        })
        return
      }
      toast({ title: "Draft saved", description: "Edits stored on this import." })
    } catch {
      toast({ variant: "destructive", title: "Network error" })
    } finally {
      setPatchBusy(false)
    }
  }

  async function runDuplicatePreviewThenCommit() {
    if (!organizationId || !importId || !payload || selectedRows.length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing selected",
        description: "Select at least one row to save.",
      })
      return
    }

    setSaveBusy(true)
    try {
      const previewRes = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}/duplicate-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowIds: selectedRows.map((r) => r.id) }),
        },
      )
      const previewJson = (await previewRes.json()) as {
        conflicts?: { rowId: string; existingCatalogItemId: string }[]
      }

      if (!previewRes.ok) {
        toast({
          variant: "destructive",
          title: "Duplicate check failed",
          description: "Could not verify duplicates.",
        })
        return
      }

      const conflicts = previewJson.conflicts ?? []
      if (conflicts.length > 0) {
        const init: Record<string, DuplicateAction> = {}
        conflicts.forEach((c) => {
          init[c.rowId] = "skip"
        })
        setDupChoices(init)
        setDupConflicts(conflicts)
        setDupOpen(true)
        return
      }

      await commitRows(
        selectedRows.map((r) => ({
          rowId: r.id,
          duplicateAction: "create" as const,
        })),
      )
    } finally {
      setSaveBusy(false)
    }
  }

  async function commitRows(commits: { rowId: string; duplicateAction: DuplicateAction; existingCatalogItemId?: string }[]) {
    if (!organizationId || !importId) return
    setSaveBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commits }),
        },
      )
      const data = (await res.json()) as {
        ok?: boolean
        saved?: number
        skipped?: number
        errors?: string[]
      }

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: data.errors?.[0] ?? `HTTP ${res.status}`,
        })
        return
      }

      toast({
        title: data.ok ? "Catalog updated" : "Partial save",
        description: `Saved ${data.saved ?? 0}, skipped ${data.skipped ?? 0}.`,
      })

      if (data.errors?.length) {
        toast({
          variant: "destructive",
          title: "Some rows failed",
          description: data.errors.slice(0, 3).join(" · "),
        })
      }

      setDupOpen(false)
      if ((data.saved ?? 0) > 0) router.push("/catalog")
    } catch {
      toast({ variant: "destructive", title: "Network error" })
    } finally {
      setSaveBusy(false)
    }
  }

  function confirmDuplicatesAndCommit() {
    if (!payload) return

    const commits = selectedRows.map((r) => {
      const conflict = dupConflicts.find((c) => c.rowId === r.id)
      if (!conflict) {
        return { rowId: r.id, duplicateAction: "create" as const }
      }
      const action = dupChoices[conflict.rowId] ?? "skip"
      return {
        rowId: r.id,
        duplicateAction: action,
        existingCatalogItemId: action === "update" ? conflict.existingCatalogItemId : undefined,
      }
    })

    void commitRows(commits)
  }

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    )
  }

  if (!organizationId) {
    return <p className="text-sm text-muted-foreground py-10">Select an organization.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
          <Link href="/catalog" aria-label="Back to catalog">
            <ArrowLeft className="h-4 w-4" />
            Catalog
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 flex gap-3 text-sm text-foreground">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-medium">Review before saving</p>
          <p className="text-muted-foreground mt-0.5">
            AI extraction can make mistakes—especially with dense manufacturer tables. Do not save until you have verified part numbers and prices.
          </p>
        </div>
      </div>

      {!catalogAiAllowed ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground max-w-xl">
          AI catalog import is available on Growth and Scale plans.{" "}
          <Link href="/settings/billing" className="text-primary underline-offset-4 hover:underline">
            Billing &amp; plans
          </Link>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4 max-w-xl">
        <div>
          <Label htmlFor="mfg">Manufacturer (optional hint)</Label>
          <Input
            id="mfg"
            value={manufacturerName}
            onChange={(e) => setManufacturerName(e.target.value)}
            placeholder="e.g. AMBCO"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="price-list-file">Price list file</Label>
          <Input
            id="price-list-file"
            type="file"
            accept="application/pdf,.pdf,text/csv,application/csv,.csv,text/plain,application/octet-stream"
            className="mt-1"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null
              setFile(next)
              if (!next) {
                setFileError(null)
                return
              }
              const validation = validatePriceListFile(next.name, next.type, next.size)
              if (!validation.ok) {
                setFileError(validation.message)
                setFile(null)
                return
              }
              setFileError(null)
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">Upload a PDF or CSV price list.</p>
          {fileError ? <p className="text-xs text-destructive mt-1">{fileError}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="gap-2"
            disabled={uploadBusy || !file || !catalogAiAllowed || planAiLoading || jobPolling}
            onClick={() => void handleUploadAndExtract()}
          >
            {uploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload price list &amp; extract
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={extractBusy || !importId || !catalogAiAllowed || planAiLoading || jobPolling}
            onClick={() => void handleReExtract()}
          >
            {extractBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-run extraction
          </Button>
        </div>
      </div>

      {jobPolling ? (
        <div className="rounded-lg border border-border bg-card p-4 max-w-xl space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground min-w-0">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              Extracting price list…
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setCancelDialogOpen(true)}
            >
              Cancel import
            </Button>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary/80 rounded-full transition-[width] duration-300"
              style={{ width: `${Math.min(100, Math.max(0, jobProgress))}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {jobStep ?? "Queued…"}
            {jobProgress > 0 ? ` · ${jobProgress}%` : ""}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Extraction is running in the background. You can leave this page and return later — progress is saved; we reconnect
            automatically when you come back.
          </p>
        </div>
      ) : null}

      {importCancelled && !jobPolling ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 max-w-xl space-y-2">
          <p className="text-sm font-medium text-foreground">Import cancelled</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Extraction was stopped and unsaved extracted rows were discarded. Upload a new price list file, re-run extraction on the stored file,
            or return to the catalog.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setImportCancelled(false)
                setImportId(null)
                setPayload(null)
                setFile(null)
                setFileError(null)
                try {
                  sessionStorage.removeItem(SS_IMPORT)
                  sessionStorage.removeItem(SS_JOB)
                } catch {
                  /* ignore */
                }
              }}
            >
              Clear and upload new file
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/catalog">Back to catalog</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {jobError && !jobPolling && !importCancelled ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive max-w-xl">
          {jobError}
        </div>
      ) : null}

      {isCatalogImportPageDebugEnabled() ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 max-w-xl text-[11px] font-mono text-muted-foreground space-y-1">
          <p className="font-sans text-xs font-medium text-foreground">Import debug (dev only)</p>
          <p>flow: {flowStage}</p>
          <p>importId: {importId ?? "—"} · jobId: {activeJobId ?? "—"} · polling: {jobPolling ? "yes" : "no"}</p>
          {file ? (
            <p>
              file: {file.name} · {file.type || "unknown"} · {file.size} bytes
            </p>
          ) : null}
          <ul className="max-h-40 overflow-y-auto space-y-0.5">
            {debugEntries.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                {e.at.slice(11, 19)} {e.stage}
                {e.detail ? ` ${JSON.stringify(e.detail)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel price list import?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the current extraction and discard any unsaved extracted rows. You can start a new import afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelBusy}>Keep importing</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelBusy}
              onClick={(e) => {
                e.preventDefault()
                void confirmCancelImport()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cancel import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {payload?.warnings?.length ? (
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
          {payload.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}

      {payload && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              Extracted rows ({payload.rows.length}) · manufacturer: {payload.manufacturerName ?? "—"} · effective:{" "}
              {payload.effectiveDate ?? "—"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={patchBusy} onClick={() => void handleApplyEdits()}>
                {patchBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save edits to draft
              </Button>
              <Button type="button" size="sm" disabled={saveBusy} onClick={() => void runDuplicatePreviewThenCommit()}>
                {saveBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save selected items
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/catalog">Cancel</Link>
              </Button>
            </div>
          </div>

          <div className="ds-table-surface">
            <Table>
              <TableHeader>
                <TableRow className="ds-table-header-row-subtle">
                  <TableHead className="w-10" />
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Part #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>List</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Conf.</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="align-top pt-3">
                      <Checkbox
                        checked={r.selected}
                        onCheckedChange={(v) => updateRow(r.id, { selected: v === true })}
                        aria-label={`Select ${r.name}`}
                      />
                    </TableCell>
                    <TableCell className="align-top min-w-[120px]">
                      <Input value={r.category} onChange={(e) => updateRow(r.id, { category: e.target.value })} className="h-8 text-xs" />
                    </TableCell>
                    <TableCell className="align-top min-w-[110px]">
                      <Select
                        value={r.itemType}
                        onValueChange={(v) =>
                          updateRow(r.id, { itemType: v as ExtractedCatalogRow["itemType"] })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATALOG_ITEM_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top min-w-[100px]">
                      <Input
                        value={r.partNumber}
                        onChange={(e) => updateRow(r.id, { partNumber: e.target.value })}
                        className="h-8 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell className="align-top min-w-[180px]">
                      <Input value={r.name} onChange={(e) => updateRow(r.id, { name: e.target.value })} className="h-8 text-xs" />
                    </TableCell>
                    <TableCell className="align-top w-[88px]">
                      <Input
                        inputMode="decimal"
                        value={r.listPrice ?? ""}
                        onChange={(e) => {
                          const t = e.target.value.trim()
                          if (t === "") {
                            updateRow(r.id, { listPrice: null })
                            return
                          }
                          const n = Number.parseFloat(t.replace(/,/g, ""))
                          updateRow(r.id, { listPrice: Number.isFinite(n) ? n : null })
                        }}
                        className="h-8 text-xs tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="align-top w-[88px]">
                      <Input
                        inputMode="decimal"
                        value={r.cost ?? ""}
                        onChange={(e) => {
                          const t = e.target.value.trim()
                          if (t === "") {
                            updateRow(r.id, { cost: null })
                            return
                          }
                          const n = Number.parseFloat(t.replace(/,/g, ""))
                          updateRow(r.id, { cost: Number.isFinite(n) ? n : null })
                        }}
                        className="h-8 text-xs tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="align-top min-w-[110px]">
                      <Select
                        value={r.status}
                        onValueChange={(v) =>
                          updateRow(r.id, { status: v as ExtractedCatalogRow["status"] })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">active</SelectItem>
                          <SelectItem value="inactive">inactive</SelectItem>
                          <SelectItem value="discontinued">discontinued</SelectItem>
                          <SelectItem value="needs_review">needs_review</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top min-w-[140px]">
                      <Input
                        value={r.notes ?? ""}
                        onChange={(e) => updateRow(r.id, { notes: e.target.value || null })}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground tabular-nums">
                      {r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "—"}
                    </TableCell>
                    <TableCell className="align-top">
                      <Button type="button" variant="ghost" size="sm" className="text-destructive h-8 px-2" onClick={() => removeRow(r.id)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Possible duplicates</DialogTitle>
            <DialogDescription>
              Some selected rows match existing catalog items by part number / name and manufacturer. Choose how to handle each.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1">
            {dupConflicts.map((c) => {
              const row = payload?.rows.find((r) => r.id === c.rowId)
              const choice = dupChoices[c.rowId] ?? "skip"
              return (
                <div key={c.rowId} className="rounded-md border border-border p-3 space-y-2">
                  <p className="text-xs font-medium line-clamp-2">{row?.name ?? c.rowId}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">Existing ID: {c.existingCatalogItemId}</p>
                  <Select
                    value={choice}
                    onValueChange={(v) =>
                      setDupChoices((prev) => ({ ...prev, [c.rowId]: v as DuplicateAction }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip (do not import)</SelectItem>
                      <SelectItem value="update">Update existing catalog row</SelectItem>
                      <SelectItem value="create">Create new anyway</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDupOpen(false)}>
              Back
            </Button>
            <Button type="button" onClick={() => confirmDuplicatesAndCommit()} disabled={saveBusy}>
              {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm &amp; save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
