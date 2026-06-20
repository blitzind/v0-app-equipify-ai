"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Play, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { GrowthBulkSequenceEnrollmentDialog } from "@/components/growth/growth-bulk-sequence-enrollment-dialog"
import type {
  GrowthAudience,
  GrowthAudienceMember,
  GrowthAudienceRefreshRun,
  GrowthAudienceSnapshot,
  GrowthAudienceSnapshotProgress,
} from "@/lib/growth/audiences/growth-audience-types"

type DetailResponse = {
  ok: boolean
  audience: GrowthAudience
  snapshots: GrowthAudienceSnapshot[]
  refreshRuns: GrowthAudienceRefreshRun[]
  message?: string
}

type MembersResponse = {
  ok: boolean
  items: GrowthAudienceMember[]
  total: number
  snapshotId: string
}

export function GrowthAudienceDetail({ audienceId }: { audienceId: string }) {
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [members, setMembers] = useState<GrowthAudienceMember[]>([])
  const [memberTotal, setMemberTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [progress, setProgress] = useState<GrowthAudienceSnapshotProgress | null>(null)
  const [enrollOpen, setEnrollOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/platform/growth/audiences/${audienceId}`)
      const data = (await res.json()) as DetailResponse
      if (!res.ok) {
        setMessage(data.message ?? "Failed to load audience")
        return
      }
      setDetail(data)

      const snapshotId = data.audience.lastSnapshotId
      if (snapshotId) {
        const memRes = await fetch(
          `/api/platform/growth/audiences/${audienceId}/members?snapshotId=${snapshotId}&limit=100`,
        )
        const memData = (await memRes.json()) as MembersResponse
        if (memRes.ok) {
          setMembers(memData.items ?? [])
          setMemberTotal(memData.total ?? 0)
        }
      } else {
        setMembers([])
        setMemberTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }, [audienceId])

  useEffect(() => {
    void load()
  }, [load])

  async function runSnapshotAction(action: "snapshot" | "refresh") {
    setBusy(true)
    setMessage(null)
    setProgress(null)
    try {
      let current: GrowthAudienceSnapshotProgress | null = null
      do {
        const body = current?.hasMore && current.refreshRunId ? { refreshRunId: current.refreshRunId } : {}
        const res = await fetch(`/api/platform/growth/audiences/${audienceId}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = (await res.json()) as { ok: boolean; progress: GrowthAudienceSnapshotProgress; message?: string }
        if (!res.ok) {
          setMessage(data.message ?? `${action} failed`)
          break
        }
        current = data.progress
        setProgress(current)
      } while (current?.hasMore)

      if (current?.status === "completed") {
        setMessage(`${action === "refresh" ? "Refresh" : "Snapshot"} completed · ${current.memberCount} members`)
      } else if (current?.status === "throttled") {
        setMessage(current.error ?? "Throttled by runtime budget")
      } else if (current?.status === "failed") {
        setMessage(current.error ?? "Snapshot generation failed")
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  function toggleMember(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const enrollLeadIds = members
    .filter((m) => selected.has(m.id) && m.leadId)
    .map((m) => m.leadId!)
  const allLeadIds = members.filter((m) => m.leadId).map((m) => m.leadId!)

  if (loading && !detail) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading audience…
      </div>
    )
  }

  if (!detail?.audience) {
    return <p className="text-sm text-destructive">{message ?? "Audience not found"}</p>
  }

  const { audience, snapshots, refreshRuns } = detail

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{audience.name}</h2>
          {audience.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{audience.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{audience.refreshPolicy.replace("_", " ")}</Badge>
            <Badge variant="secondary">{audience.memberCount ?? 0} members</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void runSnapshotAction("snapshot")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Generate Snapshot
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void runSnapshotAction("refresh")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Audience
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm">{message}</p> : null}
      {progress ? (
        <p className="text-xs text-muted-foreground">
          Progress: {progress.processedCount} processed · {progress.remainingEstimate} remaining · reads{" "}
          {progress.rowsRead} · writes {progress.rowsWritten}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Snapshot history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {snapshots.length === 0 ? (
              <p className="text-muted-foreground">No snapshots yet.</p>
            ) : (
              snapshots.map((snap) => (
                <div key={snap.id} className="flex justify-between gap-2 border-b pb-2 last:border-0">
                  <span>{new Date(snap.generatedAt).toLocaleString()}</span>
                  <span>
                    {snap.memberCount} members · {snap.generationDurationMs ?? "—"}ms
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Refresh runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {refreshRuns.length === 0 ? (
              <p className="text-muted-foreground">No refresh runs yet.</p>
            ) : (
              refreshRuns.map((run) => (
                <div key={run.id} className="space-y-1 border-b pb-2 last:border-0">
                  <div className="flex justify-between">
                    <Badge variant="outline">{run.status}</Badge>
                    <span>{new Date(run.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +{run.membersAdded} / -{run.membersRemoved} · reads {run.rowsRead} · writes {run.rowsWritten}
                    {run.durationMs != null ? ` · ${run.durationMs}ms` : ""}
                  </p>
                  {run.error ? <p className="text-xs text-destructive">{run.error}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Members ({memberTotal})</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={enrollLeadIds.length === 0}
              onClick={() => setEnrollOpen(true)}
            >
              Enroll Selected ({enrollLeadIds.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={allLeadIds.length === 0}
              onClick={async () => {
                setSelected(new Set(members.filter((m) => m.leadId).map((m) => m.id)))
                setEnrollOpen(true)
              }}
            >
              Enroll All ({allLeadIds.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Generate a snapshot to see members.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-md border p-2 text-sm">
                  <Checkbox
                    checked={selected.has(member.id)}
                    onCheckedChange={(v) => toggleMember(member.id, v === true)}
                    disabled={!member.leadId}
                  />
                  <div className="flex-1">
                    <p>{member.companyId ?? "Unknown company"}</p>
                    <p className="text-xs text-muted-foreground">
                      Lead: {member.leadId ?? "none"} · intent {member.intentScore ?? "—"} · fit{" "}
                      {member.fitScore ?? "—"}
                    </p>
                  </div>
                </div>
              ))}
              {memberTotal > members.length ? (
                <p className="text-xs text-muted-foreground">
                  Showing first {members.length} of {memberTotal} members.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <GrowthBulkSequenceEnrollmentDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        leadIds={enrollLeadIds}
        onDismissAfterSuccess={() => {
          setEnrollOpen(false)
          setMessage(`Enrollment completed for ${enrollLeadIds.length} leads`)
        }}
      />
    </div>
  )
}
