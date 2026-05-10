"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PRODUCTIVITY_PLAN_MESSAGE } from "@/lib/aiden/productivity-messages"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Audience = "internal" | "customer_safe"

export function WorkOrderAiServiceSummaryPanel(props: {
  organizationId: string
  workOrderId: string
  workOrderArchived?: boolean
  canEdit: boolean
  savedInternal?: string
  savedCustomer?: string
  onPersistSummaries: (patch: {
    internalServiceSummary?: string
    customerServiceSummary?: string
  }) => Promise<boolean>
}) {
  const { toast } = useToast()
  const [eligibilityReady, setEligibilityReady] = useState(false)
  const [productivityEnabled, setProductivityEnabled] = useState(false)
  const [draftAudience, setDraftAudience] = useState<Audience | null>(null)
  const [draftText, setDraftText] = useState("")
  const [draftFromAi, setDraftFromAi] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(props.organizationId)}/aiden/productivity/eligibility`,
          { method: "GET" },
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          productivityEnabled?: boolean
        }
        if (!cancelled) {
          setProductivityEnabled(Boolean(res.ok && data.ok && data.productivityEnabled))
          setEligibilityReady(true)
        }
      } catch {
        if (!cancelled) {
          setProductivityEnabled(false)
          setEligibilityReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [props.organizationId])

  useEffect(() => {
    setDraftAudience(null)
    setDraftText("")
    setDraftFromAi(false)
    setError(null)
  }, [props.workOrderId])

  const disabled =
    props.workOrderArchived ||
    !props.canEdit ||
    !productivityEnabled ||
    !eligibilityReady

  const runGenerate = useCallback(
    async (audience: Audience) => {
      if (disabled) return
      setGenerating(true)
      setError(null)
      setDraftAudience(audience)
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(props.organizationId)}/work-orders/${encodeURIComponent(props.workOrderId)}/ai-service-summary`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audience }),
          },
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          draftText?: string
          message?: string
          error?: string
        }
        if (!res.ok || !data.ok || typeof data.draftText !== "string") {
          throw new Error(data.message ?? data.error ?? "Could not generate summary.")
        }
        setDraftText(data.draftText)
        setDraftFromAi(true)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not generate summary."
        setError(msg)
        toast({ variant: "destructive", title: "Summary unavailable", description: msg })
      } finally {
        setGenerating(false)
      }
    },
    [disabled, props.organizationId, props.workOrderId, toast],
  )

  const saveDraft = useCallback(async () => {
    if (!draftAudience || props.workOrderArchived || !props.canEdit) return
    const trimmed = draftText.trim()
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Nothing to save",
        description: "Add text or generate a draft before saving.",
      })
      return
    }
    setSaveBusy(true)
    try {
      const patch =
        draftAudience === "internal" ?
          { internalServiceSummary: draftText }
        : { customerServiceSummary: draftText }
      const ok = await props.onPersistSummaries(patch)
      if (ok) {
        setDraftFromAi(false)
        toast({
          title: "Summary saved",
          description:
            draftAudience === "internal" ?
              "Internal summary is stored on this work order."
            : "Customer-safe summary is stored on this work order.",
        })
      }
    } finally {
      setSaveBusy(false)
    }
  }, [draftAudience, draftText, props, toast])

  if (!props.canEdit) {
    return null
  }

  if (!eligibilityReady) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin shrink-0" />
        Checking AI productivity access…
      </div>
    )
  }

  if (!productivityEnabled) {
    return (
      <div className="rounded-xl border border-border bg-muted/15 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AI service summaries</p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1">{PRODUCTIVITY_PLAN_MESSAGE}</p>
      </div>
    )
  }

  const savedInternal = props.savedInternal?.trim() ?? ""
  const savedCustomer = props.savedCustomer?.trim() ?? ""

  return (
    <div
      id="work-order-ai-service-summary-panel"
      className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
    >
      <div className="border-b border-border bg-muted/25 dark:bg-muted/10 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AI service summaries</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Generate a draft from this job&apos;s notes and context. Review and edit before saving — nothing is sent to customers
          automatically.
        </p>
      </div>
      <div className="px-4 py-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/80 bg-muted/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Saved internal</p>
            <p className="text-sm text-foreground whitespace-pre-wrap mt-1 min-h-[2.5rem]">
              {savedInternal ? savedInternal : <span className="text-muted-foreground">None saved yet.</span>}
            </p>
          </div>
          <div className="rounded-lg border border-border/80 bg-muted/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Saved customer-safe</p>
            <p className="text-sm text-foreground whitespace-pre-wrap mt-1 min-h-[2.5rem]">
              {savedCustomer ? savedCustomer : <span className="text-muted-foreground">None saved yet.</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs"
            disabled={disabled || generating}
            onClick={() => void runGenerate("internal")}
          >
            {generating && draftAudience === "internal" ?
              <Loader2 className="size-3.5 animate-spin" />
            : <Sparkles className="size-3.5" />}
            Generate internal
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs"
            disabled={disabled || generating}
            onClick={() => void runGenerate("customer_safe")}
          >
            {generating && draftAudience === "customer_safe" ?
              <Loader2 className="size-3.5 animate-spin" />
            : <Sparkles className="size-3.5" />}
            Generate customer-safe
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={disabled || generating || !draftAudience}
            onClick={() => draftAudience && void runGenerate(draftAudience)}
          >
            Regenerate
          </Button>
        </div>

        {error ?
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        : null}

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-foreground" htmlFor="wo-ai-summary-draft">
              Draft editor
            </label>
            {draftFromAi ?
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5",
                  "bg-amber-500/15 text-amber-900 dark:text-amber-100 border border-amber-500/25",
                )}
              >
                AI draft — not saved
              </span>
            : null}
            {draftAudience ?
              <span className="text-[10px] text-muted-foreground">
                Target: {draftAudience === "internal" ? "internal summary" : "customer-safe summary"}
              </span>
            : null}
          </div>
          <Textarea
            id="wo-ai-summary-draft"
            value={draftText}
            onChange={(e) => {
              setDraftText(e.target.value)
              if (draftFromAi) setDraftFromAi(true)
            }}
            rows={8}
            placeholder={
              generating ? "Generating…" : "Generate a draft or type a summary, then save to the work order."
            }
            disabled={props.workOrderArchived || generating}
            className="min-h-[160px] text-sm leading-relaxed"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={
              props.workOrderArchived || saveBusy || !draftAudience || !draftText.trim() || generating
            }
            onClick={() => void saveDraft()}
          >
            {saveBusy ? "Saving…" : "Save draft to work order"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            disabled={props.workOrderArchived || (!draftText && !draftAudience)}
            onClick={() => {
              setDraftText("")
              setDraftAudience(null)
              setDraftFromAi(false)
              setError(null)
            }}
          >
            Clear draft
          </Button>
        </div>
      </div>
    </div>
  )
}
