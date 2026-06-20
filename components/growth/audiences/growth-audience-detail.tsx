"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Play, RefreshCw, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GrowthBulkSequenceEnrollmentDialog } from "@/components/growth/growth-bulk-sequence-enrollment-dialog"
import type {
  GrowthAudience,
  GrowthAudienceLeadCreationProgress,
  GrowthAudienceMember,
  GrowthAudienceRefreshRun,
  GrowthAudienceSnapshot,
  GrowthAudienceSnapshotProgress,
} from "@/lib/growth/audiences/growth-audience-types"
import type { GrowthAudienceRefreshPolicy } from "@/lib/growth/audiences/growth-audience-config"

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

const REFRESH_POLICIES: GrowthAudienceRefreshPolicy[] = ["manual", "daily", "weekly"]

export function GrowthAudienceDetail({ audienceId }: { audienceId: string }) {
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [members, setMembers] = useState<GrowthAudienceMember[]>([])
  const [memberTotal, setMemberTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [progress, setProgress] = useState<GrowthAudienceSnapshotProgress | null>(null)
  const [leadProgress, setLeadProgress] = useState<GrowthAudienceLeadCreationProgress | null>(null)
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
        const diff =
          current.addedCount != null || current.removedCount != null
            ? ` · +${current.addedCount ?? 0} / −${current.removedCount ?? 0}`
            : ""
        setMessage(
          `${action === "refresh" ? "Refresh" : "Snapshot"} completed · ${current.memberCount} members${diff}`,
        )
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

  async function updateRefreshPolicy(policy: GrowthAudienceRefreshPolicy) {
    setBusy(true)
    try {
      const res = await fetch(`/api/platform/growth/audiences/${audienceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshPolicy: policy }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!res.ok) {
        setMessage(data.message ?? "Failed to update refresh policy")
        return
      }
      setMessage(`Refresh policy set to ${policy} (informational only — operator must refresh manually)`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function createLeadsFromSelection() {
    if (!detail?.audience.lastSnapshotId) return
    setBusy(true)
    setLeadProgress(null)
    try {
      const memberIds = [...selected]
      let current: GrowthAudienceLeadCreationProgress | null = null
      do {
        const body = current?.hasMore && current.runId
          ? { runId: current.runId, snapshotId: detail.audience.lastSnapshotId }
          : {
              snapshotId: detail.audience.lastSnapshotId,
              memberIds: memberIds.length > 0 ? memberIds : undefined,
              allWithoutLead: memberIds.length === 0,
            }
        const res = await fetch(`/api/platform/growth/audiences/${audienceId}/create-leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = (await res.json()) as {
          ok: boolean
          progress: GrowthAudienceLeadCreationProgress
          message?: string
        }
        if (!res.ok) {
          setMessage(data.message ?? "Lead creation failed")
          break
        }
        current = data.progress
        setLeadProgress(current)
      } while (current?.hasMore)

      if (current?.status === "completed") {
        setMessage(
          `Lead creation completed · ${current.createdCount} created · ${current.skippedCount} skipped · ${current.failedCount} failed`,
        )
      } else if (current?.status === "throttled") {
        setMessage(current.error ?? "Lead creation throttled")
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
  const selectedWithoutLead = members.filter((m) => selected.has(m.id) && !m.leadId)
  const withoutLeadCount = members.filter((m) => !m.leadId).length

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
  const latestSnapshot = snapshots[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{audience.name}</h2>
          {audience.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{audience.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{audience.resultMode}</Badge>
            <Badge variant="secondary">{audience.memberCount ?? 0} members</Badge>
            {latestSnapshot ? (
              <Badge variant="outline">
                Last snapshot: {latestSnapshot.memberCount} · +{latestSnapshot.addedCount} / −
                {latestSnapshot.removedCount}
              </Badge>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Refresh policy (informational):</span>
            <Select
              value={audience.refreshPolicy}
              onValueChange={(v) => void updateRefreshPolicy(v as GrowthAudienceRefreshPolicy)}
              disabled={busy}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_POLICIES.map((policy) => (
                  <SelectItem key={policy} value={policy}>
                    {policy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {audience.nextRefreshAt ? (
              <span className="text-xs text-muted-foreground">
                Suggested next: {new Date(audience.nextRefreshAt).toLocaleDateString()}
              </span>
            ) : null}
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
          {progress.addedCount != null ? ` · +${progress.addedCount} / −${progress.removedCount ?? 0}` : ""}
        </p>
      ) : null}
      {leadProgress ? (
        <p className="text-xs text-muted-foreground">
          Lead creation: {leadProgress.createdCount} created · {leadProgress.skippedCount} skipped ·{" "}
          {leadProgress.failedCount} failed
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Snapshot history</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto text-sm">
            {snapshots.length === 0 ? (
              <p className="text-muted-foreground">No snapshots yet.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1 pr-2">Created</th>
                    <th className="py-1 pr-2">Members</th>
                    <th className="py-1 pr-2">Added</th>
                    <th className="py-1 pr-2">Removed</th>
                    <th className="py-1">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snap) => (
                    <tr key={snap.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">{new Date(snap.generatedAt).toLocaleString()}</td>
                      <td className="py-2 pr-2">{snap.memberCount}</td>
                      <td className="py-2 pr-2 text-green-700">+{snap.addedCount}</td>
                      <td className="py-2 pr-2 text-red-700">−{snap.removedCount}</td>
                      <td className="py-2">{snap.generationDurationMs ?? "—"}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    +{run.membersAdded} / −{run.membersRemoved} · reads {run.rowsRead} · writes {run.rowsWritten}
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
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || (selectedWithoutLead.length === 0 && withoutLeadCount === 0)}
              onClick={() => void createLeadsFromSelection()}
            >
              <UserPlus className="mr-1 h-4 w-4" />
              Create Leads ({selectedWithoutLead.length || withoutLeadCount})
            </Button>
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
                  />
                  <div className="flex-1">
                    {member.memberKind === "person" ? (
                      <p>
                        {member.personName ?? member.growthPersonId ?? "Unknown person"}
                        {member.personTitle ? ` · ${member.personTitle}` : ""}
                      </p>
                    ) : (
                      <p>{member.companyName ?? member.companyId ?? "Unknown company"}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {member.memberKind} · Lead: {member.leadId ?? "none — review & create"} · intent{" "}
                      {member.intentScore ?? "—"} · fit {member.fitScore ?? "—"}
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
