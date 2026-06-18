"use client"

import { useMemo, useState } from "react"
import { Loader2, Pencil, Pause, Play, Plus, Power, PowerOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import type { GrowthSenderAccount } from "@/lib/growth/sender/sender-types"
import {
  GROWTH_SENDER_POOL_ROTATION_STRATEGIES,
  memberStatusLabel,
  poolStatusLabel,
  rotationStrategyLabel,
  type GrowthSenderPool,
  type GrowthSenderPoolMember,
  type GrowthSenderRoutingInsight,
} from "@/lib/growth/sender-pools/sender-pool-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked" | "medium"> = {
  active: "healthy",
  draft: "neutral",
  paused: "attention",
  disabled: "blocked",
  eligible: "healthy",
  cooldown: "attention",
  paused_member: "neutral",
  blocked: "blocked",
  warming: "medium",
  degraded: "attention",
  healthy: "healthy",
  warning: "attention",
  critical: "critical",
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function domainFromEmail(email: string): string {
  const at = email.indexOf("@")
  return at > 0 ? email.slice(at + 1) : "—"
}

export function GrowthSenderPoolManagementPanel({
  pool,
  members,
  routingInsights,
  senders,
  actionLoading,
  onPatchPool,
  onAddMember,
  onRemoveMember,
  onPatchMember,
}: {
  pool: GrowthSenderPool
  members: GrowthSenderPoolMember[]
  routingInsights: GrowthSenderRoutingInsight[]
  senders: GrowthSenderAccount[]
  actionLoading: string | null
  onPatchPool: (patch: Record<string, unknown>) => Promise<void>
  onAddMember: (senderAccountId: string) => Promise<void>
  onRemoveMember: (memberId: string) => Promise<void>
  onPatchMember: (memberId: string, patch: Record<string, unknown>) => Promise<void>
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<GrowthSenderPoolMember | null>(null)
  const [priorityTarget, setPriorityTarget] = useState<GrowthSenderPoolMember | null>(null)
  const [priorityValue, setPriorityValue] = useState("100")
  const [addSenderId, setAddSenderId] = useState("")

  const [editName, setEditName] = useState(pool.name)
  const [editDescription, setEditDescription] = useState(pool.description)
  const [editStrategy, setEditStrategy] = useState(pool.rotationStrategy)
  const [editDailyCap, setEditDailyCap] = useState(pool.dailyPoolCap?.toString() ?? "")
  const [editMinCompliance, setEditMinCompliance] = useState(String(pool.minComplianceScore))
  const [editAllowAutoRotation, setEditAllowAutoRotation] = useState(pool.allowAutoRotation)
  const [editRequiresMailbox, setEditRequiresMailbox] = useState(pool.requiresMailbox)

  const memberSenderIds = new Set(members.map((m) => m.senderAccountId))
  const availableSenders = senders.filter((s) => !memberSenderIds.has(s.id) && s.status !== "disabled")

  const insightBySender = useMemo(() => {
    const map = new Map<string, GrowthSenderRoutingInsight>()
    for (const row of routingInsights) {
      if (row.sender_pool_id === pool.id || row.sender_pool_id == null) {
        map.set(row.sender_account_id, row)
      }
    }
    return map
  }, [routingInsights, pool.id])

  const senderById = useMemo(() => new Map(senders.map((s) => [s.id, s])), [senders])

  async function saveSettings() {
    await onPatchPool({
      name: editName.trim(),
      description: editDescription.trim(),
      rotationStrategy: editStrategy,
      dailyPoolCap: editDailyCap.trim() ? Number(editDailyCap) : null,
      minComplianceScore: Number(editMinCompliance) || 60,
      allowAutoRotation: editAllowAutoRotation,
      requiresMailbox: editRequiresMailbox,
    })
    setSettingsOpen(false)
  }

  async function savePriority() {
    if (!priorityTarget) return
    const parsed = Number.parseInt(priorityValue, 10)
    await onPatchMember(priorityTarget.id, { manualPriority: Number.isFinite(parsed) ? parsed : 100 })
    setPriorityTarget(null)
  }

  return (
    <div className="space-y-4">
      <GrowthEngineCard title={pool.name}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <GrowthBadge label={poolStatusLabel(pool.status)} tone={STATUS_TONE[pool.status] ?? "neutral"} />
              <span className="text-sm text-muted-foreground">{rotationStrategyLabel(pool.rotationStrategy)}</span>
              <span className="text-sm text-muted-foreground">{pool.memberCount} members</span>
            </div>
            {pool.description ? <p className="mt-2 text-sm text-muted-foreground">{pool.description}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(actionLoading) || pool.status === "active"}
              onClick={() => void onPatchPool({ status: "active" })}
            >
              <Play className="mr-1.5 size-3.5" />
              Activate pool
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(actionLoading) || pool.status === "paused"}
              onClick={() => void onPatchPool({ status: "paused" })}
            >
              <Pause className="mr-1.5 size-3.5" />
              Pause pool
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(actionLoading) || pool.status === "disabled"}
              onClick={() => void onPatchPool({ status: "disabled" })}
            >
              <PowerOff className="mr-1.5 size-3.5" />
              Disable pool
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit settings
            </Button>
          </div>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Pool members">
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border p-4">
          <div className="space-y-1.5 min-w-[200px]">
            <Label htmlFor="add-pool-sender">Add sender</Label>
            <Select value={addSenderId} onValueChange={setAddSenderId}>
              <SelectTrigger id="add-pool-sender">
                <SelectValue placeholder="Select sender" />
              </SelectTrigger>
              <SelectContent>
                {availableSenders.map((sender) => (
                  <SelectItem key={sender.id} value={sender.id}>
                    {sender.display_name} ({sender.email_address})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={Boolean(actionLoading) || !addSenderId}
            onClick={() => void onAddMember(addSenderId).then(() => setAddSenderId(""))}
          >
            {actionLoading === "add-member" ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
            Add sender
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Sender</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Domain</th>
                <th className="py-2 pr-3">Member status</th>
                <th className="py-2 pr-3">Health</th>
                <th className="py-2 pr-3">Routing score</th>
                <th className="py-2 pr-3">Daily cap</th>
                <th className="py-2 pr-3">Warmup</th>
                <th className="py-2 pr-3">Last selected</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-muted-foreground">
                    No members yet. Add a sender account to this pool.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const sender = senderById.get(member.senderAccountId)
                  const email = sender?.email_address ?? member.senderEmail
                  const insight = insightBySender.get(member.senderAccountId)
                  return (
                    <tr key={member.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">{sender?.display_name ?? member.senderLabel}</td>
                      <td className="py-2 pr-3">{email}</td>
                      <td className="py-2 pr-3">{domainFromEmail(email)}</td>
                      <td className="py-2 pr-3">
                        <GrowthBadge
                          label={memberStatusLabel(member.memberStatus)}
                          tone={STATUS_TONE[member.memberStatus] ?? "neutral"}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {insight ? (
                          <GrowthBadge
                            label={`${insight.mailbox_health_score} · ${insight.mailbox_health_state}`}
                            tone={STATUS_TONE[insight.mailbox_health_state] ?? "neutral"}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3">{insight?.routing_score ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {sender ? `${sender.daily_send_used}/${sender.daily_send_limit}` : "—"}
                      </td>
                      <td className="py-2 pr-3">{insight?.warmup_status ?? (sender?.warmup_enabled ? "warming" : "—")}</td>
                      <td className="py-2 pr-3">{formatWhen(member.lastSelectedAt)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {member.memberStatus === "paused" || member.memberStatus === "blocked" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={Boolean(actionLoading)}
                              onClick={() => void onPatchMember(member.id, { memberStatus: "eligible" })}
                            >
                              <Power className="mr-1 size-3.5" />
                              Resume
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={Boolean(actionLoading)}
                              onClick={() =>
                                void onPatchMember(member.id, {
                                  memberStatus: "paused",
                                  operationalPauseReason: "operator_pause",
                                })
                              }
                            >
                              <Pause className="mr-1 size-3.5" />
                              Pause
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={Boolean(actionLoading)}
                            onClick={() => {
                              setPriorityTarget(member)
                              setPriorityValue(String(member.manualPriority))
                            }}
                          >
                            Priority
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={Boolean(actionLoading)}
                            onClick={() => setRemoveTarget(member)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit pool settings</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Rotation strategy</Label>
              <Select value={editStrategy} onValueChange={(v) => setEditStrategy(v as typeof editStrategy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_SENDER_POOL_ROTATION_STRATEGIES.map((strategy) => (
                    <SelectItem key={strategy} value={strategy}>
                      {rotationStrategyLabel(strategy)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Daily pool cap</Label>
                <Input value={editDailyCap} onChange={(e) => setEditDailyCap(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label>Min compliance score</Label>
                <Input value={editMinCompliance} onChange={(e) => setEditMinCompliance(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={editAllowAutoRotation} onCheckedChange={(v) => setEditAllowAutoRotation(v === true)} />
              Allow auto rotation
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={editRequiresMailbox} onCheckedChange={(v) => setEditRequiresMailbox(v === true)} />
              Requires connected mailbox
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button type="button" disabled={Boolean(actionLoading)} onClick={() => void saveSettings()}>
              Save settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(priorityTarget)} onOpenChange={(open) => !open && setPriorityTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change priority</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Manual priority (0–10000)</Label>
            <Input value={priorityValue} onChange={(e) => setPriorityValue(e.target.value)} type="number" min={0} max={10000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPriorityTarget(null)}>Cancel</Button>
            <Button type="button" disabled={Boolean(actionLoading)} onClick={() => void savePriority()}>
              Save priority
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove sender from pool?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.senderLabel} will be removed from {pool.name}. This does not delete the sender account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(actionLoading)}
              onClick={() => {
                if (removeTarget) void onRemoveMember(removeTarget.id).then(() => setRemoveTarget(null))
              }}
            >
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
