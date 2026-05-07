"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Upload } from "lucide-react"
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
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { PreviewResult } from "@/lib/migration-imports/public-types"

type CommitJson = {
  ok?: boolean
  successCount?: number
  errorCount?: number
  skippedCount?: number
  importRef?: string
  message?: string
  outcomes?: { rowIndex: number; status: string; message: string | null; codes: string[]; ref?: string }[]
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
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip_duplicates" | "fail_on_duplicate">(
    "skip_duplicates",
  )

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
      toast({ title: "Preview ready", description: "Review validation, then adjust column mapping if needed." })
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
          body: JSON.stringify({ columnMapping: mapping }),
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
  }, [organizationId, jobId, columnMappingText, toast])

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
            options: { duplicateStrategy },
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
        description: `${json.successCount ?? 0} rows imported`,
      })
    } catch {
      toast({ title: "Import failed", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }, [organizationId, jobId, columnMappingText, duplicateStrategy, toast])

  if (orgStatus !== "ready" || !organizationId) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace…
      </div>
    )
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Rows" value={String(previewMeta?.rowCount ?? preview.rowCount)} />
            <Stat label="OK" value={String(preview.summary.okRows)} />
            <Stat label="Warnings" value={String(preview.summary.warningRows)} tone="amber" />
            <Stat label="Errors" value={String(preview.summary.errorRows)} tone="destructive" />
          </div>

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

          <div className="grid gap-2 max-w-xs">
            <Label>Duplicates</Label>
            <Select
              value={duplicateStrategy}
              onValueChange={(v) => setDuplicateStrategy(v as "skip_duplicates" | "fail_on_duplicate")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip_duplicates">Skip duplicate rows</SelectItem>
                <SelectItem value="fail_on_duplicate">Fail entire batch on first duplicate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="button" onClick={() => void runCommit()} disabled={busy || !jobId} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Commit import
          </Button>
        </div>
      ) : null}

      {commitResult ? (
        <div className="rounded-lg border border-border bg-muted/20 p-5 space-y-2">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Result
            {importRef ? (
              <span className="text-sm font-mono text-primary ml-2">#{importRef}</span>
            ) : null}
          </h3>
          <p className="text-sm text-muted-foreground">
            Imported {commitResult.successCount ?? 0} · Skipped {commitResult.skippedCount ?? 0} · Errors{" "}
            {commitResult.errorCount ?? 0}
          </p>
          {commitResult.outcomes && commitResult.outcomes.length > 0 ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-primary font-medium">Row details</summary>
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
                {commitResult.outcomes.slice(0, 80).map((o) => (
                  <li key={o.rowIndex}>
                    Row {o.rowIndex}: {o.status}
                    {o.ref ? ` · ${o.ref}` : ""}
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
  tone?: "amber" | "destructive"
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border px-3 py-2",
        tone === "amber" && "border-amber-500/30 bg-amber-500/5",
        tone === "destructive" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
