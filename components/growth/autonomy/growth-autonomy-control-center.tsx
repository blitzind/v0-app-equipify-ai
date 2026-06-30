"use client"

import Link from "next/link"
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Bot,
  ClipboardList,
  Loader2,
  PauseCircle,
  Shield,
  Target,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { GrowthAutonomyOutboundDashboardPanel } from "@/components/growth/autonomy/growth-autonomy-outbound-dashboard-panel"
import { GrowthAutonomyAiOsIntegrationPanel } from "@/components/growth/autonomy/growth-autonomy-ai-os-integration-panel"
import type { GrowthAutonomySettingsViewModel } from "@/lib/growth/autonomy/growth-autonomy-settings-service"
import {
  countAllowedEntries,
  formatAllowedListSummary,
  GE_AUTO_UI_2_QA_MARKER,
  GROWTH_AUTONOMY_APPROVAL_OPERATOR_ROWS,
  GROWTH_AUTONOMY_BUDGET_OPERATOR_LABELS,
  GROWTH_AUTONOMY_CAPABILITY_OPERATOR_DESCRIPTIONS,
  GROWTH_AUTONOMY_CAPABILITY_OPERATOR_GROUPS,
  GROWTH_AUTONOMY_CAPABILITY_OPERATOR_LABELS,
  GROWTH_AUTONOMY_CONTROL_CENTER_SUBTITLE,
  GROWTH_AUTONOMY_CONTROL_CENTER_TITLE,
  GROWTH_AUTONOMY_KILL_SWITCH_OPERATOR_LABELS,
  GROWTH_AUTONOMY_OPERATING_MODE_OPERATOR_COPY,
  GROWTH_AUTONOMY_OUTBOUND_LOCKED_MESSAGE,
  resolveGrowthAutonomyOutboundStatusLabel,
} from "@/lib/growth/autonomy/growth-autonomy-operator-ui"
import type { GrowthAutonomyMasterMode } from "@/lib/growth/autonomy/growth-autonomy-types"
import { cn } from "@/lib/utils"

type AutonomySettingsResponse = {
  ok: boolean
  viewModel?: GrowthAutonomySettingsViewModel
  message?: string
}

const ENDPOINT = "/api/growth/workspace/settings/autonomy"

type CapabilityRow = GrowthAutonomySettingsViewModel["capabilities"][number]
type ChannelRow = GrowthAutonomySettingsViewModel["channels"][number]

export function GrowthAutonomyControlCenter({
  variant = "default",
}: {
  variant?: "default" | "operator"
}) {
  const isOperator = variant === "operator"
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

  const capabilityById = useMemo(() => {
    if (!viewModel) return new Map<string, CapabilityRow>()
    return new Map(viewModel.capabilities.map((capability) => [capability.id, capability]))
  }, [viewModel])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {isOperator ? "Loading autonomy settings…" : "Loading autonomy control center…"}
      </div>
    )
  }

  if (error && !viewModel) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!viewModel) {
    return <p className="text-sm text-destructive">Autonomy settings unavailable.</p>
  }

  const outboundStatus = resolveGrowthAutonomyOutboundStatusLabel(viewModel.status)
  const activeModeCopy = GROWTH_AUTONOMY_OPERATING_MODE_OPERATOR_COPY[viewModel.status.masterMode]

  return (
    <div
      className="w-full min-w-0 max-w-none space-y-6"
      data-qa-marker={GE_AUTO_UI_2_QA_MARKER}
      data-growth-autonomy-control-center
    >
      <Card className="border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-background to-background dark:border-violet-900/40 dark:from-violet-950/20">
        <CardHeader className="gap-4 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200">
                <Bot className="size-5" />
              </span>
              <div className="min-w-0">
                {!isOperator ? (
                  <>
                    <CardTitle className="text-2xl">{GROWTH_AUTONOMY_CONTROL_CENTER_TITLE}</CardTitle>
                    <CardDescription className="mt-1 text-sm">
                      {GROWTH_AUTONOMY_CONTROL_CENTER_SUBTITLE}
                    </CardDescription>
                  </>
                ) : (
                  <>
                    <CardTitle className="text-lg">Approval and safety</CardTitle>
                    <CardDescription className="mt-1 text-sm">
                      Quick actions and current operating status for your AI teammate.
                    </CardDescription>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                disabled={saving || viewModel.status.autonomyPaused}
                onClick={() => void savePatch({ emergencyStop: true })}
              >
                <PauseCircle className="mr-2 h-4 w-4" />
                Pause all autonomy
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/growth/objectives">
                  <Target className="mr-2 h-4 w-4" aria-hidden />
                  View objectives
                </Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/growth/activity">
                  <ClipboardList className="mr-2 h-4 w-4" aria-hidden />
                  {isOperator ? "Approval queue" : "View approval queue"}
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusChip label="Current mode" value={activeModeCopy.title} />
            <StatusChip label="Outbound" value={outboundStatus} />
            <StatusChip
              label="Emergency stop"
              value={viewModel.status.autonomyPaused ? "On" : "Off"}
              variant={viewModel.status.autonomyPaused ? "destructive" : "secondary"}
            />
          </div>
          {viewModel.status.autonomyPaused ? (
            <p className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Autonomy is paused — only manual actions run until you re-enable platform controls below.
            </p>
          ) : viewModel.status.masterMode === "manual" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 shrink-0" />
              Manual mode is active — raise the operating mode when you are ready for more automation.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <GrowthAutonomyOutboundDashboardPanel />

      {!isOperator ? <GrowthAutonomyAiOsIntegrationPanel integration={viewModel.aiOsIntegration} /> : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}

      <section className="space-y-4" aria-labelledby="autonomy-operating-mode-heading">
        <SectionHeading
          id="autonomy-operating-mode-heading"
          title="Operating mode"
          description={
            isOperator
              ? "Choose how independently your AI teammate can act on your behalf."
              : "Choose how independently AI OS can act on your behalf."
          }
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {viewModel.masterModes.map((mode) => {
            const copy = GROWTH_AUTONOMY_OPERATING_MODE_OPERATOR_COPY[mode.id]
            return (
              <button
                key={mode.id}
                type="button"
                disabled={saving}
                onClick={() => void savePatch({ masterMode: mode.id as GrowthAutonomyMasterMode })}
                className={cn(
                  "flex h-full flex-col rounded-xl border p-4 text-left transition hover:bg-muted/40 disabled:opacity-60",
                  mode.active && "border-violet-400 bg-violet-50/50 ring-1 ring-violet-300/60 dark:border-violet-700 dark:bg-violet-950/20",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{copy.title}</p>
                  {mode.active ? <Badge variant="secondary">Selected</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-foreground">{copy.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{copy.safetyNote}</p>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="autonomy-capabilities-heading">
        <SectionHeading
          id="autonomy-capabilities-heading"
          title="What your AI teammate can do"
          description="Turn capabilities on or off within your selected operating mode."
        />
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          {GROWTH_AUTONOMY_CAPABILITY_OPERATOR_GROUPS.map((group) => (
            <Card key={group.title}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{group.title}</CardTitle>
                <CardDescription className="text-xs">{group.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.ids.map((id) => {
                  const capability = capabilityById.get(id)
                  if (!capability) return null
                  return (
                    <CapabilityToggleRow
                      key={capability.id}
                      capability={capability}
                      saving={saving}
                      onToggle={(enabled) =>
                        void savePatch({ capabilityToggles: { [capability.id]: enabled } })
                      }
                    />
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Daily safety limits"
          description="Set small numbers while testing. You can raise them once results look right."
        />
        <Card>
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {viewModel.budgets.map((budget) => {
              const operatorLabel = GROWTH_AUTONOMY_BUDGET_OPERATOR_LABELS[budget.id]
              const usedToday = Math.max(0, budget.dailyLimit - budget.remaining)
              return (
                <div key={budget.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{operatorLabel}</p>
                    {budget.locked ? <Badge variant="outline">Locked</Badge> : null}
                  </div>
                  {budget.locked ? (
                    <p className="mt-2 text-xs text-muted-foreground">This limit is locked.</p>
                  ) : (
                    <>
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={10000}
                          defaultValue={budget.dailyLimit}
                          disabled={saving}
                          aria-label={`Daily limit for ${operatorLabel}`}
                          onBlur={(event) => {
                            const value = Number(event.target.value)
                            if (!Number.isFinite(value)) return
                            void savePatch({ dailyBudgetLimits: { [budget.id]: value } })
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {usedToday} used today · {budget.remaining} remaining
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">0 means off</p>
                    </>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Outreach controls"
          description="Prepare drafts by channel. Autonomous send stays gated until outbound autonomy is enabled."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          {viewModel.channels.map((channel) => (
            <ChannelControlCard key={channel.id} channel={channel} saving={saving} onSave={savePatch} />
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="autonomy-human-approval-heading">
        <SectionHeading
          id="autonomy-human-approval-heading"
          title="Human approval"
          description={
            isOperator
              ? "What runs automatically, what waits for you, and what never sends without explicit permission."
              : "Autonomous approval is disabled. AI OS can prepare work, but approval rules decide whether a person must review before anything goes out."
          }
        />
        {isOperator ? (
          <div className="grid gap-3 md:grid-cols-3">
            <HumanApprovalSummaryCard
              title="Runs automatically"
              tone="ready"
              items={GROWTH_AUTONOMY_APPROVAL_OPERATOR_ROWS.filter((row) => row.category === "internal").map(
                (row) => row.label,
              )}
              footnote="Within daily safety limits."
            />
            <HumanApprovalSummaryCard
              title="Needs your approval"
              tone="attention"
              items={GROWTH_AUTONOMY_APPROVAL_OPERATOR_ROWS.filter(
                (row) => row.category === "approval_required",
              ).map((row) => row.label)}
              footnote="Review before anything launches."
            />
            <HumanApprovalSummaryCard
              title="Never automatic"
              tone="neutral"
              items={GROWTH_AUTONOMY_APPROVAL_OPERATOR_ROWS.filter(
                (row) => row.category === "outbound_locked",
              ).map((row) => row.label)}
              footnote="Send stays off until you enable outbound autonomy."
            />
          </div>
        ) : null}
        <Card>
          <CardContent className="grid gap-3 pt-6 md:grid-cols-2">
            {GROWTH_AUTONOMY_APPROVAL_OPERATOR_ROWS.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.category === "internal"
                      ? "Internal action — runs within daily limits."
                      : row.category === "approval_required"
                        ? "Requires human approval before launch."
                        : "Send requires approval unless outbound autonomy is explicitly enabled."}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {row.category === "internal"
                    ? "Internal"
                    : row.category === "approval_required"
                      ? "Approval required"
                      : "Outbound gated"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" aria-labelledby="autonomy-shadow-mode-heading">
        <SectionHeading
          id="autonomy-shadow-mode-heading"
          title="Test without sending"
          description={
            isOperator
              ? "Practice mode lets your AI teammate decide what it would do, without sending or launching anything."
              : "Shadow mode lets AI OS decide what it would do, without actually sending or launching anything."
          }
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="font-medium">Enable shadow mode</p>
                <p className="text-xs text-muted-foreground">
                  Logs would-send, would-queue, and would-block decisions for review.
                </p>
              </div>
              <Switch
                checked={viewModel.outboundControls.shadowModeEnabled}
                disabled={saving}
                onCheckedChange={(enabled) => void savePatch({ outboundControls: { shadowModeEnabled: enabled } })}
              />
            </div>
            <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <li className="rounded-md border px-3 py-2">Would send — logged, not delivered</li>
              <li className="rounded-md border px-3 py-2">Would queue — logged for approval review</li>
              <li className="rounded-md border px-3 py-2">Would block — logged when policy stops action</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
        <AccordionItem value="platform-controls" className="border-none">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            Advanced platform controls
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <p className="text-xs text-muted-foreground">
              Platform-wide gates for autonomy execution. Change these only when you understand the impact.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {viewModel.killSwitches.map((killSwitch) => (
                <div
                  key={killSwitch.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {GROWTH_AUTONOMY_KILL_SWITCH_OPERATOR_LABELS[killSwitch.id]}
                    </p>
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
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

    </div>
  )
}

function HumanApprovalSummaryCard({
  title,
  tone,
  items,
  footnote,
}: {
  title: string
  tone: "ready" | "attention" | "neutral"
  items: string[]
  footnote: string
}) {
  const toneClass =
    tone === "ready"
      ? "border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
      : tone === "attention"
        ? "border-amber-200/70 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20"
        : "border-border/70 bg-muted/20"

  return (
    <div className={cn("rounded-xl border p-4", toneClass)}>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{footnote}</p>
    </div>
  )
}

function SectionHeading({
  id,
  title,
  description,
}: {
  id?: string
  title: string
  description: string
}) {
  return (
    <div>
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function StatusChip({
  label,
  value,
  variant = "secondary",
}: {
  label: string
  value: string
  variant?: "secondary" | "destructive" | "outline"
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={variant}>{value}</Badge>
    </div>
  )
}

function CapabilityToggleRow({
  capability,
  saving,
  onToggle,
}: {
  capability: CapabilityRow
  saving: boolean
  onToggle: (enabled: boolean) => void
}) {
  const operatorLabel = GROWTH_AUTONOMY_CAPABILITY_OPERATOR_LABELS[capability.id]
  const description = GROWTH_AUTONOMY_CAPABILITY_OPERATOR_DESCRIPTIONS[capability.id]

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{operatorLabel}</p>
          {capability.locked ? <Badge variant="outline">Locked</Badge> : null}
        </div>
        {capability.locked ? (
          <p className="text-xs text-muted-foreground">{GROWTH_AUTONOMY_OUTBOUND_LOCKED_MESSAGE}</p>
        ) : description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch
        checked={capability.enabled}
        disabled={saving || capability.locked || !capability.editable}
        onCheckedChange={onToggle}
      />
    </div>
  )
}

function ChannelControlCard({
  channel,
  saving,
  onSave,
}: {
  channel: ChannelRow
  saving: boolean
  onSave: (patch: Record<string, unknown>) => Promise<void>
}) {
  const channelTitle =
    channel.id === "voice" ? "Voice drops" : channel.label

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{channelTitle}</CardTitle>
          <Badge variant="outline">{channel.sendingLocked ? "Send locked" : "Send available"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleRow
            label="Prepare drafts"
            checked={channel.prepareEnabled}
            disabled={saving}
            onCheckedChange={(enabled) =>
              void onSave({
                channelPermissions: { [channel.id]: { enabled_for_prepare: enabled } },
              })
            }
          />
          <ToggleRow
            label="Send automatically"
            hint={channel.sendingLocked ? "Locked until outbound autonomy is enabled" : "Confidence-gated send"}
            checked={channel.sendEnabled}
            disabled={saving || channel.sendingLocked}
            onCheckedChange={(enabled) =>
              void onSave({
                channelPermissions: { [channel.id]: { enabled_for_send: enabled } },
              })
            }
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Daily send limit">
            <Input
              type="number"
              min={0}
              max={1000}
              defaultValue={channel.maxSendsPerDay}
              disabled={saving || channel.sendingLocked}
              onBlur={(event) => {
                const value = Number(event.target.value)
                if (!Number.isFinite(value)) return
                void onSave({
                  channelPermissions: { [channel.id]: { max_sends_per_day: Math.floor(value) } },
                })
              }}
            />
          </Field>
          <Field label="Minimum confidence">
            <Input
              type="number"
              min={0}
              max={100}
              defaultValue={channel.minimumSendConfidence}
              disabled={saving || channel.sendingLocked}
              onBlur={(event) => {
                const value = Number(event.target.value)
                if (!Number.isFinite(value)) return
                void onSave({
                  channelPermissions: { [channel.id]: { minimum_send_confidence: Math.floor(value) } },
                })
              }}
            />
          </Field>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <div className="rounded-md border px-3 py-2">
            <p className="text-xs text-muted-foreground">Approved senders</p>
            <p className="font-medium">{formatAllowedListSummary(channel.allowedSenderProfiles)}</p>
          </div>
          <div className="rounded-md border px-3 py-2">
            <p className="text-xs text-muted-foreground">Quiet hours (UTC)</p>
            <p className="font-medium">
              {channel.quietHoursEnabled
                ? `${channel.quietHoursStartUtc}:00 – ${channel.quietHoursEndUtc}:00`
                : "Off"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Quiet hours</p>
            <p className="text-xs text-muted-foreground">Pause autonomous outreach overnight</p>
          </div>
          <Switch
            checked={channel.quietHoursEnabled}
            disabled={saving}
            onCheckedChange={(enabled) =>
              void onSave({
                channelPermissions: { [channel.id]: { quiet_hours: { enabled } } },
              })
            }
          />
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="advanced" className="border-none">
            <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
              Advanced channel rules
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-1">
              <Field label="Daily prepare limit">
                <Input
                  type="number"
                  min={0}
                  max={1000}
                  defaultValue={channel.maxPreparedPerDay}
                  disabled={saving}
                  onBlur={(event) => {
                    const value = Number(event.target.value)
                    if (!Number.isFinite(value)) return
                    void onSave({
                      channelPermissions: { [channel.id]: { max_prepared_per_day: Math.floor(value) } },
                    })
                  }}
                />
              </Field>
              <Field label="Minimum prepare confidence">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={channel.minimumConfidenceScore}
                  disabled={saving}
                  onBlur={(event) => {
                    const value = Number(event.target.value)
                    if (!Number.isFinite(value)) return
                    void onSave({
                      channelPermissions: {
                        [channel.id]: { minimum_confidence_score: Math.floor(value) },
                      },
                    })
                  }}
                />
              </Field>

              <Accordion type="single" collapsible>
                <AccordionItem value="allowlists" className="border rounded-md px-3">
                  <AccordionTrigger className="py-2 text-xs hover:no-underline">
                    Advanced allowlists
                    {(countAllowedEntries(channel.allowedSenderProfiles) > 0 ||
                      countAllowedEntries(channel.allowedSequences) > 0 ||
                      countAllowedEntries(channel.allowedAudiences) > 0) && (
                      <Badge variant="secondary" className="ml-2">
                        Configured
                      </Badge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-3">
                    <Field label="Allowed sender profile IDs">
                      <Input
                        defaultValue={channel.allowedSenderProfiles}
                        disabled={saving}
                        placeholder="Comma-separated IDs"
                        onBlur={(event) => {
                          const allowed_sender_profiles = event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean)
                          void onSave({
                            channelPermissions: { [channel.id]: { allowed_sender_profiles } },
                          })
                        }}
                      />
                    </Field>
                    <Field label="Allowed sequence IDs">
                      <Input
                        defaultValue={channel.allowedSequences}
                        disabled={saving}
                        placeholder="Comma-separated IDs"
                        onBlur={(event) => {
                          const allowed_sequences = event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean)
                          void onSave({
                            channelPermissions: { [channel.id]: { allowed_sequences } },
                          })
                        }}
                      />
                    </Field>
                    <Field label="Allowed audience IDs">
                      <Input
                        defaultValue={channel.allowedAudiences}
                        disabled={saving}
                        placeholder="Comma-separated IDs"
                        onBlur={(event) => {
                          const allowed_audiences = event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean)
                          void onSave({
                            channelPermissions: { [channel.id]: { allowed_audiences } },
                          })
                        }}
                      />
                    </Field>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  )
}
