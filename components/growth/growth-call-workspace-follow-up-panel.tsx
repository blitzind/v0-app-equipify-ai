"use client"

import { useState } from "react"
import { Calendar, CheckCircle2, Loader2, Mail, MessageSquare, PhoneForwarded } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthPersonalizationEmbeddedPanel } from "@/components/growth/personalization/embedded/growth-personalization-embedded-panel"
import { GROWTH_CALL_WORKSPACE_OPS_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-operator-types"
import type { NativeCallWrapupPublicView } from "@/lib/growth/native-dialer/native-dialer-types"

type FollowUpKind = "schedule_callback" | "create_task" | "book_meeting" | "send_email_task" | "send_sms"

export function GrowthCallWorkspaceFollowUpPanel({
  wrapup,
  leadId,
  phoneNumber,
  contactName,
  companyName,
  onComplete,
}: {
  wrapup: NativeCallWrapupPublicView
  leadId?: string | null
  phoneNumber?: string | null
  contactName?: string | null
  companyName?: string | null
  onComplete: () => void
}) {
  const [activeKind, setActiveKind] = useState<FollowUpKind | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [callbackDate, setCallbackDate] = useState("")
  const [callbackTime, setCallbackTime] = useState("09:00")
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDueDate, setTaskDueDate] = useState("")
  const [meetingTitle, setMeetingTitle] = useState(`Meeting with ${companyName ?? contactName ?? "prospect"}`)
  const [meetingStart, setMeetingStart] = useState("")
  const [emailSubject, setEmailSubject] = useState(`Follow-up — ${companyName ?? "your conversation"}`)
  const [emailBody, setEmailBody] = useState(wrapup.notes || "")
  const [smsBody, setSmsBody] = useState("")

  async function submit(kind: FollowUpKind, body: Record<string, unknown>) {
    if (!leadId) {
      setMessage("Link a lead before executing follow-up actions.")
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/calls/workspace/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, leadId, ...body }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Follow-up action failed.")
      setMessage("Follow-up saved.")
      setActiveKind(null)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Follow-up action failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      className="rounded-xl border border-border/60 bg-muted/10 p-4 dark:border-white/5"
      data-growth-call-workspace-ops-marker={GROWTH_CALL_WORKSPACE_OPS_QA_MARKER}
      data-qa-action="call-workspace-follow-up-panel"
    >
      <div className="mb-3 flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
        <div>
          <h4 className="font-semibold">Execute follow-up</h4>
          <p className="text-sm text-muted-foreground">
            Complete next steps here — suggested actions from wrap-up remain operator-controlled.
          </p>
        </div>
      </div>

      {wrapup.suggestedNextActions.length > 0 ? (
        <ul className="mb-3 space-y-1 text-sm text-muted-foreground">
          {wrapup.suggestedNextActions.map((action) => (
            <li key={action}>• {action}</li>
          ))}
        </ul>
      ) : null}

      {leadId ? (
        <div className="mb-4">
          <GrowthPersonalizationEmbeddedPanel leadId={leadId} surface="call" compact />
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["schedule_callback", "Schedule callback", PhoneForwarded],
            ["create_task", "Create task", CheckCircle2],
            ["book_meeting", "Book meeting", Calendar],
            ["send_email_task", "Follow-up email", Mail],
            ["send_sms", "Follow-up SMS", MessageSquare],
          ] as const
        ).map(([kind, label, Icon]) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant={activeKind === kind ? "default" : "outline"}
            onClick={() => setActiveKind(kind)}
            disabled={loading}
          >
            <Icon className="mr-1.5 size-3.5" />
            {label}
          </Button>
        ))}
      </div>

      {activeKind === "schedule_callback" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input type="date" value={callbackDate} onChange={(e) => setCallbackDate(e.target.value)} />
          <Input type="time" value={callbackTime} onChange={(e) => setCallbackTime(e.target.value)} />
          <Button
            type="button"
            size="sm"
            className="sm:col-span-2"
            disabled={loading || !callbackDate || !phoneNumber}
            onClick={() =>
              void submit("schedule_callback", {
                phoneNumber,
                contactName,
                companyName,
                callbackAt: new Date(`${callbackDate}T${callbackTime}:00`).toISOString(),
              })
            }
          >
            Save callback
          </Button>
        </div>
      ) : null}

      {activeKind === "create_task" ? (
        <div className="space-y-2">
          <Input placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          <Input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
          <Button
            type="button"
            size="sm"
            disabled={loading || !taskTitle.trim()}
            onClick={() =>
              void submit("create_task", {
                title: taskTitle.trim(),
                dueAt: taskDueDate ? new Date(`${taskDueDate}T09:00:00`).toISOString() : null,
              })
            }
          >
            Create task
          </Button>
        </div>
      ) : null}

      {activeKind === "book_meeting" ? (
        <div className="space-y-2">
          <Input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} />
          <Input type="datetime-local" value={meetingStart} onChange={(e) => setMeetingStart(e.target.value)} />
          <Button
            type="button"
            size="sm"
            disabled={loading || !meetingTitle.trim() || !meetingStart}
            onClick={() =>
              void submit("book_meeting", {
                title: meetingTitle.trim(),
                startAt: new Date(meetingStart).toISOString(),
              })
            }
          >
            Book meeting
          </Button>
        </div>
      ) : null}

      {activeKind === "send_email_task" ? (
        <div className="space-y-2">
          <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
          <Textarea rows={4} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
          <Button
            type="button"
            size="sm"
            disabled={loading || !emailSubject.trim() || !emailBody.trim()}
            onClick={() =>
              void submit("send_email_task", {
                subject: emailSubject.trim(),
                body: emailBody.trim(),
              })
            }
          >
            Queue email task
          </Button>
        </div>
      ) : null}

      {activeKind === "send_sms" ? (
        <div className="space-y-2">
          <Textarea rows={3} placeholder="SMS message" value={smsBody} onChange={(e) => setSmsBody(e.target.value)} />
          <Button
            type="button"
            size="sm"
            disabled={loading || !smsBody.trim() || !phoneNumber}
            onClick={() =>
              void submit("send_sms", {
                toE164: phoneNumber,
                body: smsBody.trim(),
              })
            }
          >
            Send SMS
          </Button>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={onComplete}
          data-qa-action="call-workspace-skip-follow-up"
        >
          Skip follow-up &amp; next lead
        </Button>
        <Button type="button" size="sm" variant="default" disabled={loading} onClick={onComplete}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Continue to next lead
        </Button>
      </div>
    </section>
  )
}
