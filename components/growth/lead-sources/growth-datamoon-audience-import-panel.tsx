"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Loader2, RefreshCw, SatelliteDish } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { DatamoonProviderDiagnostics } from "@/lib/growth/providers/datamoon"
import type {
  DatamoonAudienceImportRecord,
  DatamoonAudienceImportRun,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

function statusTone(status: DatamoonAudienceImportRun["status"]) {
  switch (status) {
    case "completed":
    case "imported":
      return "healthy" as const
    case "building":
    case "importing":
    case "pending_build":
      return "medium" as const
    case "failed":
      return "critical" as const
    default:
      return "attention" as const
  }
}

export function GrowthDatamoonAudienceImportPanel() {
  const [diagnostics, setDiagnostics] = useState<DatamoonProviderDiagnostics | null>(null)
  const [runs, setRuns] = useState<DatamoonAudienceImportRun[]>([])
  const [activeRun, setActiveRun] = useState<DatamoonAudienceImportRun | null>(null)
  const [records, setRecords] = useState<DatamoonAudienceImportRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [runName, setRunName] = useState("")
  const [audienceType, setAudienceType] = useState<"advanced_search" | "b2b" | "b2c">("advanced_search")
  const [topicIds, setTopicIds] = useState("")
  const [limit, setLimit] = useState("100")
  const [filtersJson, setFiltersJson] = useState(
    '[{"field":"job_title","operator":"contains","value":"CEO"}]',
  )

  const previewRecords = useMemo(
    () => records.filter((record) => record.status === "preview"),
    [records],
  )

  const loadRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/lead-sources/datamoon/runs", { cache: "no-store" })
      const data = (await res.json()) as {
        ok?: boolean
        runs?: DatamoonAudienceImportRun[]
        diagnostics?: DatamoonProviderDiagnostics
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? data.error ?? "Could not load Datamoon runs.")
      setRuns(data.runs ?? [])
      setDiagnostics(data.diagnostics ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Datamoon runs.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRunDetail = useCallback(async (runId: string) => {
    const res = await fetch(`/api/platform/growth/lead-sources/datamoon/runs/${runId}`, { cache: "no-store" })
    const data = (await res.json()) as {
      ok?: boolean
      run?: DatamoonAudienceImportRun
      records?: DatamoonAudienceImportRecord[]
      diagnostics?: DatamoonProviderDiagnostics
      error?: string
    }
    if (!res.ok || !data.ok || !data.run) throw new Error(data.error ?? "Could not load run detail.")
    setActiveRun(data.run)
    setRecords(data.records ?? [])
    setDiagnostics(data.diagnostics ?? null)
    setSelectedIds(new Set())
  }, [])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  async function handleCreateAudience() {
    setBusy("create")
    setError(null)
    try {
      let filters: unknown[] = []
      try {
        filters = JSON.parse(filtersJson) as unknown[]
      } catch {
        throw new Error("Filters must be valid JSON.")
      }

      const res = await fetch("/api/platform/growth/lead-sources/datamoon/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_name: runName.trim() || "Datamoon audience run",
          audience_type: audienceType,
          topic_ids: topicIds
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          limit: Number(limit) || undefined,
          filters,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        run?: DatamoonAudienceImportRun
        error?: string
        issues?: Array<{ message: string }>
      }
      if (!res.ok || !data.ok || !data.run) {
        const issueText = data.issues?.map((issue) => issue.message).join(" ")
        throw new Error(issueText || data.error || "Create audience failed.")
      }
      setActiveRun(data.run)
      await loadRuns()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create audience failed.")
    } finally {
      setBusy(null)
    }
  }

  async function handlePoll() {
    if (!activeRun) return
    setBusy("poll")
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/lead-sources/datamoon/runs/${activeRun.id}/poll`, {
        method: "POST",
      })
      const data = (await res.json()) as {
        ok?: boolean
        run?: DatamoonAudienceImportRun
        records?: DatamoonAudienceImportRecord[]
        error?: string
      }
      if (!res.ok || !data.ok || !data.run) throw new Error(data.error ?? "Poll failed.")
      setActiveRun(data.run)
      setRecords(data.records ?? [])
      await loadRuns()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Poll failed.")
    } finally {
      setBusy(null)
    }
  }

  async function handleImport(importAllPreviewed: boolean) {
    if (!activeRun) return
    setBusy(importAllPreviewed ? "import-all" : "import-selected")
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/lead-sources/datamoon/runs/${activeRun.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          import_all_previewed: importAllPreviewed,
          record_ids: importAllPreviewed ? undefined : Array.from(selectedIds),
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        run?: DatamoonAudienceImportRun
        imported?: number
        error?: string
      }
      if (!res.ok || !data.ok || !data.run) throw new Error(data.error ?? "Import failed.")
      setActiveRun(data.run)
      await loadRunDetail(activeRun.id)
      await loadRuns()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.")
    } finally {
      setBusy(null)
    }
  }

  function toggleRecord(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const disabledBanner = diagnostics && (!diagnostics.enabled || diagnostics.dryRunOnly)

  return (
    <div className="space-y-4">
      {disabledBanner ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Datamoon provider is disabled or dry-run only.</p>
            <p className="mt-1 text-amber-900/80">
              Set <code>DATAMOON_PROVIDER_ENABLED=true</code> and{" "}
              <code>DATAMOON_DRY_RUN_ONLY=false</code> with audience API keys for live imports. Current
              mode returns preview-safe responses without outbound side effects.
            </p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SatelliteDish className="size-4 text-sky-600" />
            <CardTitle className="text-base">Datamoon Audience Import</CardTitle>
          </div>
          {diagnostics ? (
            <GrowthBadge tone={diagnostics.configured ? "healthy" : "attention"}>
              {diagnostics.enabled ? (diagnostics.dryRunOnly ? "Dry run" : "Live") : "Disabled"}
            </GrowthBadge>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {diagnostics ? (
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div>Mode: {diagnostics.audienceMode}</div>
              <div>
                Capabilities: {diagnostics.availableCapabilities.join(", ") || "none"}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="datamoon-run-name">Run name</Label>
              <Input
                id="datamoon-run-name"
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder="Q2 cybersecurity executives"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="datamoon-audience-type">Audience type</Label>
              <select
                id="datamoon-audience-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value as typeof audienceType)}
              >
                <option value="advanced_search">advanced_search</option>
                <option value="b2b">b2b</option>
                <option value="b2c">b2c</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="datamoon-topic-ids">Topic IDs (comma-separated, max 5)</Label>
              <Input
                id="datamoon-topic-ids"
                value={topicIds}
                onChange={(e) => setTopicIds(e.target.value)}
                placeholder="topic-1, topic-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="datamoon-limit">Limit</Label>
              <Input
                id="datamoon-limit"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="datamoon-filters">Filters JSON</Label>
            <Textarea
              id="datamoon-filters"
              value={filtersJson}
              onChange={(e) => setFiltersJson(e.target.value)}
              rows={5}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleCreateAudience()} disabled={busy !== null}>
              {busy === "create" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Create Audience
            </Button>
            <Button type="button" variant="secondary" onClick={() => void handlePoll()} disabled={!activeRun || busy !== null}>
              {busy === "poll" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Poll Status
            </Button>
            <Button type="button" variant="outline" onClick={() => void loadRuns()} disabled={loading}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {activeRun ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <GrowthBadge tone={statusTone(activeRun.status)}>{activeRun.status}</GrowthBadge>
              <span>{activeRun.runName}</span>
              {activeRun.datamoonAudienceId ? (
                <span className="text-muted-foreground">Audience {activeRun.datamoonAudienceId}</span>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <div>Preview: {activeRun.previewCount}</div>
              <div>Duplicates: {activeRun.duplicateCount}</div>
              <div>Imported: {activeRun.importedCount}</div>
              <div>Skipped: {activeRun.skippedCount}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void handleImport(false)}
                disabled={selectedIds.size === 0 || busy !== null}
              >
                Import Selected
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleImport(true)}
                disabled={previewRecords.length === 0 || busy !== null}
              >
                Import All Previewed
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {records.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview Results</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-2 py-2">Select</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Phone</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b">
                    <td className="px-2 py-2">
                      {record.status === "preview" ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(record.id)}
                          onChange={() => toggleRecord(record.id)}
                        />
                      ) : null}
                    </td>
                    <td className="px-2 py-2">{record.normalized.contact_name ?? "—"}</td>
                    <td className="px-2 py-2">{record.normalized.email ?? "—"}</td>
                    <td className="px-2 py-2">{record.normalized.phone ?? "—"}</td>
                    <td className="px-2 py-2">{record.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {runs.map((run) => (
            <button
              key={run.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/40"
              onClick={() => void loadRunDetail(run.id)}
            >
              <span>{run.runName}</span>
              <GrowthBadge tone={statusTone(run.status)}>{run.status}</GrowthBadge>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
