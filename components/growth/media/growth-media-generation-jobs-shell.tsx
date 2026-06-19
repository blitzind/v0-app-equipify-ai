"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"
import type {
  GrowthMediaGenerationJobSummary,
  GrowthMediaGenerationRun,
} from "@/lib/growth/media/growth-media-generation-types"

type JobsResponse = {
  ok?: boolean
  message?: string
  items?: GrowthMediaGenerationRun[]
  summary?: GrowthMediaGenerationJobSummary
  job?: GrowthMediaGenerationRun
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

export function GrowthMediaGenerationJobsShell() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [items, setItems] = useState<GrowthMediaGenerationRun[]>([])
  const [summary, setSummary] = useState<GrowthMediaGenerationJobSummary | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/media/jobs")
      const data = (await res.json().catch(() => ({}))) as JobsResponse
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load media generation jobs.")
      setItems(data.items ?? [])
      setSummary(data.summary ?? null)
      setSelectedId((current) => current ?? data.items?.[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createSampleJob() {
    setActing(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/media/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generation_type: "voice_generation",
          provider: "elevenlabs",
          metadata_hooks: {
            video_page_id: null,
            lead_id: null,
          },
          notes: "C3 foundation job — provider execution disabled.",
        }),
      })
      const data = (await res.json().catch(() => ({}))) as JobsResponse
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not create job.")
      await load()
      if (data.job?.id) setSelectedId(data.job.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.")
    } finally {
      setActing(false)
    }
  }

  async function patchSelected(patch: Record<string, unknown>) {
    if (!selected) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/media/jobs/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = (await res.json().catch(() => ({}))) as JobsResponse
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Update failed.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.")
    } finally {
      setActing(false)
    }
  }

  return (
    <GrowthVideoWorkspaceShell
      title="Media Generation Jobs"
      description="Persistent ai_jobs + media_generation_runs foundation for future C1/C2/C3 provider execution."
    >
      <GrowthEnginePanelResilience loading={loading} error={error}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void createSampleJob()} disabled={acting}>
              {acting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Queue sample job
            </Button>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={acting}>
              Refresh
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Human-supervised infrastructure only. Provider execution and media output are disabled in C3.
          </p>

          {summary ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile label="Queued" value={String(summary.queued)} />
              <StatTile label="Processing" value={String(summary.processing)} />
              <StatTile label="Completed" value={String(summary.completed)} />
              <StatTile label="Failed" value={String(summary.failed)} />
              <StatTile label="Cancelled" value={String(summary.cancelled)} />
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <GrowthEngineCard title="Jobs">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-2 py-2">Job Id</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Provider</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Progress</th>
                      <th className="px-2 py-2">Retries</th>
                      <th className="px-2 py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className={`cursor-pointer border-b border-border/60 hover:bg-muted/40 ${
                          selectedId === item.id ? "bg-muted/60" : ""
                        }`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <td className="px-2 py-2 font-mono text-xs">{item.id.slice(0, 8)}…</td>
                        <td className="px-2 py-2">{item.generationType}</td>
                        <td className="px-2 py-2">{item.provider}</td>
                        <td className="px-2 py-2">{item.status}</td>
                        <td className="px-2 py-2">{item.progressPercent}%</td>
                        <td className="px-2 py-2">{item.retryCount}</td>
                        <td className="px-2 py-2">{formatDate(item.updatedAt)}</td>
                      </tr>
                    ))}
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                          No media generation jobs yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </GrowthEngineCard>

            <GrowthEngineCard title="Job detail">
              {selected ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">Job Id</p>
                    <p className="font-mono text-xs text-muted-foreground">{selected.id}</p>
                  </div>
                  <div>
                    <p className="font-medium">AI Job Id</p>
                    <p className="font-mono text-xs text-muted-foreground">{selected.aiJobId}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={acting}
                      onClick={() => void patchSelected({ retry: true, retry_reason: "Operator retry" })}
                    >
                      Retry
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={acting}
                      onClick={() =>
                        void patchSelected({
                          status: "failed",
                          progress_percent: selected.progressPercent,
                          error: { message: "Marked failed by operator." },
                        })
                      }
                    >
                      Mark failed
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={acting}
                      onClick={() => void patchSelected({ cancel: true, cancel_reason: "Operator cancelled" })}
                    >
                      Cancel
                    </Button>
                  </div>
                  <div>
                    <p className="font-medium">Input JSON</p>
                    <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                      {JSON.stringify(selected.input, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="font-medium">Output JSON</p>
                    <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                      {JSON.stringify(selected.output, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="font-medium">Error JSON</p>
                    <pre className="max-h-32 overflow-auto rounded-md bg-muted p-2 text-xs">
                      {JSON.stringify(selected.error, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="font-medium">Progress timeline</p>
                    <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                      {JSON.stringify(selected.output.progress_timeline ?? [], null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="font-medium">Raw payload</p>
                    <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
                      {JSON.stringify(selected, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a job to inspect details.</p>
              )}
            </GrowthEngineCard>
          </div>
        </div>
      </GrowthEnginePanelResilience>
    </GrowthVideoWorkspaceShell>
  )
}
