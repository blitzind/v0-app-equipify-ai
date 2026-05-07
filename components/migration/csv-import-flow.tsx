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

export function CsvImportFlow({
  kind,
  title,
  description,
  backHref,
}: {
  kind: "customer" | "equipment" | "invoice" | "work_order"
  title: string
  description: string
  backHref: string
}) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { toast } = useToast()

  const [file, setFile] = useState<File | null>(null)
  const [sourceSystem, setSourceSystem] = useState("")
  const [busy, setBusy] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [importRef, setImportRef] = useState<string | null>(null)
  const [columnMappingText, setColumnMappingText] = useState("{}")
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewMeta, setPreviewMeta] = useState<{ rowCount: number; truncated: boolean } | null>(null)
  const [commitResult, setCommitResult] = useState<CommitJson | null>(null)
  const [strategy, setStrategy] = useState<MigrationImportStrategy>("skip_duplicates")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [asyncMode, setAsyncMode] = useState(false)
  const [asyncRun, setAsyncRun] = useState<AsyncRun | null>(null)
  const [asyncBusy, setAsyncBusy] = useState(false)

  const runUpload = useCallback(async () => {
    if (!organizationId || !file) return
    setBusy(true)
    setCommitResult(null)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("kind", kind)
      if (sourceSystem.trim()) form.append("sourceSystem", sourceSystem.trim())

      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports`, {
        method: "POST",
        body: form,
      })
      const json = (await res.json()) as {
        jobId?: string
        columnMapping?: Record<string, string>
        preview?: PreviewResult
        rowCount?: number
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
      setColumnMappingText(JSON.stringify(json.columnMapping ?? {}, null, 2))
      setImportRef(null)
      setAsyncRun(null)
      toast({ title: "Preview ready", description: "Review validation and outcome estimates, then adjust mapping if needed." })
    } catch {
      toast({ title: "Upload failed", description: "Network error.", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }, [organizationId, file, kind, sourceSystem, toast])

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
          body: JSON.stringify({ columnMapping: mapping, options: { strategy } }),
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
  }, [organizationId, jobId, columnMappingText, strategy, toast])

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
            options: { strategy },
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
  }, [organizationId, jobId, columnMappingText, strategy, toast])

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
            options: { strategy },
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
    [organizationId, jobId, columnMappingText, strategy, toast],
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
          <Label htmlFor="csv-file">CSV file</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">UTF-8 CSV with a header row. Maximum 5,000 rows per batch.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="source-system">Legacy system (optional)</Label>
          <Input
            id="source-system"
            placeholder="e.g. FieldPulse, Jobber, spreadsheet export"
            value={sourceSystem}
            onChange={(e) => setSourceSystem(e.target.value)}
          />
        </div>
        <Button type="button" onClick={() => void runUpload()} disabled={!file || busy} className="gap-2">
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
                <Stat label="Ready to create" value={String(proj.willCreate)} tone="positive" />
                <Stat label="Will update" value={String(proj.willUpdate)} tone="amber" />
                <Stat label="Will skip" value={String(proj.willSkip)} />
                <Stat label="Will fail" value={String(proj.willFail)} tone="destructive" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Estimates use your mapping and existing workspace data. Refresh preview after changing strategy or mapping.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Refresh preview to compute outcome estimates for the selected strategy.</p>
          )}

          {(preview.duplicateHints.length > 0 || preview.unresolvedRefs.length > 0) && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm space-y-2">
              {preview.duplicateHints.length > 0 ? (
                <p className="text-amber-800 dark:text-amber-200">
                  <span className="font-medium">Possible duplicates in file:</span> {preview.duplicateHints.length} row
                  {preview.duplicateHints.length === 1 ? "" : "s"} flagged — review before commit.
                </p>
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
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={busy || !jobId || asyncMode}
              className="gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Commit import…
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void startAsyncRun()}
              disabled={busy || asyncBusy || !jobId || asyncMode}
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
