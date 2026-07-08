"use client"

/**
 * AI Ops Phase 5 — command center drawer: lifecycle, timeline, comms context,
 * AI explanation, and approval-gated operational actions.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"
import type { Recommendation, RecommendationLifecycleState } from "@/lib/ai-ops/types"
import type { OperationalActionId } from "@/lib/ai-ops/operational-action-ids"
import { AiExplainPanel } from "./ai-explain-panel"
import { DraftFollowupDialog } from "./draft-followup-dialog"
import { buildAutomationSuggestion, suggestionUrl } from "./automation-suggestion"
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
} from "./category-meta"

type TimelineRow = {
  id: string
  eventType: string
  outcome: string | null
  createdAt: string
  synthetic?: boolean
}

const LIFECYCLE_OPTIONS: RecommendationLifecycleState[] = [
  "pending",
  "acknowledged",
  "in_progress",
  "completed",
  "ignored",
  "escalated",
]

function mapEntityToCommunicationQuery(rec: Recommendation): {
  entityType: string
  entityId: string
} | null {
  const e = rec.entity
  if (!e) return null
  if (
    e.type === "invoice" ||
    e.type === "work_order" ||
    e.type === "equipment" ||
    e.type === "customer" ||
    e.type === "prospect"
  ) {
    return { entityType: e.type === "work_order" ? "work_order" : e.type, entityId: e.id }
  }
  return null
}

export function AiOpsCommandCenterDrawer({
  open,
  onOpenChange,
  rec,
  organizationId,
  generatedAtIso,
  canCommand,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  rec: Recommendation | null
  organizationId: string | null
  generatedAtIso: string | null
  canCommand: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { permissions } = useOrgPermissions()
  const [lifecycleDraft, setLifecycleDraft] = useState<RecommendationLifecycleState>("pending")
  const [lifecycleSaving, setLifecycleSaving] = useState(false)
  const [timeline, setTimeline] = useState<TimelineRow[]>([])
  const [comms, setComms] = useState<Array<{ id: string; title: string; summary: string | null; createdAt: string }>>(
    [],
  )
  const [members, setMembers] = useState<Array<{ userId: string; fullName: string | null; email: string | null }>>([])
  const [techDraft, setTechDraft] = useState("")
  const [invoiceEmailDraft, setInvoiceEmailDraft] = useState("")
  const [draftFollowOpen, setDraftFollowOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<OperationalActionId | null>(null)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    if (!rec) return
    setLifecycleDraft(rec.lifecycleState ?? "pending")
  }, [rec])

  const commQuery = useMemo(() => (rec ? mapEntityToCommunicationQuery(rec) : null), [rec])

  const loadContext = useCallback(async () => {
    if (!organizationId || !rec) return
    const keyEnc = encodeURIComponent(rec.key)
    const timelineUrl =
      `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/recommendations/${keyEnc}/timeline` +
      (generatedAtIso ? `?surfacedAt=${encodeURIComponent(generatedAtIso)}` : "")
    try {
      const [tlRes, feedRes, teamRes] = await Promise.all([
        fetch(timelineUrl, {
          cache: "no-store",
        }),
        commQuery
          ? fetch(
              `/api/organizations/${encodeURIComponent(organizationId)}/communications/feed?entityType=${encodeURIComponent(
                commQuery.entityType,
              )}&entityId=${encodeURIComponent(commQuery.entityId)}&limit=8`,
              { cache: "no-store" },
            )
          : Promise.resolve(null),
        canCommand && rec.entity?.type === "work_order"
          ? fetch(`/api/team/members?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
          : Promise.resolve(null),
      ])
      const tlBody = (await tlRes.json()) as {
        ok?: boolean
        synthetic?: Array<{ id: string; eventType: string; outcome: string | null; createdAt: string }>
        events?: Array<{ id: string; eventType: string; outcome: string | null; createdAt: string }>
      }
      const merged: TimelineRow[] = []
      if (tlBody.ok && tlBody.synthetic) {
        for (const s of tlBody.synthetic) {
          merged.push({
            id: s.id,
            eventType: s.eventType,
            outcome: s.outcome,
            createdAt: s.createdAt,
            synthetic: true,
          })
        }
      }
      if (tlBody.ok && tlBody.events) {
        for (const e of tlBody.events) {
          merged.push({
            id: e.id,
            eventType: e.eventType,
            outcome: e.outcome,
            createdAt: e.createdAt,
          })
        }
      }
      merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      setTimeline(merged)

      if (feedRes && feedRes.ok) {
        const fb = (await feedRes.json()) as {
          items?: Array<{ id: string; title: string; summary: string | null; created_at: string }>
        }
        setComms(
          (fb.items ?? []).slice(0, 8).map((c) => ({
            id: c.id,
            title: c.title,
            summary: c.summary,
            createdAt: c.created_at,
          })),
        )
      } else {
        setComms([])
      }

      if (teamRes && teamRes.ok) {
        const tb = (await teamRes.json()) as {
          members?: Array<{ userId: string; fullName: string | null; email: string | null; role: string }>
        }
        const techLike = (tb.members ?? []).filter((m) =>
          ["tech", "owner", "admin", "manager"].includes(m.role),
        )
        setMembers(techLike.map((m) => ({ userId: m.userId, fullName: m.fullName, email: m.email })))
      }
    } catch {
      setTimeline([])
      setComms([])
    }
  }, [organizationId, rec, generatedAtIso, commQuery, canCommand])

  useEffect(() => {
    if (open && rec && organizationId) void loadContext()
  }, [open, rec, organizationId, loadContext])

  async function saveLifecycle() {
    if (!organizationId || !rec || !canCommand) return
    setLifecycleSaving(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/recommendations/${encodeURIComponent(rec.key)}/lifecycle`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: lifecycleDraft,
            category: rec.category,
          }),
        },
      )
      const body = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok) throw new Error(body.message ?? "Could not save lifecycle.")
      toast({ title: "Lifecycle updated" })
      void loadContext()
    } catch (e) {
      toast({
        title: "Could not save lifecycle",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setLifecycleSaving(false)
    }
  }

  async function runExecute(action: OperationalActionId) {
    if (!organizationId || !rec || !canCommand) return
    setExecuting(true)
    try {
      const payload: Record<string, string> = {}
      if (action === "assign_technician" && techDraft) payload.technicianUserId = techDraft
      if (action === "send_invoice_reminder" && invoiceEmailDraft.trim()) {
        payload.recipientEmail = invoiceEmailDraft.trim()
      }
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/recommendations/${encodeURIComponent(rec.key)}/execute-action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            confirm: true as const,
            payload: Object.keys(payload).length ? payload : undefined,
          }),
        },
      )
      const body = (await res.json()) as {
        ok?: boolean
        effect?: { kind: string; url?: string; action?: string; summary?: string }
        message?: string
      }
      if (!res.ok) throw new Error(body.message ?? "Action failed.")
      const eff = body.effect
      if (eff?.kind === "redirect" && eff.url) {
        toast({ title: "Continuing in workflow", description: eff.summary })
        router.push(eff.url)
      } else if (eff?.kind === "client" && eff.action === "draft_followup") {
        setDraftFollowOpen(true)
        toast({ title: "Draft follow-up", description: eff.summary })
      } else {
        toast({ title: "Done", description: eff?.summary ?? "Action completed." })
      }
      setPendingAction(null)
      void loadContext()
    } catch (e) {
      toast({
        title: "Action blocked",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setExecuting(false)
    }
  }

  const automationSuggestion = rec ? buildAutomationSuggestion(rec) : null

  const actionHints = useMemo(() => {
    if (!rec) return []
    const list: Array<{ id: OperationalActionId; label: string; detail: string }> = []
    if (permissions.canEditInvoices && rec.entity?.type === "invoice") {
      list.push({
        id: "send_invoice_reminder",
        label: "Send invoice reminder email",
        detail:
          "Emails the customer using your invoice template. This updates invoice status when applicable.",
      })
    }
    list.push({
      id: "create_follow_up_task",
      label: "Create follow-up task",
      detail: "Adds an internal org task sourced from this recommendation.",
    })
    if (permissions.canManageAutomations && automationSuggestion) {
      list.push({
        id: "create_workflow_automation",
        label: "Open workflow automation builder",
        detail: "Deep-links to automations with a suggested trigger — you still save manually.",
      })
    }
    if (permissions.canEditWorkOrders && rec.entity?.type === "work_order") {
      list.push({
        id: "assign_technician",
        label: "Assign technician",
        detail: "Sets the work order assignee to the selected team member.",
      })
    }
    if (permissions.canConsumePartsOnWorkOrders && rec.entity?.type === "inventory_stock") {
      list.push({
        id: "restock_inventory",
        label: "Record restock request",
        detail: "Logs a reorder signal on the inventory ledger without changing on-hand counts.",
      })
    }
    if (permissions.canReleaseCertificatesToPortal && rec.entity?.type === "calibration_record") {
      list.push({
        id: "release_certificate",
        label: "Release certificate to portal",
        detail: "Sets portal release so the customer can access the certificate.",
      })
    }
    if (permissions.canManageDispatch || permissions.canEditWorkOrders) {
      list.push({
        id: "schedule_maintenance",
        label: "Schedule maintenance",
        detail: "Opens maintenance planning with equipment/customer context when available.",
      })
    }
    if (permissions.canManageProspects && rec.entity?.type === "prospect") {
      list.push({
        id: "draft_prospect_followup",
        label: "Draft prospect follow-up",
        detail: "Opens the AI draft composer — nothing sends automatically.",
      })
    }
    return list
  }, [rec, permissions, automationSuggestion])

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg flex flex-col gap-0 p-0 border-border bg-background"
        >
          {!rec ? null : (
            <>
              <SheetHeader className="border-b border-border shrink-0 px-6 py-5 space-y-2">
                <SheetTitle className="text-left text-base leading-snug pr-8">{rec.title}</SheetTitle>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {PRIORITY_LABEL[rec.priority]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {CATEGORY_LABEL[rec.category]}
                  </Badge>
                  {rec.lifecycleState ? (
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {rec.lifecycleState.replace("_", " ")}
                    </Badge>
                  ) : null}
                  {rec.commandScore != null ? (
                    <Badge variant="outline" className="text-[10px] tabular-nums">
                      Score {rec.commandScore}
                    </Badge>
                  ) : null}
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="px-6 py-6 space-y-6">
                  {rec.commandScoreBreakdown?.length ? (
                    <section className="rounded-lg border border-border bg-muted/20 px-5 py-4">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">
                        Priority score (explainable)
                      </p>
                      <ul className="space-y-1 text-[11px]">
                        {rec.commandScoreBreakdown.map((b) => (
                          <li key={b.label} className="flex justify-between gap-2">
                            <span className="text-muted-foreground">{b.label}</span>
                            <span className="tabular-nums font-medium">{b.points > 0 ? "+" : ""}{b.points}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {canCommand ? (
                    <section className="space-y-2.5">
                      <Label className="text-xs font-semibold">Lifecycle</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={lifecycleDraft}
                          onValueChange={(v) => setLifecycleDraft(v as RecommendationLifecycleState)}
                        >
                          <SelectTrigger className="h-9 text-xs flex-1 min-w-[10rem]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LIFECYCLE_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs capitalize">
                                {s.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          className="h-9"
                          disabled={lifecycleSaving}
                          onClick={() => void saveLifecycle()}
                        >
                          Save
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        Snooze/dismiss from the card menu still applies separately — lifecycle tracks operator workflow only.
                      </p>
                    </section>
                  ) : null}

                  {rec.entity ? (
                    <section className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Related record</p>
                      <Link
                        href={rec.entity.href}
                        className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {rec.entity.label}
                      </Link>
                    </section>
                  ) : null}

                  {commQuery && comms.length > 0 ? (
                    <section className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Recent communications
                      </p>
                      <ul className="space-y-2">
                        {comms.map((c) => (
                          <li
                            key={c.id}
                            className="rounded-md border border-border bg-muted/15 px-2 py-1.5 text-[11px]"
                          >
                            <p className="font-medium text-foreground">{c.title}</p>
                            {c.summary ? (
                              <p className="text-muted-foreground line-clamp-2">{c.summary}</p>
                            ) : null}
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(c.createdAt).toLocaleString()}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {automationSuggestion ? (
                    <section className="rounded-lg border border-dashed border-border px-3 py-2 space-y-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Workflow suggestion
                      </p>
                      <p className="text-xs text-foreground">{automationSuggestion.description}</p>
                      {permissions.canManageAutomations ? (
                        <Button asChild size="sm" variant="outline" className="h-8 w-full text-xs">
                          <Link href={suggestionUrl(organizationId, automationSuggestion)}>
                            Open automation builder
                          </Link>
                        </Button>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">
                          Ask an owner, admin, or manager to configure automations.
                        </p>
                      )}
                    </section>
                  ) : null}

                  <section className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">AI explanation</p>
                    {organizationId ? <AiExplainPanel rec={rec} organizationId={organizationId} /> : null}
                  </section>

                  {canCommand && actionHints.length > 0 ? (
                    <section className="space-y-3 border-t border-border pt-6">
                      <div>
                        <p className="text-xs font-semibold text-foreground">Operational actions</p>
                        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                          Every action requires confirmation below. Customer-facing email sends only when you explicitly confirm — Equipify never sends autonomously from AI Ops.
                        </p>
                      </div>

                      {rec.entity?.type === "work_order" ? (
                        <div className="space-y-1">
                          <Label className="text-[11px]">Assignee (for assign action)</Label>
                          <Select value={techDraft} onValueChange={setTechDraft}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Choose team member" />
                            </SelectTrigger>
                            <SelectContent>
                              {members.map((m) => (
                                <SelectItem key={m.userId} value={m.userId} className="text-xs">
                                  {m.fullName || m.email || "Member"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      {rec.entity?.type === "invoice" ? (
                        <div className="space-y-1">
                          <Label className="text-[11px]">Override recipient email (optional)</Label>
                          <Input
                            className="h-9 text-xs"
                            placeholder="Defaults to customer billing email"
                            value={invoiceEmailDraft}
                            onChange={(e) => setInvoiceEmailDraft(e.target.value)}
                          />
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-2">
                        {actionHints.map((a) => (
                          <Button
                            key={a.id}
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-auto py-2 flex-col items-start text-left gap-0.5"
                            onClick={() => setPendingAction(a.id)}
                          >
                            <span className="text-xs font-semibold">{a.label}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">{a.detail}</span>
                          </Button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className="space-y-3 border-t border-border pt-6">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Operational timeline
                    </p>
                    {timeline.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">No events logged yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {timeline.map((row) => (
                          <li
                            key={`${row.id}-${row.createdAt}`}
                            className={cn(
                              "rounded-md border px-2 py-1.5 text-[11px]",
                              row.synthetic ? "border-violet-500/30 bg-violet-500/[0.06]" : "border-border bg-muted/15",
                            )}
                          >
                            <p className="font-medium capitalize">{row.eventType.replace(/_/g, " ")}</p>
                            {row.outcome ? (
                              <p className="text-muted-foreground">Outcome: {row.outcome}</p>
                            ) : null}
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(row.createdAt).toLocaleString()}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={pendingAction !== null} onOpenChange={(v) => !v && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm operational action</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This runs immediately after you confirm. Customer-facing emails require explicit approval — you are responsible for the recipient and contents shown in Equipify.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={executing || !pendingAction}
              onClick={(e) => {
                e.preventDefault()
                if (pendingAction) void runExecute(pendingAction)
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rec && organizationId ? (
        <DraftFollowupDialog
          open={draftFollowOpen}
          onOpenChange={setDraftFollowOpen}
          rec={rec}
          organizationId={organizationId}
        />
      ) : null}
    </>
  )
}
