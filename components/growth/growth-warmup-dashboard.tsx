"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
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
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { warmupHealthTierLabel } from "@/lib/growth/warmup/warmup-health"
import type {
  GrowthWarmupDashboard,
  GrowthWarmupEvent,
  GrowthWarmupProfile,
} from "@/lib/growth/warmup/warmup-types"
import { GROWTH_WARMUP_FOUNDATION_QA_MARKER } from "@/lib/growth/warmup/warmup-types"
import type { GrowthSenderAccount } from "@/lib/growth/sender/sender-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked"> = {
  draft: "neutral",
  warming: "healthy",
  paused: "attention",
  completed: "healthy",
  disabled: "blocked",
  healthy: "healthy",
  warning: "attention",
  degraded: "attention",
  critical: "critical",
}

const SEVERITY_TONE: Record<string, "healthy" | "medium" | "attention" | "critical" | "neutral"> = {
  low: "neutral",
  medium: "medium",
  high: "attention",
  critical: "critical",
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

type ListPayload = {
  ok?: boolean
  profiles?: GrowthWarmupProfile[]
  senders?: GrowthSenderAccount[]
  message?: string
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthWarmupDashboard
  events?: GrowthWarmupEvent[]
  message?: string
}

export function GrowthWarmupDashboardPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<GrowthWarmupProfile[]>([])
  const [senders, setSenders] = useState<GrowthSenderAccount[]>([])
  const [dashboard, setDashboard] = useState<GrowthWarmupDashboard | null>(null)
  const [events, setEvents] = useState<GrowthWarmupEvent[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>("")
  const [newSenderId, setNewSenderId] = useState("")
  const [newWarmupDays, setNewWarmupDays] = useState("30")
  const [deleteTarget, setDeleteTarget] = useState<GrowthWarmupProfile | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0] ?? null,
    [profiles, selectedProfileId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [listResponse, dashboardResponse] = await Promise.all([
        fetch("/api/platform/growth/warmup"),
        fetch("/api/platform/growth/warmup/dashboard"),
      ])
      const listPayload = (await listResponse.json()) as ListPayload
      const dashboardPayload = (await dashboardResponse.json()) as DashboardPayload
      if (!listResponse.ok) throw new Error(listPayload.message ?? "Could not load warmup profiles.")
      if (!dashboardResponse.ok) throw new Error(dashboardPayload.message ?? "Could not load warmup dashboard.")
      setProfiles(listPayload.profiles ?? [])
      setSenders(listPayload.senders ?? [])
      setDashboard(dashboardPayload.dashboard ?? null)
      setEvents(dashboardPayload.events ?? [])
      if (!selectedProfileId && (listPayload.profiles?.length ?? 0) > 0) {
        setSelectedProfileId(listPayload.profiles![0].id)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load warmup dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(key: string, action: () => Promise<void>) {
    setActionLoading(key)
    setError(null)
    try {
      await action()
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Warmup action failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function createWarmupProfile() {
    const warmupDays = Number.parseInt(newWarmupDays, 10)
    const response = await fetch("/api/platform/growth/warmup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderAccountId: newSenderId,
        warmupDays: Number.isFinite(warmupDays) ? warmupDays : 30,
      }),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not create warmup profile.")
  }

  async function profileAction(profileId: string, path: "generate" | "pause" | "resume") {
    const response = await fetch(`/api/platform/growth/warmup/${profileId}/${path}`, { method: "POST" })
    const payload = (await response.json()) as { message?: string; profile?: GrowthWarmupProfile }
    if (!response.ok) throw new Error(payload.message ?? "Warmup action failed.")
    if (payload.profile) setSelectedProfileId(payload.profile.id)
  }

  async function deleteProfile(profile: GrowthWarmupProfile) {
    const response = await fetch(`/api/platform/growth/warmup/${profile.id}`, { method: "DELETE" })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not delete warmup profile.")
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading warmup engine…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_WARMUP_FOUNDATION_QA_MARKER} · Schedule planning only — no sending, provider execution, or inbox interaction.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/providers/deliverability-ops">Deliverability Ops</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/infrastructure/deliverability">Deliverability</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/infrastructure">Sender Infrastructure</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(actionLoading)}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Warmup Overview">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Healthy" value={String(dashboard?.healthy_count ?? 0)} />
          <StatTile label="Paused" value={String(dashboard?.paused_count ?? 0)} />
          <StatTile label="Completed" value={String(dashboard?.completed_count ?? 0)} />
          <StatTile label="Average Warmup Score" value={`${dashboard?.average_warmup_score ?? 0}%`} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Warmup mismatch warnings">
        <p className="text-sm text-muted-foreground">
          When send volume exceeds warmup stage limits, Deliverability Ops surfaces warmup mismatch risks. Review advisory
          recommendations before increasing outbound volume.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/admin/growth/providers/deliverability-ops">Review in Deliverability Ops</Link>
        </Button>
      </GrowthEngineCard>

      <GrowthEngineCard title="Live Warmup Execution">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Outbound warmup execution and provider workers are not enabled in this foundation phase.
          </p>
          <Button type="button" variant="outline" size="sm" disabled>
            Live Warmup Execution
            <GrowthBadge label="Coming Soon" tone="neutral" className="ml-2" />
          </Button>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Warmup Profiles">
        <div className="mb-4 grid gap-3 rounded-xl border border-dashed border-border p-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="warmup-sender">Sender account</Label>
            <Select value={newSenderId} onValueChange={setNewSenderId}>
              <SelectTrigger id="warmup-sender">
                <SelectValue placeholder="Select sender" />
              </SelectTrigger>
              <SelectContent>
                {senders.map((sender) => (
                  <SelectItem key={sender.id} value={sender.id}>
                    {sender.email_address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="warmup-days">Warmup days</Label>
            <Input id="warmup-days" type="number" min={1} max={120} value={newWarmupDays} onChange={(e) => setNewWarmupDays(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              disabled={Boolean(actionLoading) || !newSenderId}
              onClick={() => void runAction("create", createWarmupProfile)}
            >
              <Plus className="mr-1.5 size-3.5" />
              Create Warmup
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">Sender</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Health</th>
                <th className="px-2 py-2">Current Volume</th>
                <th className="px-2 py-2">Target Volume</th>
                <th className="px-2 py-2">Progress</th>
                <th className="px-2 py-2">Started</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-muted-foreground">
                    No warmup profiles yet. Create a sender account first, then create a warmup profile.
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
                  <tr
                    key={profile.id}
                    className={`border-b border-border/60 ${selectedProfile?.id === profile.id ? "bg-muted/30" : ""}`}
                    onClick={() => setSelectedProfileId(profile.id)}
                  >
                    <td className="px-2 py-3">
                      <div className="font-medium">{profile.sender_email}</div>
                      <div className="text-xs text-muted-foreground">{profile.sender_display_name}</div>
                    </td>
                    <td className="px-2 py-3">
                      <GrowthBadge label={profile.status} tone={STATUS_TONE[profile.status] ?? "neutral"} />
                    </td>
                    <td className="px-2 py-3">
                      <GrowthBadge
                        label={warmupHealthTierLabel(profile.warmup_health)}
                        tone={STATUS_TONE[profile.warmup_health] ?? "neutral"}
                      />
                    </td>
                    <td className="px-2 py-3">{profile.current_daily_volume}</td>
                    <td className="px-2 py-3">{profile.target_daily_volume}</td>
                    <td className="px-2 py-3">{profile.warmup_progress}%</td>
                    <td className="px-2 py-3">{formatDate(profile.started_at)}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading)}
                          onClick={(event) => {
                            event.stopPropagation()
                            void runAction(`generate-${profile.id}`, () => profileAction(profile.id, "generate"))
                          }}
                        >
                          Generate Schedule
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading) || profile.status !== "warming"}
                          onClick={(event) => {
                            event.stopPropagation()
                            void runAction(`pause-${profile.id}`, () => profileAction(profile.id, "pause"))
                          }}
                        >
                          Pause
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading) || profile.status !== "paused"}
                          onClick={(event) => {
                            event.stopPropagation()
                            void runAction(`resume-${profile.id}`, () => profileAction(profile.id, "resume"))
                          }}
                        >
                          Resume
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(actionLoading)}
                          onClick={(event) => {
                            event.stopPropagation()
                            setDeleteTarget(profile)
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Schedule Viewer">
        {!selectedProfile ? (
          <p className="text-sm text-muted-foreground">Select a warmup profile to view its schedule.</p>
        ) : (
          <div className="overflow-x-auto">
            <p className="mb-3 text-sm text-muted-foreground">
              {selectedProfile.sender_email} · {selectedProfile.warmup_days} day plan
            </p>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2">Day</th>
                  <th className="px-2 py-2">Planned Volume</th>
                  <th className="px-2 py-2">Completed</th>
                </tr>
              </thead>
              <tbody>
                {(selectedProfile.schedule ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-6 text-muted-foreground">
                      No schedule generated yet. Use Generate Schedule to build the progression plan.
                    </td>
                  </tr>
                ) : (
                  (selectedProfile.schedule ?? []).map((day) => (
                    <tr key={day.id} className="border-b border-border/60">
                      <td className="px-2 py-3">{day.day_number}</td>
                      <td className="px-2 py-3">{day.planned_volume}</td>
                      <td className="px-2 py-3">
                        <GrowthBadge
                          label={day.completed ? "Yes" : "No"}
                          tone={day.completed ? "healthy" : "neutral"}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Health Feed">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No warmup events yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-lg border border-border/80 bg-background px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{event.title}</p>
                  <GrowthBadge label={event.severity} tone={SEVERITY_TONE[event.severity] ?? "neutral"} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.sender_email ? `${event.sender_email} · ` : ""}
                  {formatDate(event.created_at)}
                </p>
                <p className="mt-1 text-sm text-foreground/90">{event.description}</p>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete warmup profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes the warmup profile for {deleteTarget?.sender_email}. No outbound activity occurs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(actionLoading)}
              onClick={() => deleteTarget && void runAction(`delete-${deleteTarget.id}`, () => deleteProfile(deleteTarget))}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
