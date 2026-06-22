"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Play, Plus } from "lucide-react"
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
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthWarmupProfile } from "@/lib/growth/warmup/warmup-types"
import {
  GROWTH_WARMUP_EXECUTOR_QA_MARKER,
  GROWTH_WARMUP_RECIPIENT_TYPES,
  type GrowthWarmupExecutorRunResult,
  type GrowthWarmupProfileExecutorStats,
  type GrowthWarmupRecipient,
} from "@/lib/growth/warmup/warmup-executor-types"

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

type GrowthWarmupExecutorPanelProps = {
  profiles: GrowthWarmupProfile[]
}

export function GrowthWarmupExecutorPanel({ profiles }: GrowthWarmupExecutorPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recipients, setRecipients] = useState<GrowthWarmupRecipient[]>([])
  const [schemaReady, setSchemaReady] = useState(false)
  const [executorStats, setExecutorStats] = useState<GrowthWarmupProfileExecutorStats[]>([])
  const [preview, setPreview] = useState<GrowthWarmupExecutorRunResult | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [newEmail, setNewEmail] = useState("")
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<(typeof GROWTH_WARMUP_RECIPIENT_TYPES)[number]>("internal")
  const [newDailyCap, setNewDailyCap] = useState("3")
  const [newWeeklyCap, setNewWeeklyCap] = useState("10")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [recipientsRes, dashboardRes] = await Promise.all([
        fetch("/api/platform/growth/warmup/recipients"),
        fetch("/api/platform/growth/warmup/dashboard"),
      ])
      const recipientsPayload = (await recipientsRes.json()) as {
        recipients?: GrowthWarmupRecipient[]
        schema_ready?: boolean
      }
      const dashboardPayload = (await dashboardRes.json()) as {
        executor_stats?: GrowthWarmupProfileExecutorStats[]
      }
      setRecipients(recipientsPayload.recipients ?? [])
      setSchemaReady(Boolean(recipientsPayload.schema_ready))
      setExecutorStats(dashboardPayload.executor_stats ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load warmup executor.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addRecipient() {
    setActionLoading("add-recipient")
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/warmup/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          recipient_type: newType,
          approved: true,
          active: true,
          max_emails_per_day: Number.parseInt(newDailyCap, 10) || 3,
          max_emails_per_week: Number.parseInt(newWeeklyCap, 10) || 10,
        }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Could not add recipient.")
      setNewEmail("")
      setNewName("")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add recipient.")
    } finally {
      setActionLoading(null)
    }
  }

  async function toggleRecipient(recipient: GrowthWarmupRecipient, field: "active" | "approved", value: boolean) {
    setActionLoading(`toggle-${recipient.id}`)
    try {
      const response = await fetch(`/api/platform/growth/warmup/recipients/${recipient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      if (!response.ok) throw new Error("Could not update recipient.")
      await load()
    } finally {
      setActionLoading(null)
    }
  }

  async function loadPreview() {
    setActionLoading("preview")
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/warmup/executor/preview", { method: "POST" })
      const payload = (await response.json()) as { preview?: GrowthWarmupExecutorRunResult; message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Preview failed.")
      setPreview(payload.preview ?? null)
      setConfirmOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function runBatch() {
    setActionLoading("run")
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/warmup/executor/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Warmup batch failed.")
      setConfirmOpen(false)
      setPreview(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Warmup batch failed.")
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading warmup executor…
      </div>
    )
  }

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_WARMUP_EXECUTOR_QA_MARKER}>
      {!schemaReady ? (
        <GrowthEngineCard title="Warmup executor">
          <p className="text-sm text-muted-foreground">
            Apply migration <code className="text-xs">20270925120000_growth_warmup_executor_1a.sql</code> to enable
            automated warmup sends and recipient management.
          </p>
        </GrowthEngineCard>
      ) : null}

      <GrowthEngineCard title="Warmup executor">
        <p className="mb-4 text-xs text-muted-foreground">
          Sends low-volume, human-safe warmup emails from connected senders to approved recipients. No peer network. No
          fake replies. Hourly cron during business hours (UTC 13–21).
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={Boolean(actionLoading)} onClick={() => void loadPreview()}>
            <Play className="mr-1 size-3.5" />
            Run Warmup Batch
          </Button>
        </div>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        <div className="space-y-3">
          {executorStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No executor stats yet.</p>
          ) : (
            executorStats.map((stat) => (
              <div key={stat.profileId} className="rounded-lg border border-border/60 p-3 text-sm">
                <div className="font-medium">{stat.senderEmail}</div>
                <p className="mt-1 text-muted-foreground">
                  Today: {stat.realOutboundCounted} real + {stat.executorSendsToday} warmup = {stat.sendsToday} /{" "}
                  {stat.plannedToday} complete
                  {stat.remainingToday > 0 ? ` · ${stat.remainingToday} remaining` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last executor run: {formatDate(stat.lastExecutorRunAt)} · Active recipients:{" "}
                  {stat.recipientPoolActive}
                  {stat.pausedOrThrottled ? " · Paused/throttled" : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Approved warmup recipients">
        <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          Only add recipients who have agreed to receive warmup/test messages or are internal/owned inboxes.
        </p>
        <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="warmup-recipient-email">Email</Label>
            <Input
              id="warmup-recipient-email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="colleague@company.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="warmup-recipient-name">Name</Label>
            <Input id="warmup-recipient-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROWTH_WARMUP_RECIPIENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Daily cap</Label>
            <Input value={newDailyCap} onChange={(e) => setNewDailyCap(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Weekly cap</Label>
            <Input value={newWeeklyCap} onChange={(e) => setNewWeeklyCap(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              disabled={!newEmail || Boolean(actionLoading) || !schemaReady}
              onClick={() => void addRecipient()}
            >
              <Plus className="mr-1 size-3.5" />
              Add recipient
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Caps</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Last sent</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-muted-foreground">
                    No approved warmup recipients yet.
                  </td>
                </tr>
              ) : (
                recipients.map((recipient) => (
                  <tr key={recipient.id} className="border-b border-border/60">
                    <td className="px-2 py-2">
                      <div className="font-medium">{recipient.email}</div>
                      <div className="text-xs text-muted-foreground">{recipient.name || recipient.label}</div>
                    </td>
                    <td className="px-2 py-2">{recipient.recipient_type}</td>
                    <td className="px-2 py-2">
                      {recipient.max_emails_per_day}/day · {recipient.max_emails_per_week}/week
                    </td>
                    <td className="px-2 py-2">
                      <GrowthBadge
                        label={recipient.active && recipient.approved ? "approved" : "inactive"}
                        tone={recipient.active && recipient.approved ? "healthy" : "attention"}
                      />
                    </td>
                    <td className="px-2 py-2">{formatDate(recipient.last_sent_at)}</td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={Boolean(actionLoading)}
                        onClick={() => void toggleRecipient(recipient, "active", !recipient.active)}
                      >
                        {recipient.active ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run warmup batch?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {preview ? (
                  <>
                    <p>
                      Would send up to {preview.sendsSucceeded || preview.senderResults.reduce((s, r) => s + r.sent, 0)}{" "}
                      warmup message(s) across {preview.profilesScanned} warming profile(s).
                    </p>
                    {preview.skipReasons.length > 0 ? (
                      <ul className="list-disc pl-4 text-muted-foreground">
                        {preview.skipReasons.map((skip) => (
                          <li key={skip.code}>{skip.message}</li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p>Preview unavailable.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" disabled={Boolean(actionLoading)} onClick={() => void runBatch()}>
              Confirm send
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
