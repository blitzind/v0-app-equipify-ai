"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Play, Save, ShieldCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_IMPORT_CANONICAL_FIELDS,
  GROWTH_IMPORT_DUPLICATE_STRATEGIES,
  type GrowthImportBatch,
  type GrowthImportBatchEvent,
  type GrowthImportBatchRow,
  type GrowthImportColumnMapping,
  type ImportRowPreview,
} from "@/lib/growth/import/types"

type GrowthImportBatchWizardProps = {
  batchId: string
}

export function GrowthImportBatchWizard({ batchId }: GrowthImportBatchWizardProps) {
  const router = useRouter()
  const [batch, setBatch] = useState<GrowthImportBatch | null>(null)
  const [events, setEvents] = useState<GrowthImportBatchEvent[]>([])
  const [rows, setRows] = useState<GrowthImportBatchRow[]>([])
  const [previews, setPreviews] = useState<ImportRowPreview[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<GrowthImportColumnMapping>({})
  const [duplicateStrategy, setDuplicateStrategy] = useState<(typeof GROWTH_IMPORT_DUPLICATE_STRATEGIES)[number]>(
    "skip_high_confidence",
  )
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [profileName, setProfileName] = useState("")

  const previewRows = useMemo(() => {
    const previewJson = batch?.previewJson as { headers?: string[]; rows?: Record<string, string>[] } | null
    return previewJson?.rows ?? []
  }, [batch?.previewJson])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [batchRes, eventsRes, rowsRes] = await Promise.all([
        fetch(`/api/platform/growth/import-batches/${batchId}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/import-batches/${batchId}/events`, { cache: "no-store" }),
        fetch(`/api/platform/growth/import-batches/${batchId}/rows?limit=200`, { cache: "no-store" }),
      ])
      const batchData = (await batchRes.json().catch(() => ({}))) as { ok?: boolean; batch?: GrowthImportBatch; message?: string }
      const eventsData = (await eventsRes.json().catch(() => ({}))) as { ok?: boolean; events?: GrowthImportBatchEvent[] }
      const rowsData = (await rowsRes.json().catch(() => ({}))) as { ok?: boolean; rows?: GrowthImportBatchRow[] }
      if (!batchRes.ok || !batchData.ok || !batchData.batch) throw new Error(batchData.message ?? "Could not load batch.")
      setBatch(batchData.batch)
      setMapping(batchData.batch.columnMapping ?? {})
      setDuplicateStrategy(batchData.batch.options.duplicateStrategy ?? "skip_high_confidence")
      setEvents(eventsData.events ?? [])
      setRows(rowsData.rows ?? [])
      const previewJson = batchData.batch.previewJson as { headers?: string[] } | null
      setHeaders(previewJson?.headers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load batch.")
    } finally {
      setLoading(false)
    }
  }, [batchId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveMapping() {
    setWorking(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/import-batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnMapping: mapping, duplicateStrategy }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; batch?: GrowthImportBatch; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not save mapping.")
      setBatch(data.batch ?? null)
      setSuccess("Mapping saved.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save mapping.")
    } finally {
      setWorking(false)
    }
  }

  async function runPreview() {
    setWorking(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/import-batches/${batchId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnMapping: mapping }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        previews?: ImportRowPreview[]
        headers?: string[]
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Preview failed.")
      setPreviews(data.previews ?? [])
      setHeaders(data.headers ?? headers)
      setSuccess("Validation preview updated.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.")
    } finally {
      setWorking(false)
    }
  }

  async function runDryRun() {
    setWorking(true)
    setError(null)
    try {
      await saveMapping()
      const res = await fetch(`/api/platform/growth/import-batches/${batchId}/dry-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnMapping: mapping }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        batch?: GrowthImportBatch
        summary?: { imported: number; updated: number; skipped: number; duplicate: number; error: number }
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Dry run failed.")
      setBatch(data.batch ?? null)
      setSuccess(
        `Dry run: ${data.summary?.imported ?? 0} create · ${data.summary?.updated ?? 0} merge · ${(data.summary?.skipped ?? 0) + (data.summary?.duplicate ?? 0)} skip · ${data.summary?.error ?? 0} errors`,
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dry run failed.")
    } finally {
      setWorking(false)
    }
  }

  async function runCommit() {
    setWorking(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/import-batches/${batchId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnMapping: mapping, dryRun: false }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        batch?: GrowthImportBatch
        summary?: { imported: number; updated: number; duplicate: number; error: number; importQualityScore: number }
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Commit failed.")
      setBatch(data.batch ?? null)
      setSuccess(
        `Committed: ${data.summary?.imported ?? 0} imported · ${data.summary?.updated ?? 0} merged · quality ${data.summary?.importQualityScore ?? "—"}`,
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed.")
    } finally {
      setWorking(false)
    }
  }

  async function saveProfile() {
    if (!profileName.trim()) return
    setWorking(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/import-mapping-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName.trim(),
          sourceVendor: batch?.sourceVendor ?? "manual_csv",
          columnMapping: mapping,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not save profile.")
      setSuccess("Mapping profile saved.")
      setProfileName("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile.")
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading import batch…
      </div>
    )
  }

  if (!batch) {
    return <div className="py-12 text-sm text-muted-foreground">Import batch not found.</div>
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{batch.batchName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {batch.fileName ?? "CSV"} · {batch.rowCount} rows · {batch.sourceVendor.replace(/_/g, " ")}
            </p>
          </div>
          <GrowthBadge label={batch.status} tone={batch.status === "completed" ? "healthy" : "attention"} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Imported" value={batch.importedCount} />
          <Metric label="Merged" value={batch.updatedCount} />
          <Metric label="Duplicates" value={batch.duplicateCount} />
          <Metric label="Quality" value={batch.importQualityScore ?? "—"} />
          <Metric label="Email fill" value={batch.emailFillPercent != null ? `${batch.emailFillPercent}%` : "—"} />
          <Metric label="Phone fill" value={batch.phoneFillPercent != null ? `${batch.phoneFillPercent}%` : "—"} />
          <Metric label="Call ready" value={batch.callReadyCount} />
          <Metric label="Research done" value={batch.researchCompletedCount} />
        </dl>
      </section>

      {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{success}</div> : null}

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Column mapping</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {GROWTH_IMPORT_CANONICAL_FIELDS.map((field) => (
            <div key={field} className="space-y-1.5">
              <Label>{field.replace(/_/g, " ")}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={mapping[field] ?? ""}
                onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value || undefined }))}
              >
                <option value="">—</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Duplicate strategy</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={duplicateStrategy}
              onChange={(e) =>
                setDuplicateStrategy(e.target.value as (typeof GROWTH_IMPORT_DUPLICATE_STRATEGIES)[number])
              }
            >
              {GROWTH_IMPORT_DUPLICATE_STRATEGIES.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {strategy.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Save mapping profile</Label>
            <div className="flex gap-2">
              <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Profile name" />
              <Button variant="outline" disabled={working || !profileName.trim()} onClick={() => void saveProfile()}>
                <Save className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" disabled={working} onClick={() => void saveMapping()}>
            Save mapping
          </Button>
          <Button variant="outline" disabled={working} onClick={() => void runPreview()}>
            Validate
          </Button>
          <Button variant="outline" disabled={working} onClick={() => void runDryRun()}>
            <Sparkles className="mr-2 size-4" />
            Dry run
          </Button>
          <Button disabled={working || batch.status === "cancelled"} onClick={() => void runCommit()}>
            {working ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Commit import
          </Button>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Merge never overwrites notes, decision maker confirmations, call history, priority override, or human touch timestamps.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Preview grid</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Company</th>
                <th className="px-2 py-2">Contact</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(previews.length ? previews.slice(0, 50) : previewRows.slice(0, 50).map((_, i) => ({ rowIndex: i }))).map(
                (item) => {
                  const preview = previews.find((p) => p.rowIndex === item.rowIndex)
                  const row = preview?.normalized
                  const rowOutcome = rows.find((r) => r.rowIndex === item.rowIndex)
                  return (
                    <tr key={item.rowIndex}>
                      <td className="px-2 py-2">{item.rowIndex + 1}</td>
                      <td className="px-2 py-2">{row?.companyName ?? previewRows[item.rowIndex]?.[mapping.company_name ?? ""] ?? "—"}</td>
                      <td className="px-2 py-2">{row?.contactName ?? "—"}</td>
                      <td className="px-2 py-2">{row?.email ?? "—"}</td>
                      <td className="px-2 py-2">{row?.phone ?? "—"}</td>
                      <td className="px-2 py-2 capitalize">
                        {rowOutcome?.action ?? preview?.proposedAction ?? "—"}
                        {preview?.dedupe ? ` (${preview.dedupe.rule})` : ""}
                      </td>
                    </tr>
                  )
                },
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Batch timeline</h3>
        <ol className="mt-3 space-y-2">
          {events.map((event) => (
            <li key={event.id} className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2 text-sm">
              <div className="font-medium">{event.title}</div>
              {event.summary ? <div className="text-muted-foreground">{event.summary}</div> : null}
              <div className="text-xs text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}</div>
            </li>
          ))}
        </ol>
      </section>

      <div>
        <Button variant="outline" onClick={() => router.push("/admin/growth/imports")}>
          Back to Import Center
        </Button>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
