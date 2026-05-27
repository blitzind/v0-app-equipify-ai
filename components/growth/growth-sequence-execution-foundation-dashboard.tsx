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
import { sequenceHealthTierLabel } from "@/lib/growth/sequences/sequence-health"
import { sequenceEnrollmentStatusLabel } from "@/lib/growth/sequences/sequence-state-machine"
import type {
  GrowthSequenceEnrollment,
  GrowthSequenceExecutionDashboard,
  GrowthSequenceExecutionEvent,
  GrowthSequenceTemplate,
} from "@/lib/growth/sequences/sequence-types"
import { GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER } from "@/lib/growth/sequences/sequence-types"
import type { GrowthAttributionRates } from "@/lib/growth/tracking/tracking-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked"> = {
  draft: "neutral",
  active: "healthy",
  paused: "attention",
  completed: "healthy",
  failed: "critical",
  cancelled: "blocked",
  archived: "blocked",
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
  templates?: GrowthSequenceTemplate[]
  enrollments?: GrowthSequenceEnrollment[]
  leads?: Array<{ id: string; label: string }>
  message?: string
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthSequenceExecutionDashboard
  templates?: GrowthSequenceTemplate[]
  enrollments?: GrowthSequenceEnrollment[]
  events?: GrowthSequenceExecutionEvent[]
  attribution_rates?: GrowthAttributionRates | null
  message?: string
}

const DEFAULT_STEPS = [
  { stepNumber: 1, channel: "email", delayDays: 0, generationType: "intro", approvalRequired: true },
  { stepNumber: 2, channel: "email", delayDays: 3, generationType: "followup", approvalRequired: true },
  { stepNumber: 3, channel: "manual_call", delayDays: 5, generationType: "manual", approvalRequired: true },
]

export function GrowthSequenceExecutionFoundationDashboard({
  highlightEnrollmentId,
  filterLeadId,
}: {
  highlightEnrollmentId?: string | null
  filterLeadId?: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthSequenceExecutionDashboard | null>(null)
  const [templates, setTemplates] = useState<GrowthSequenceTemplate[]>([])
  const [enrollments, setEnrollments] = useState<GrowthSequenceEnrollment[]>([])
  const [events, setEvents] = useState<GrowthSequenceExecutionEvent[]>([])
  const [attributionRates, setAttributionRates] = useState<GrowthAttributionRates | null>(null)
  const [leads, setLeads] = useState<Array<{ id: string; label: string }>>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState("outbound")
  const [enrollLeadId, setEnrollLeadId] = useState("")
  const [enrollTemplateId, setEnrollTemplateId] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<GrowthSequenceTemplate | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null,
    [templates, selectedTemplateId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [listRes, dashboardRes] = await Promise.all([
        fetch("/api/platform/growth/sequences"),
        fetch("/api/platform/growth/sequences/dashboard"),
      ])
      const listPayload = (await listRes.json()) as ListPayload
      const dashboardPayload = (await dashboardRes.json()) as DashboardPayload
      if (!listRes.ok) throw new Error(listPayload.message ?? "Could not load sequences.")
      if (!dashboardRes.ok) throw new Error(dashboardPayload.message ?? "Could not load sequence dashboard.")
      setTemplates(listPayload.templates ?? dashboardPayload.templates ?? [])
      setEnrollments(listPayload.enrollments ?? dashboardPayload.enrollments ?? [])
      setLeads(listPayload.leads ?? [])
      setDashboard(dashboardPayload.dashboard ?? null)
      setEvents(dashboardPayload.events ?? [])
      setAttributionRates(dashboardPayload.attribution_rates ?? null)
      if (!selectedTemplateId && (listPayload.templates?.length ?? 0) > 0) {
        setSelectedTemplateId(listPayload.templates![0].id)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load sequence execution.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (filterLeadId) setEnrollLeadId(filterLeadId)
  }, [filterLeadId])

  const visibleEnrollments = useMemo(
    () => (filterLeadId ? enrollments.filter((e) => e.leadId === filterLeadId) : enrollments),
    [enrollments, filterLeadId],
  )

  async function runAction(key: string, action: () => Promise<void>) {
    setActionLoading(key)
    setError(null)
    try {
      await action()
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Sequence action failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function createSequence() {
    const response = await fetch("/api/platform/growth/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        category: newCategory.trim() || null,
        approvalRequired: true,
        steps: DEFAULT_STEPS,
      }),
    })
    const payload = (await response.json()) as { message?: string; template?: GrowthSequenceTemplate }
    if (!response.ok) throw new Error(payload.message ?? "Could not create sequence.")
    if (payload.template) setSelectedTemplateId(payload.template.id)
    setNewName("")
  }

  async function enrollLead() {
    const response = await fetch("/api/platform/growth/sequences/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: enrollLeadId,
        sequenceTemplateId: enrollTemplateId,
        startImmediately: true,
      }),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not enroll lead.")
  }

  async function enrollmentAction(enrollmentId: string, action: "pause" | "resume" | "cancel") {
    const response = await fetch(`/api/platform/growth/sequences/${enrollmentId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "cancel" ? JSON.stringify({ reason: "cancelled by operator" }) : undefined,
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Enrollment action failed.")
  }

  async function deleteTemplate(template: GrowthSequenceTemplate) {
    const response = await fetch(`/api/platform/growth/sequences/${template.id}`, { method: "DELETE" })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not delete sequence.")
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading sequence execution foundation…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {filterLeadId ? (
        <p className="text-sm text-muted-foreground">
          Guided sequence scoped to lead <span className="font-mono">{filterLeadId.slice(0, 8)}…</span> — enrollment
          requires operator confirmation. No autonomous send.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER} · Orchestration only — human approval required, no sending or workers.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/sequences">Sequence Intelligence</Link>
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

      <GrowthEngineCard title="Sequence Health">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Draft" value={String(dashboard?.draft_count ?? 0)} />
          <StatTile label="Active" value={String(dashboard?.active_count ?? 0)} />
          <StatTile label="Paused" value={String(dashboard?.paused_count ?? 0)} />
          <StatTile label="Completed" value={String(dashboard?.completed_count ?? 0)} />
        </div>
      </GrowthEngineCard>

      {attributionRates ? (
        <GrowthEngineCard title="Sequence attribution (30d)">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Open %" value={`${attributionRates.openRate.toFixed(1)}%`} />
            <StatTile label="Click %" value={`${attributionRates.clickRate.toFixed(1)}%`} />
            <StatTile label="Reply %" value={`${attributionRates.replyRate.toFixed(1)}%`} />
            <StatTile label="Meeting %" value={`${attributionRates.meetingRate.toFixed(1)}%`} />
          </div>
        </GrowthEngineCard>
      ) : null}

      <GrowthEngineCard title="Live Execution Engine">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Outbound execution workers and provider dispatch are not enabled in this foundation phase.
          </p>
          <Button type="button" variant="outline" size="sm" disabled>
            Live Execution Engine
            <GrowthBadge label="Coming Soon" tone="neutral" className="ml-2" />
          </Button>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Templates">
        <div className="mb-4 grid gap-3 rounded-xl border border-dashed border-border p-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="sequence-name">Name</Label>
            <Input id="sequence-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Enterprise intro sequence" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sequence-category">Category</Label>
            <Input id="sequence-category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              disabled={Boolean(actionLoading) || !newName.trim()}
              onClick={() => void runAction("create", createSequence)}
            >
              <Plus className="mr-1.5 size-3.5" />
              Create Sequence
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Steps</th>
                <th className="px-2 py-2">Approval Required</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-muted-foreground">
                    No sequence templates yet. Create one to begin orchestration planning.
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr
                    key={template.id}
                    className={`border-b border-border/60 ${selectedTemplate?.id === template.id ? "bg-muted/30" : ""}`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <td className="px-2 py-3 font-medium">{template.name}</td>
                    <td className="px-2 py-3">{template.category ?? "—"}</td>
                    <td className="px-2 py-3">
                      <GrowthBadge label={template.status} tone={STATUS_TONE[template.status] ?? "neutral"} />
                    </td>
                    <td className="px-2 py-3">{template.step_count}</td>
                    <td className="px-2 py-3">
                      <GrowthBadge label={template.approval_required ? "Yes" : "No"} tone={template.approval_required ? "healthy" : "neutral"} />
                    </td>
                    <td className="px-2 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={Boolean(actionLoading)}
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeleteTarget(template)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Enrollments">
        <div className="mb-4 grid gap-3 rounded-xl border border-dashed border-border p-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="enroll-lead">Lead</Label>
            <Select value={enrollLeadId} onValueChange={setEnrollLeadId}>
              <SelectTrigger id="enroll-lead">
                <SelectValue placeholder="Select lead" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="enroll-template">Sequence</Label>
            <Select value={enrollTemplateId} onValueChange={setEnrollTemplateId}>
              <SelectTrigger id="enroll-template">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              disabled={Boolean(actionLoading) || !enrollLeadId || !enrollTemplateId}
              onClick={() => void runAction("enroll", enrollLead)}
            >
              Enroll Lead
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">Lead</th>
                <th className="px-2 py-2">Sequence</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Current Step</th>
                <th className="px-2 py-2">Next Step</th>
                <th className="px-2 py-2">Health</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-muted-foreground">
                    No enrollments yet. Enroll a lead into an active template.
                  </td>
                </tr>
              ) : (
                visibleEnrollments.map((enrollment) => (
                  <tr
                    key={enrollment.id}
                    id={`sequence-enrollment-${enrollment.id}`}
                    className={highlightEnrollmentId === enrollment.id ? "bg-indigo-50/50" : ""}
                  >
                    <td className="px-2 py-3 font-medium">{enrollment.lead_label}</td>
                    <td className="px-2 py-3">{enrollment.sequence_name}</td>
                    <td className="px-2 py-3">
                      <GrowthBadge
                        label={sequenceEnrollmentStatusLabel(enrollment.status)}
                        tone={STATUS_TONE[enrollment.status] ?? "neutral"}
                      />
                    </td>
                    <td className="px-2 py-3">{enrollment.current_step}</td>
                    <td className="px-2 py-3">{formatDate(enrollment.next_step_due_at)}</td>
                    <td className="px-2 py-3">
                      <GrowthBadge
                        label={`${sequenceHealthTierLabel(enrollment.health_tier)} · ${enrollment.health_score}`}
                        tone={STATUS_TONE[enrollment.health_tier] ?? "neutral"}
                      />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading) || enrollment.status !== "active"}
                          onClick={() => void runAction(`pause-${enrollment.id}`, () => enrollmentAction(enrollment.id, "pause"))}
                        >
                          Pause
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading) || (enrollment.status !== "paused" && enrollment.status !== "draft")}
                          onClick={() => void runAction(`resume-${enrollment.id}`, () => enrollmentAction(enrollment.id, "resume"))}
                        >
                          Resume
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading) || enrollment.status === "cancelled" || enrollment.status === "completed"}
                          onClick={() => void runAction(`cancel-${enrollment.id}`, () => enrollmentAction(enrollment.id, "cancel"))}
                        >
                          Cancel
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

      <GrowthEngineCard title="Step Viewer">
        {!selectedTemplate ? (
          <p className="text-sm text-muted-foreground">Select a template to view steps.</p>
        ) : (
          <div className="overflow-x-auto">
            <p className="mb-3 text-sm text-muted-foreground">{selectedTemplate.name}</p>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2">Step</th>
                  <th className="px-2 py-2">Delay</th>
                  <th className="px-2 py-2">Channel</th>
                  <th className="px-2 py-2">Approval</th>
                  <th className="px-2 py-2">Exit Conditions</th>
                </tr>
              </thead>
              <tbody>
                {(selectedTemplate.steps ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-muted-foreground">
                      Template has no steps loaded. Recreate or refresh.
                    </td>
                  </tr>
                ) : (
                  (selectedTemplate.steps ?? []).map((step) => (
                    <tr key={step.id} className="border-b border-border/60">
                      <td className="px-2 py-3">{step.step_number}</td>
                      <td className="px-2 py-3">{step.delay_days} days</td>
                      <td className="px-2 py-3">{step.channel}</td>
                      <td className="px-2 py-3">
                        <GrowthBadge label={step.approval_required ? "Required" : "Optional"} tone={step.approval_required ? "attention" : "neutral"} />
                      </td>
                      <td className="px-2 py-3 text-xs text-muted-foreground">
                        {selectedTemplate.exit_on_reply ? "Reply · " : ""}
                        {selectedTemplate.exit_on_meeting ? "Meeting · " : ""}
                        {selectedTemplate.exit_on_positive_intent ? "Positive intent" : ""}
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
          <p className="text-sm text-muted-foreground">No sequence execution events yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-lg border border-border/80 bg-background px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{event.title}</p>
                  <GrowthBadge label={event.severity} tone={SEVERITY_TONE[event.severity] ?? "neutral"} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.lead_label ? `${event.lead_label} · ` : ""}
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
            <AlertDialogTitle>Delete sequence template?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes {deleteTarget?.name}. Existing enrollments remain for audit — no outbound execution occurs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(actionLoading)}
              onClick={() => deleteTarget && void runAction(`delete-${deleteTarget.id}`, () => deleteTemplate(deleteTarget))}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
