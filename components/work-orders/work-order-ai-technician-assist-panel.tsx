"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Copy, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRODUCTIVITY_PLAN_MESSAGE } from "@/lib/aiden/productivity-messages"
import type { WorkOrderTechnicianAssistAi } from "@/lib/work-orders/technician-assist-schema"
import { formatTechnicianGuidancePlainText } from "@/lib/work-orders/technician-assist-schema"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function BulletSection({
  title,
  items,
  onCopy,
  copyBusy,
}: {
  title: string
  items: string[]
  onCopy: () => void
  copyBusy: boolean
}) {
  if (!items.length) return null
  return (
    <div className="rounded-lg border border-border/80 bg-muted/10 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[10px] gap-1 shrink-0"
          onClick={() => onCopy()}
          disabled={copyBusy}
        >
          <Copy className="size-3" />
          Copy
        </Button>
      </div>
      <ul className="list-disc pl-4 text-sm text-foreground space-y-1.5 leading-relaxed">
        {items.map((s, i) => (
          <li key={`${title}-${i}`}>{s}</li>
        ))}
      </ul>
    </div>
  )
}

export function WorkOrderAiTechnicianAssistPanel(props: {
  organizationId: string
  workOrderId: string
  workOrderArchived?: boolean
  canEdit: boolean
}) {
  const { toast } = useToast()
  const [eligibilityReady, setEligibilityReady] = useState(false)
  const [productivityEnabled, setProductivityEnabled] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guidance, setGuidance] = useState<WorkOrderTechnicianAssistAi | null>(null)
  const [copyBusy, setCopyBusy] = useState(false)

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
    setGuidance(null)
    setError(null)
  }, [props.workOrderId])

  const disabled = props.workOrderArchived || !props.canEdit || !productivityEnabled || !eligibilityReady

  const runGenerate = useCallback(async () => {
    if (disabled) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(props.organizationId)}/work-orders/${encodeURIComponent(props.workOrderId)}/ai-technician-assist`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        guidance?: WorkOrderTechnicianAssistAi
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.guidance) {
        throw new Error(data.message ?? data.error ?? "Could not generate guidance.")
      }
      setGuidance(data.guidance)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not generate guidance."
      setError(msg)
      toast({ variant: "destructive", title: "Guidance unavailable", description: msg })
    } finally {
      setGenerating(false)
    }
  }, [disabled, props.organizationId, props.workOrderId, toast])

  const copyText = useCallback(
    async (label: string, text: string) => {
      const t = text.trim()
      if (!t) return
      setCopyBusy(true)
      try {
        await navigator.clipboard.writeText(t)
        toast({ title: "Copied", description: `${label} copied to clipboard.` })
      } catch {
        toast({ variant: "destructive", title: "Copy failed", description: "Clipboard unavailable." })
      } finally {
        setCopyBusy(false)
      }
    },
    [toast],
  )

  if (!props.canEdit) return null

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
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          AI technician guidance
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1">{PRODUCTIVITY_PLAN_MESSAGE}</p>
      </div>
    )
  }

  return (
    <div
      id="work-order-ai-technician-assist-panel"
      className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
    >
      <div className="border-b border-border bg-muted/25 dark:bg-muted/10 px-4 py-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            AI technician guidance
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Review-only suggestions — not saved automatically. Confirm with your shop before acting or messaging
            customers.
          </p>
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide mt-2 rounded px-1.5 py-0.5 w-fit",
              "bg-amber-500/15 text-amber-900 dark:text-amber-100 border border-amber-500/25",
            )}
          >
            AI draft — human review required
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs"
            disabled={disabled || generating}
            onClick={() => void runGenerate()}
          >
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {guidance ? "Regenerate" : "Generate guidance"}
          </Button>
          {guidance ?
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={copyBusy}
              onClick={() => void copyText("All sections", formatTechnicianGuidancePlainText(guidance))}
            >
              <Copy className="size-3.5" />
              Copy all
            </Button>
          : null}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {error ?
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        : null}

        {!guidance && !generating && !error ?
          <p className="text-sm text-muted-foreground">
            Generate troubleshooting ideas, customer questions, a parts/tools checklist, safety reminders, and
            customer-safe wording. Nothing is applied to this work order automatically.
          </p>
        : null}

        {generating ?
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Generating guidance…
          </p>
        : null}

        {guidance ?
          <>
            <BulletSection
              title="Troubleshooting"
              items={guidance.troubleshootingSteps}
              copyBusy={copyBusy}
              onCopy={() =>
                void copyText(
                  "Troubleshooting",
                  guidance.troubleshootingSteps.map((s) => `• ${s}`).join("\n"),
                )
              }
            />
            <BulletSection
              title="Questions for customer"
              items={guidance.customerQuestions}
              copyBusy={copyBusy}
              onCopy={() =>
                void copyText(
                  "Customer questions",
                  guidance.customerQuestions.map((s) => `• ${s}`).join("\n"),
                )
              }
            />
            <BulletSection
              title="Parts / tools checklist"
              items={guidance.partsAndToolsChecklist}
              copyBusy={copyBusy}
              onCopy={() =>
                void copyText(
                  "Parts / tools",
                  guidance.partsAndToolsChecklist.map((s) => `• ${s}`).join("\n"),
                )
              }
            />
            <BulletSection
              title="Safety & escalation"
              items={guidance.safetyAndEscalation}
              copyBusy={copyBusy}
              onCopy={() =>
                void copyText(
                  "Safety & escalation",
                  guidance.safetyAndEscalation.map((s) => `• ${s}`).join("\n"),
                )
              }
            />
            {guidance.customerSafeWording?.trim() ?
              <div className="rounded-lg border border-border/80 bg-muted/10 px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Customer-safe wording (draft)
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] gap-1 shrink-0"
                    onClick={() => void copyText("Customer-safe wording", guidance.customerSafeWording)}
                    disabled={copyBusy}
                  >
                    <Copy className="size-3" />
                    Copy
                  </Button>
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {guidance.customerSafeWording.trim()}
                </p>
              </div>
            : null}
          </>
        : null}
      </div>
    </div>
  )
}
