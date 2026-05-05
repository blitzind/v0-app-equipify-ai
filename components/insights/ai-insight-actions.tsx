"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import type { AiGeneratedInsightItem } from "@/lib/insights/openai-generate-insights"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Copy, Check } from "lucide-react"

type InsightCategory = AiGeneratedInsightItem["category"]

type ActionKind = "link" | "task" | "email" | "soon"

export type InsightActionSpec = {
  id: string
  label: string
  kind: ActionKind
  href?: string
  /** Presets default title/description for task modal */
  taskPreset?: "follow_up" | "warranty_review" | "service_reminder" | "dispatch_follow_up"
}

const CATEGORY_ACTIONS: Record<InsightCategory, InsightActionSpec[]> = {
  revenue: [
    { id: "task_followup", label: "Create follow-up task", kind: "task", taskPreset: "follow_up" },
    { id: "draft_email", label: "Draft customer email", kind: "email" },
    { id: "unpaid", label: "Review unpaid invoices", kind: "link", href: "/invoices?status=Unpaid" },
    { id: "invoices", label: "Open related invoices", kind: "link", href: "/invoices" },
  ],
  operations: [
    { id: "work_orders", label: "Open related work orders", kind: "link", href: "/work-orders" },
    { id: "assign_tech", label: "Assign technician", kind: "link", href: "/technicians" },
    { id: "schedule", label: "Schedule job", kind: "link", href: "/service-schedule" },
    { id: "dispatch_task", label: "Create dispatch task", kind: "link", href: "/dispatch" },
  ],
  maintenance: [
    { id: "plans", label: "Open maintenance plans", kind: "link", href: "/maintenance-plans" },
    { id: "pm_wo", label: "Generate PM work orders", kind: "link", href: "/service-schedule" },
    { id: "overdue", label: "Review overdue plans", kind: "link", href: "/maintenance-plans" },
  ],
  warranty: [
    { id: "warranty_alerts", label: "Open warranty alerts", kind: "soon" },
    { id: "covered", label: "Review covered equipment", kind: "link", href: "/equipment" },
    { id: "warranty_task", label: "Create warranty review task", kind: "task", taskPreset: "warranty_review" },
  ],
  customer: [
    { id: "customers", label: "Open customer record", kind: "link", href: "/customers" },
    { id: "draft_followup", label: "Draft follow-up email", kind: "email" },
    { id: "reminder_task", label: "Create service reminder", kind: "task", taskPreset: "service_reminder" },
  ],
  technician: [
    { id: "schedule_dispatch", label: "Open technician schedule", kind: "link", href: "/technicians?dispatch=1" },
    { id: "reassign", label: "Reassign workload", kind: "link", href: "/technicians" },
    { id: "dispatch_note", label: "Create dispatch note", kind: "soon" },
  ],
}

function taskDefaults(
  preset: NonNullable<InsightActionSpec["taskPreset"]>,
  item: AiGeneratedInsightItem,
): { title: string; description: string } {
  const base = [item.insight, "", `Recommended: ${item.recommendedAction}`].join("\n")
  switch (preset) {
    case "warranty_review":
      return {
        title: `Warranty review: ${item.title}`,
        description: base,
      }
    case "service_reminder":
      return {
        title: `Service reminder: ${item.title}`,
        description: base,
      }
    case "dispatch_follow_up":
      return {
        title: `Dispatch follow-up: ${item.title}`,
        description: base,
      }
    default:
      return {
        title: `Follow-up: ${item.title}`,
        description: base,
      }
  }
}

function ComingSoonButton({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex max-w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="h-7 text-[11px] font-medium px-2 border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed max-w-full truncate"
          >
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Coming soon</TooltipContent>
    </Tooltip>
  )
}

export function AiInsightActions({
  organizationId,
  insightIndex,
  item,
}: {
  organizationId: string | null
  insightIndex: number
  item: AiGeneratedInsightItem
}) {
  const { toast } = useToast()
  const actions = CATEGORY_ACTIONS[item.category]

  const [taskOpen, setTaskOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDescription, setTaskDescription] = useState("")
  const [taskDue, setTaskDue] = useState("")
  const [taskSaving, setTaskSaving] = useState(false)

  const [emailOpen, setEmailOpen] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [copied, setCopied] = useState(false)

  const openTaskModal = useCallback(
    (preset: NonNullable<InsightActionSpec["taskPreset"]>) => {
      const d = taskDefaults(preset, item)
      setTaskTitle(d.title)
      setTaskDescription(d.description)
      setTaskDue("")
      setTaskOpen(true)
    },
    [item],
  )

  const submitTask = useCallback(async () => {
    if (!organizationId) {
      toast({ title: "Organization required", description: "Select an organization first.", variant: "destructive" })
      return
    }
    const title = taskTitle.trim()
    if (!title) {
      toast({ title: "Title required", description: "Add a short title for the task.", variant: "destructive" })
      return
    }
    setTaskSaving(true)
    try {
      const res = await fetch("/api/insights/org-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          title,
          description: taskDescription.trim(),
          sourceType: "ai_insight",
          sourceId: String(insightIndex),
          status: "open",
          dueDate: taskDue.trim() || null,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok) {
        toast({
          title: "Could not create task",
          description: data.message ?? data.error ?? "Request failed.",
          variant: "destructive",
        })
        return
      }
      toast({ title: "Task created", description: "Your reminder was saved for this organization." })
      setTaskOpen(false)
    } catch (e) {
      toast({
        title: "Could not create task",
        description: e instanceof Error ? e.message : "Request failed.",
        variant: "destructive",
      })
    } finally {
      setTaskSaving(false)
    }
  }, [organizationId, taskTitle, taskDescription, taskDue, insightIndex, toast])

  const loadDraftEmail = useCallback(async () => {
    if (!organizationId) {
      toast({ title: "Organization required", description: "Select an organization first.", variant: "destructive" })
      return
    }
    setEmailOpen(true)
    setEmailLoading(true)
    setEmailSubject("")
    setEmailBody("")
    try {
      const res = await fetch("/api/insights/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          insightTitle: item.title,
          insightCategory: item.category,
          insightText: item.insight,
          recommendedAction: item.recommendedAction,
          relatedMetric: item.relatedMetric,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        subject?: string
        body?: string
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        toast({
          title: "Could not draft email",
          description: data.message ?? data.error ?? "Request failed.",
          variant: "destructive",
        })
        setEmailOpen(false)
        return
      }
      setEmailSubject(data.subject ?? "")
      setEmailBody(data.body ?? "")
    } catch (e) {
      toast({
        title: "Could not draft email",
        description: e instanceof Error ? e.message : "Request failed.",
        variant: "destructive",
      })
      setEmailOpen(false)
    } finally {
      setEmailLoading(false)
    }
  }, [organizationId, item, toast])

  const copyEmail = useCallback(async () => {
    const text = `Subject: ${emailSubject}\n\n${emailBody}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({ title: "Copied", description: "Email draft copied to clipboard." })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Copy failed", description: "Select and copy the text manually.", variant: "destructive" })
    }
  }, [emailSubject, emailBody, toast])

  const actionButtons = useMemo(() => {
    return actions.map((spec) => {
      if (spec.kind === "soon") {
        return <ComingSoonButton key={spec.id} label={spec.label} />
      }
      if (spec.kind === "link" && spec.href) {
        return (
          <Button key={spec.id} variant="outline" size="sm" className="h-7 text-[11px] font-medium px-2 border-zinc-200 bg-white" asChild>
            <Link href={spec.href}>{spec.label}</Link>
          </Button>
        )
      }
      if (spec.kind === "task" && spec.taskPreset) {
        return (
          <Button
            key={spec.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px] font-medium px-2 border-zinc-200 bg-white"
            onClick={() => openTaskModal(spec.taskPreset!)}
          >
            {spec.label}
          </Button>
        )
      }
      if (spec.kind === "email") {
        return (
          <Button
            key={spec.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px] font-medium px-2 border-zinc-200 bg-white"
            onClick={() => void loadDraftEmail()}
          >
            {spec.label}
          </Button>
        )
      }
      return null
    })
  }, [actions, loadDraftEmail, openTaskModal])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mt-3 pt-3 border-t border-zinc-100">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-2">Actions</p>
        <div className="flex flex-wrap gap-1.5">{actionButtons}</div>
      </div>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
            <DialogDescription>
              This saves an internal reminder for your organization. Nothing is sent automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor={`task-title-${insightIndex}`}>Title</Label>
              <Input
                id={`task-title-${insightIndex}`}
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`task-desc-${insightIndex}`}>Description</Label>
              <Textarea
                id={`task-desc-${insightIndex}`}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={5}
                className="text-sm resize-y min-h-[100px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`task-due-${insightIndex}`}>Due date (optional)</Label>
              <Input
                id={`task-due-${insightIndex}`}
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setTaskOpen(false)} disabled={taskSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitTask()} disabled={taskSaving}>
              {taskSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Draft email</DialogTitle>
            <DialogDescription>
              AI-generated copy for you to review. Messages are not sent from Equipify.
            </DialogDescription>
          </DialogHeader>
          {emailLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Drafting…
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Subject</Label>
                <p className="text-sm font-medium text-zinc-900 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">{emailSubject}</p>
              </div>
              <div className="space-y-1">
                <Label>Body</Label>
                <Textarea readOnly value={emailBody} rows={12} className="text-sm font-sans resize-y min-h-[200px]" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={() => void copyEmail()} disabled={emailLoading || !emailBody}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
