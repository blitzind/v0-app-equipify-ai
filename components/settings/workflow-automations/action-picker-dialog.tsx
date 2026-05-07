"use client"

/**
 * Workflow Automations Phase 2 — grouped action picker.
 *
 * Modal for selecting an action to add to the visual stack. Cards are
 * grouped by "internal vs customer-facing" to nudge managers toward
 * safe automations (notify staff, create task) before customer-touching
 * ones (send email, send sms — flagged with the autoSafe warning).
 *
 * Phase 2 also reserves a "Coming soon" tier for future engine work
 * (webhooks, scheduled reminders, branching) — these cards are
 * disabled and clearly labelled so the roadmap is visible without
 * shipping unfinished engine features.
 */

import { useMemo, useState } from "react"
import {
  Bell,
  Bot,
  ChevronRight,
  Clock,
  GitBranch,
  ListChecks,
  Mail,
  MessageSquare,
  Search,
  ShieldAlert,
  UserCheck,
  Webhook,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ACTION_CATALOG, ACTION_CATALOG_ORDER, actionFitsTrigger } from "@/lib/workflows/action-catalog"
import type { WorkflowActionType, WorkflowTriggerType } from "@/lib/workflows/types"
import { cn } from "@/lib/utils"

const ACTION_ICONS: Record<WorkflowActionType, LucideIcon> = {
  notify_internal_user: Bell,
  send_email: Mail,
  send_sms: MessageSquare,
  assign_technician: UserCheck,
  update_status: Wrench,
  create_followup_task: ListChecks,
  create_work_order: Wrench,
  create_ai_task: Bot,
}

type ComingSoon = {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

const COMING_SOON: ComingSoon[] = [
  {
    id: "webhook",
    label: "Send webhook",
    description: "Forward the trigger payload to an external HTTPS endpoint (Phase 3).",
    icon: Webhook,
  },
  {
    id: "schedule_reminder",
    label: "Schedule reminder",
    description: "Wait N days, then run a follow-up step (Phase 3 delayed actions).",
    icon: Clock,
  },
  {
    id: "branch_condition",
    label: "Conditional branch",
    description: "Run different actions based on a runtime check (Phase 3 branches).",
    icon: GitBranch,
  },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerType: WorkflowTriggerType
  onPick: (type: WorkflowActionType) => void
}

export function ActionPickerDialog({ open, onOpenChange, triggerType, onPick }: Props) {
  const [query, setQuery] = useState("")

  const groups = useMemo(() => {
    const internal: WorkflowActionType[] = []
    const operational: WorkflowActionType[] = []
    const customerFacing: WorkflowActionType[] = []
    for (const id of ACTION_CATALOG_ORDER) {
      const meta = ACTION_CATALOG[id]
      if (meta.id === "send_email" || meta.id === "send_sms") {
        customerFacing.push(id)
      } else if (meta.id === "notify_internal_user" || meta.id === "create_followup_task") {
        internal.push(id)
      } else {
        operational.push(id)
      }
    }
    return [
      { title: "Internal — safe to auto-run", ids: internal },
      { title: "Operational", ids: operational },
      { title: "Customer-facing — review before enabling", ids: customerFacing },
    ]
  }, [])

  const q = query.trim().toLowerCase()
  const filterMatch = (label: string, description: string) =>
    !q || label.toLowerCase().includes(q) || description.toLowerCase().includes(q)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add an action</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actions…"
              className="h-9 pl-8 text-sm"
              autoFocus
            />
          </div>

          {groups.map((group) => {
            const cards = group.ids
              .map((id) => ({ id, meta: ACTION_CATALOG[id] }))
              .filter(({ meta }) => filterMatch(meta.label, meta.description))
            if (cards.length === 0) return null
            return (
              <section key={group.title} className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  {group.title}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cards.map(({ id, meta }) => {
                    const Icon = ACTION_ICONS[id]
                    const fits = actionFitsTrigger(id, triggerType)
                    const tone =
                      meta.availability === "live"
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                        : meta.availability === "logged"
                          ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                          : "border-border text-muted-foreground"
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onPick(id)}
                        className="text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-colors p-3 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 shrink-0">
                            <Icon className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <span className="text-sm font-semibold text-foreground truncate">{meta.label}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                          {meta.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <Badge variant="outline" className={cn("text-[10px]", tone)}>
                            {meta.availability === "live"
                              ? "Live"
                              : meta.availability === "logged"
                                ? "Logged only"
                                : "Coming soon"}
                          </Badge>
                          {!meta.autoSafe ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300"
                            >
                              <ShieldAlert className="w-3 h-3" /> Sends to customers
                            </Badge>
                          ) : null}
                          {!fits ? (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Unusual fit
                            </Badge>
                          ) : null}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}

          <section className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Coming soon — Phase 3
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {COMING_SOON.filter((c) => filterMatch(c.label, c.description)).map((c) => {
                const Icon = c.icon
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-dashed border-border bg-muted/20 p-3 flex flex-col gap-1.5 opacity-80"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted shrink-0">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-semibold text-foreground truncate">{c.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{c.description}</p>
                    <Badge variant="outline" className="text-[10px] self-start">
                      Coming soon
                    </Badge>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
