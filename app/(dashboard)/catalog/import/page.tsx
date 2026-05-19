"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, Upload } from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import type { DuplicateAction, ExtractedCatalogRow, StoredPriceListPayload } from "@/lib/catalog/import-types"
import { CATALOG_ITEM_TYPES } from "@/lib/catalog/import-types"
import { isAllowedPriceListFile, validatePriceListFile } from "@/lib/catalog/price-list-file-validation"
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
  const pendingJobKindRef = useRef<"upload" | "reextract">("upload")
  /** Avoid duplicate toast when cancel dialog already showed success. */
  const suppressCancelPollToastRef = useRef(false)

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
          setJobError(data.import.error_message?.trim() || "Extraction failed.")
          return
        }

        if (data.payload?.rows?.length) {
          setPayload(data.payload)
        }
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status, organizationId])

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

  const loadImportPayload = useCallback(async (): Promise<{ ok: true; rowCount: number } | { ok: false }> => {
    if (!organizationId || !importId) return { ok: false }
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}`,
        { cache: "no-store" },
      )
      const data = (await res.json()) as { payload?: StoredPriceListPayload | null; error?: string }
      if (!res.ok || !data.payload) {
        return { ok: false }
      }
      setPayload(data.payload)
      return { ok: true, rowCount: data.payload.rows.length }
    } catch {
      return { ok: false }
    }
  }, [organizationId, importId])

  useEffect(() => {
    if (!organizationId || !importId || !activeJobId || !jobPolling) return

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
        if (!res.ok) {
          stopPolling()
          const msg =
            typeof data.message === "string" && data.message.trim()
              ? data.message.trim()
              : "Could not check extraction status. Refresh the page or try again."
          setJobError(msg)
          toast({ variant: "destructive", title: "Extraction status unavailable", description: msg })
          return
        }
        if (!data.job) {
          stopPolling()
          const msg = "Extraction job was not found. Try uploading again."
          setJobError(msg)
          toast({ variant: "destructive", title: "Extraction unavailable", description: msg })
          return
        }

        const st = data.job.status
        const pct =
          typeof data.job.progress_percent === "number"
            ? data.job.progress_percent
            : Number(data.job.progress_percent ?? 0)
        setJobProgress(Number.isFinite(pct) ? pct : 0)
        setJobStep(typeof data.job.current_step === "string" ? data.job.current_step : null)

        if (st === "completed") {
          stopPolling()
          const loaded = await loadImportPayload()
          if (loaded.ok && loaded.rowCount > 0) {
            const kind = pendingJobKindRef.current
            toast({
              title: kind === "reextract" ? "Re-extracted" : "Extracted",
              description: "Review rows below before saving.",
            })
          } else if (loaded.ok && loaded.rowCount === 0) {
            const msg =
              "No catalog rows were extracted. Check column headers (e.g. Invoice Item Name, Item #/SKU, Unit Price) and try again."
            setJobError(msg)
            toast({ variant: "destructive", title: "No rows extracted", description: msg })
          } else {
            toast({
              variant: "destructive",
              title: "Could not load results",
              description: "Job finished but the import payload could not be loaded. Refresh the page.",
            })
          }
          return
        }

        if (st === "cancelled") {
          stopPolling()
          setImportCancelled(true)
          setPayload(null)
          setJobError(null)
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

        if (st === "failed") {
          stopPolling()
          const msg =
            typeof data.job.error_message === "string" && data.job.error_message.trim()
              ? data.job.error_message.trim()
              : "Extraction failed."
          setJobError(msg)
          toast({
            variant: "destructive",
            title: "Extraction failed",
            description: msg,
          })
        }
      } catch {
        /* keep polling */
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
  }, [organizationId, importId, activeJobId, jobPolling, loadImportPayload, stopPolling, toast])

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
    try {
      const fd = new FormData()
      fd.set("file", file)
      if (manufacturerName.trim()) fd.set("manufacturerName", manufacturerName.trim())

      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports`, {
        method: "POST",
        body: fd,
      })
      const data = (await res.json()) as {
        ok?: boolean
        importId?: string
        jobId?: string
        message?: string
        error?: string
      }

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Upload / extraction failed",
          description: data.message ?? data.error ?? `Request failed (${res.status})`,
        })
        return
      }

      if (data.ok === false) {
        toast({
          variant: "destructive",
          title: "Upload / extraction failed",
          description: data.message ?? data.error ?? "Could not start extraction.",
        })
        return
      }

      const newImportId = data.importId ?? null
      const jobId = data.jobId ?? null
      setImportId(newImportId)
      if (newImportId && jobId) {
        try {
          sessionStorage.setItem(SS_IMPORT, newImportId)
          sessionStorage.setItem(SS_JOB, jobId)
        } catch {
          /* ignore */
        }
        setActiveJobId(jobId)
        setJobPolling(true)
      } else {
        toast({
          variant: "destructive",
          title: "Unexpected response",
          description: "Missing job id. Try again.",
        })
      }
    } catch {
      toast({ variant: "destructive", title: "Network error", description: "Try again." })
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
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}/extract`,
        { method: "POST" },
      )
      const data = (await res.json()) as {
        ok?: boolean
        jobId?: string
        resumed?: boolean
        message?: string
        error?: string
      }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Re-extract failed",
          description: data.message ?? data.error ?? `Failed (${res.status})`,
        })
        return
      }
      const jobId = data.jobId ?? null
      if (jobId && importId) {
        try {
          sessionStorage.setItem(SS_IMPORT, importId)
          sessionStorage.setItem(SS_JOB, jobId)
        } catch {
          /* ignore */
        }
        setActiveJobId(jobId)
        setJobPolling(true)
        if (data.resumed) {
          toast({
            title: "Extraction in progress",
            description: "Already running for this import — reconnecting to progress.",
          })
        }
      } else {
        toast({
          variant: "destructive",
          title: "Unexpected response",
          description: "Missing job id.",
        })
      }
    } catch {
      toast({ variant: "destructive", title: "Network error" })
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
              if (!isAllowedPriceListFile(next.name, next.type)) {
                setFileError("Upload a PDF or CSV price list.")
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
