"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Loader2, PauseCircle } from "lucide-react"
import { GrowthAutonomyStatusBanner } from "@/components/growth/autonomy/growth-autonomy-status-banner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { GrowthAutonomySettingsViewModel } from "@/lib/growth/autonomy/growth-autonomy-settings-service"
import { GROWTH_AUTONOMY_QA_MARKER } from "@/lib/growth/autonomy/growth-autonomy-types"
import type { GrowthAutonomyMasterMode } from "@/lib/growth/autonomy/growth-autonomy-types"

type AutonomySettingsResponse = {
  ok: boolean
  viewModel?: GrowthAutonomySettingsViewModel
  message?: string
}

const ENDPOINT = "/api/growth/workspace/settings/autonomy"

export function GrowthAutonomySettingsPanel() {
  const [viewModel, setViewModel] = useState<GrowthAutonomySettingsViewModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(ENDPOINT, { cache: "no-store" })
      const body = (await response.json()) as AutonomySettingsResponse
      if (!response.ok || !body.ok || !body.viewModel) {
        throw new Error(body.message ?? "Could not load autonomy settings.")
      }
      setViewModel(body.viewModel)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load autonomy settings.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const savePatch = useCallback(async (patch: Record<string, unknown>) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(ENDPOINT, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const body = (await response.json()) as AutonomySettingsResponse
      if (!response.ok || !body.ok || !body.viewModel) {
        throw new Error(body.message ?? "Could not save autonomy settings.")
      }
      setViewModel(body.viewModel)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save autonomy settings.")
    } finally {
      setSaving(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading autonomy settings…
      </div>
    )
  }

  if (error && !viewModel) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!viewModel) {
    return <p className="text-sm text-destructive">Autonomy settings unavailable.</p>
  }

  return (
    <div className="space-y-6">
      <GrowthAutonomyStatusBanner compact />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        {viewModel.notice}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Emergency stop</CardTitle>
            <CardDescription>Immediately pause all autonomous internal actions.</CardDescription>
          </div>
          <Button
            variant="destructive"
            disabled={saving || viewModel.status.autonomyPaused}
            onClick={() => void savePatch({ emergencyStop: true })}
          >
            <PauseCircle className="mr-2 h-4 w-4" />
            Pause all autonomy
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Master mode</CardTitle>
          <CardDescription>Select the organization autonomy level.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {viewModel.masterModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              disabled={saving}
              onClick={() => void savePatch({ masterMode: mode.id as GrowthAutonomyMasterMode })}
              className="flex items-start justify-between gap-4 rounded-md border p-3 text-left transition hover:bg-muted/40 disabled:opacity-60"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{mode.label}</p>
                  {mode.active ? <Badge variant="secondary">Active</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{mode.description}</p>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
          <CardDescription>Enable safe internal autonomous capabilities.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {viewModel.capabilities.map((capability) => (
            <div
              key={capability.id}
              className="flex items-center justify-between gap-4 rounded-md border p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{capability.label}</p>
                  {capability.locked ? <Badge variant="outline">Locked</Badge> : null}
                </div>
                {capability.lockReason ? (
                  <p className="text-xs text-muted-foreground">{capability.lockReason}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{capability.approvalPolicyLabel}</p>
                )}
              </div>
              <Switch
                checked={capability.enabled}
                disabled={saving || capability.locked || !capability.editable}
                onCheckedChange={(enabled) =>
                  void savePatch({ capabilityToggles: { [capability.id]: enabled } })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channel prepare controls</CardTitle>
          <CardDescription>
            Growth Engine may prepare this channel, but cannot send without human approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {viewModel.channels.map((channel) => (
            <div key={channel.id} className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{channel.label}</p>
                    <Badge variant="outline">Sending locked</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Prepare drafts only — operator approval required before every send.
                  </p>
                </div>
                <Switch
                  checked={channel.prepareEnabled}
                  disabled={saving}
                  onCheckedChange={(enabled) =>
                    void savePatch({
                      channelPermissions: {
                        [channel.id]: { enabled_for_prepare: enabled },
                      },
                    })
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Daily prepare limit</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    defaultValue={channel.maxPreparedPerDay}
                    disabled={saving}
                    onBlur={(event) => {
                      const value = Number(event.target.value)
                      if (!Number.isFinite(value)) return
                      void savePatch({
                        channelPermissions: {
                          [channel.id]: { max_prepared_per_day: Math.floor(value) },
                        },
                      })
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Minimum confidence score</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={channel.minimumConfidenceScore}
                    disabled={saving}
                    onBlur={(event) => {
                      const value = Number(event.target.value)
                      if (!Number.isFinite(value)) return
                      void savePatch({
                        channelPermissions: {
                          [channel.id]: { minimum_confidence_score: Math.floor(value) },
                        },
                      })
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Allowed sender profiles (comma-separated IDs)</Label>
                  <Input
                    defaultValue={channel.allowedSenderProfiles}
                    disabled={saving}
                    onBlur={(event) => {
                      const allowed_sender_profiles = event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean)
                      void savePatch({
                        channelPermissions: { [channel.id]: { allowed_sender_profiles } },
                      })
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Allowed sequences (comma-separated IDs)</Label>
                  <Input
                    defaultValue={channel.allowedSequences}
                    disabled={saving}
                    onBlur={(event) => {
                      const allowed_sequences = event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean)
                      void savePatch({
                        channelPermissions: { [channel.id]: { allowed_sequences } },
                      })
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Allowed audiences (comma-separated IDs)</Label>
                  <Input
                    defaultValue={channel.allowedAudiences}
                    disabled={saving}
                    onBlur={(event) => {
                      const allowed_audiences = event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean)
                      void savePatch({
                        channelPermissions: { [channel.id]: { allowed_audiences } },
                      })
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Quiet hours (UTC)</p>
                    <p className="text-xs text-muted-foreground">
                      {channel.quietHoursStartUtc}:00 – {channel.quietHoursEndUtc}:00
                    </p>
                  </div>
                  <Switch
                    checked={channel.quietHoursEnabled}
                    disabled={saving}
                    onCheckedChange={(enabled) =>
                      void savePatch({
                        channelPermissions: {
                          [channel.id]: { quiet_hours: { enabled } },
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budgets</CardTitle>
          <CardDescription>Daily caps for autonomous safe actions. Zero disables the budget.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {viewModel.budgets.map((budget) => (
            <div key={budget.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{budget.label}</p>
                {budget.locked ? <Badge variant="outline">Locked</Badge> : null}
              </div>
              {budget.locked ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Outbound autonomy budget is locked until a later phase.
                </p>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={10000}
                    defaultValue={budget.dailyLimit}
                    disabled={saving}
                    onBlur={(event) => {
                      const value = Number(event.target.value)
                      if (!Number.isFinite(value)) return
                      void savePatch({ dailyBudgetLimits: { [budget.id]: value } })
                    }}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {budget.remaining} left today
                  </span>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kill switches</CardTitle>
          <CardDescription>Platform gates for autonomy execution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {viewModel.killSwitches.map((killSwitch) => (
            <div
              key={killSwitch.id}
              className="flex items-center justify-between gap-4 rounded-md border p-3"
            >
              <div className="flex items-center gap-2">
                <p className="font-medium">{killSwitch.label}</p>
                {killSwitch.locked ? <Badge variant="outline">Locked</Badge> : null}
              </div>
              <Switch
                checked={killSwitch.enabled}
                disabled={saving || killSwitch.locked || !killSwitch.editable}
                onCheckedChange={(enabled) =>
                  void savePatch({
                    killSwitches: {
                      [killSwitch.id]: enabled,
                    },
                  })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approval policies</CardTitle>
          <CardDescription>All capabilities require human approval in GE-AUTO-1B.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {viewModel.capabilities.map((capability) => (
            <div key={capability.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{capability.label}</span>
              <Badge variant="outline">{capability.approvalPolicyLabel}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        <AlertTriangle className="h-3 w-3" />
        QA marker: {GROWTH_AUTONOMY_QA_MARKER}
      </div>
    </div>
  )
}
