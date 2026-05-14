"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, ChevronLeft, Loader2 } from "lucide-react"
import { AidenWordmark } from "@/components/aiden/aiden-wordmark"
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
import { Textarea } from "@/components/ui/textarea"
import type { AidenChatMessage } from "@/lib/aiden/aiden-response-rules"
import { cn } from "@/lib/utils"

export type AidenFrFormValues = {
  title: string
  description: string
  moduleContext: string
  priority: "low" | "medium" | "high" | "urgent"
  userNotes: string
}

type Step = "form" | "review" | "success"

type AidenFeatureRequestFlowProps = {
  organizationId: string
  /** Bump when opening the flow so fields reset from initialValues. */
  sessionNonce: number
  initialValues: AidenFrFormValues
  currentPath: string
  chatMessagesForContext: AidenChatMessage[]
  onCancel: () => void
  onSuccess: (result: { requestId: string | null; duplicate: boolean }) => void
}

const PRIORITY_LABEL: Record<AidenFrFormValues["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

export function AidenFeatureRequestFlow({
  organizationId,
  sessionNonce,
  initialValues,
  currentPath,
  chatMessagesForContext,
  onCancel,
  onSuccess,
}: AidenFeatureRequestFlowProps) {
  const [step, setStep] = useState<Step>("form")
  const [values, setValues] = useState<AidenFrFormValues>(initialValues)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultMeta, setResultMeta] = useState<{ duplicate: boolean; requestId: string | null } | null>(null)

  useEffect(() => {
    setValues(initialValues)
    setStep("form")
    setError(null)
    setSubmitting(false)
    setResultMeta(null)
  }, [sessionNonce, initialValues])

  function update<K extends keyof AidenFrFormValues>(key: K, v: AidenFrFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  function goReview() {
    const t = values.title.trim()
    const d = values.description.trim()
    if (!t || !d) {
      setError("Add a title and description before continuing.")
      return
    }
    setError(null)
    setStep("review")
  }

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/aiden/feature-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual: {
            title: values.title.trim(),
            description: values.description.trim(),
            moduleContext: values.moduleContext.trim() || null,
            module: values.moduleContext.trim() || null,
            currentPath: currentPath || null,
            priority: values.priority,
            userNotes: values.userNotes.trim() || null,
          },
          chatContext: chatMessagesForContext.slice(-8),
          currentPath,
          module: values.moduleContext.trim() || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        duplicate?: boolean
        requestId?: string
        message?: string
        error?: string
      }
      if (!res.ok || data.ok === false) {
        throw new Error(data.message ?? data.error ?? "Could not submit feature request.")
      }
      const dup = Boolean(data.duplicate)
      setResultMeta({ duplicate: dup, requestId: data.requestId ?? null })
      setStep("success")
      onSuccess({ requestId: data.requestId ?? null, duplicate: dup })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-sky-500/25 bg-card p-4 shadow-xs",
        step === "success" ? "border-emerald-500/30 bg-emerald-500/5" : "",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Feature request · <AidenWordmark size="sm" />
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Sent to the Equipify team for review — not an operational change in your workspace.
          </p>
        </div>
        {step !== "success" ? (
          <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={onCancel}>
            Close
          </Button>
        ) : null}
      </div>

      {step === "form" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="aiden-fr-title">Title</Label>
            <Input
              id="aiden-fr-title"
              value={values.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Short summary of the idea"
              maxLength={120}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aiden-fr-desc">Description</Label>
            <Textarea
              id="aiden-fr-desc"
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="What would this solve? Who benefits?"
              className="min-h-[88px] resize-y text-sm"
              maxLength={4000}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aiden-fr-module">Module / page</Label>
            <Input
              id="aiden-fr-module"
              value={values.moduleContext}
              onChange={(e) => update("moduleContext", e.target.value)}
              placeholder="e.g. Work Orders"
              maxLength={200}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aiden-fr-priority">Impact</Label>
            <Select
              value={values.priority}
              onValueChange={(v) => update("priority", v as AidenFrFormValues["priority"])}
              disabled={submitting}
            >
              <SelectTrigger id="aiden-fr-priority" className="w-full">
                <SelectValue placeholder="Impact" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABEL) as AidenFrFormValues["priority"][]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aiden-fr-notes">Optional notes</Label>
            <Textarea
              id="aiden-fr-notes"
              value={values.userNotes}
              onChange={(e) => update("userNotes", e.target.value)}
              placeholder="Constraints, integrations, examples…"
              className="min-h-[64px] resize-y text-sm"
              maxLength={2000}
              disabled={submitting}
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={goReview} disabled={submitting}>
              Review
            </Button>
          </div>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="space-y-3 text-sm">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1 px-2 text-xs"
            onClick={() => setStep("form")}
            disabled={submitting}
          >
            <ChevronLeft size={14} aria-hidden />
            Edit
          </Button>
          <dl className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
            <div>
              <dt className="font-medium text-muted-foreground">Title</dt>
              <dd className="text-foreground">{values.title.trim()}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Description</dt>
              <dd className="whitespace-pre-wrap text-foreground">{values.description.trim()}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Module / page</dt>
              <dd className="text-foreground">{values.moduleContext.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Impact</dt>
              <dd className="text-foreground">{PRIORITY_LABEL[values.priority]}</dd>
            </div>
            {values.userNotes.trim() ? (
              <div>
                <dt className="font-medium text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-wrap text-foreground">{values.userNotes.trim()}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-muted-foreground">Page path</dt>
              <dd>
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{currentPath || "/"}</code>
              </dd>
            </div>
          </dl>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setStep("form")} disabled={submitting}>
              Back
            </Button>
            <Button type="button" size="sm" onClick={() => void submit()} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "success" ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">
              {resultMeta?.duplicate
                ? "We already have a very similar request from you."
                : "Thanks — your request was recorded."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {resultMeta?.duplicate && resultMeta.requestId
                ? `Reference id: ${resultMeta.requestId}`
                : "The team reviews product feedback regularly. Your chat above is unchanged."}
            </p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            Continue chatting
          </Button>
        </div>
      ) : null}
    </div>
  )
}
