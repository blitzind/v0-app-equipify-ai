"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Loader2, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  type GrowthSalesExecutionPlan,
} from "@/lib/growth/revenue-execution/revenue-execution-types"

type GrowthSalesExecutionPlanPanelProps = {
  leadId: string
  initialPlan?: GrowthSalesExecutionPlan | null
}

export function GrowthSalesExecutionPlanPanel({ leadId, initialPlan }: GrowthSalesExecutionPlanPanelProps) {
  const [plan, setPlan] = useState<GrowthSalesExecutionPlan | null>(initialPlan ?? null)
  const [loading, setLoading] = useState(!initialPlan)
  const [saving, setSaving] = useState(false)
  const [humanApproved, setHumanApproved] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (initialPlan) return
    setLoading(true)
    try {
      const response = await fetch(`/api/platform/growth/revenue-execution/execution-plan?leadId=${leadId}`, {
        cache: "no-store",
      })
      const payload = (await response.json()) as { plan?: GrowthSalesExecutionPlan }
      if (response.ok && payload.plan?.qaMarker === GROWTH_REVENUE_EXECUTION_QA_MARKER) {
        setPlan(payload.plan)
      }
    } finally {
      setLoading(false)
    }
  }, [initialPlan, leadId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (initialPlan) setPlan(initialPlan)
  }, [initialPlan])

  async function save() {
    if (!plan || !humanApproved) {
      setMessage("Confirm human approval before saving plan edits.")
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/platform/growth/revenue-execution/execution-plan?leadId=${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, humanApprovalConfirmed: true }),
      })
      const payload = (await response.json()) as { plan?: GrowthSalesExecutionPlan; message?: string }
      if (!response.ok) {
        setMessage("Could not save execution plan.")
        return
      }
      if (payload.plan) setPlan(payload.plan)
      setMessage("Plan saved — no steps executed automatically.")
    } finally {
      setSaving(false)
    }
  }

  function toggleStep(stepId: string, completed: boolean) {
    if (!plan) return
    setPlan({
      ...plan,
      steps: plan.steps.map((step) => (step.id === stepId ? { ...step, completed } : step)),
    })
  }

  function updateNotes(stepId: string, operatorNotes: string) {
    if (!plan) return
    setPlan({
      ...plan,
      steps: plan.steps.map((step) => (step.id === stepId ? { ...step, operatorNotes } : step)),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading execution plan…
      </div>
    )
  }

  if (!plan) {
    return (
      <GrowthCollapsibleEngineCard
        title="Sales Execution Plan"
        icon={<ListChecks className="size-4" />}
        headerAside="Not generated"
        persistKey={GROWTH_DRAWER_CARD_KEYS.salesExecutionPlan}
      >
        <p className="text-sm text-muted-foreground">
          Open an opportunity recommendation in the{" "}
          <Link href="/admin/growth/revenue-execution/review" className="text-primary hover:underline">
            review workspace
          </Link>{" "}
          to generate a plan.
        </p>
      </GrowthCollapsibleEngineCard>
    )
  }

  const completedCount = plan.steps.filter((step) => step.completed).length

  return (
    <GrowthCollapsibleEngineCard
      title="Sales Execution Plan"
      icon={<ListChecks className="size-4" />}
      headerAside={`${completedCount}/${plan.steps.length} steps`}
      defaultOpen
      persistKey={GROWTH_DRAWER_CARD_KEYS.salesExecutionPlan}
    >
      <p className="text-sm text-muted-foreground">{plan.summary}</p>

      <ol className="mt-4 space-y-4">
        {plan.steps.map((step) => (
          <li key={step.id} className="rounded-lg border border-border/70 p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={step.completed}
                onCheckedChange={(value) => toggleStep(step.id, value === true)}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">
                  {step.order}. {step.title}
                </p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">Channel: {step.suggestedChannel}</p>
                <Textarea
                  className="mt-2"
                  rows={2}
                  placeholder="Operator notes"
                  value={step.operatorNotes ?? ""}
                  onChange={(event) => updateNotes(step.id, event.target.value)}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <Checkbox checked={humanApproved} onCheckedChange={(value) => setHumanApproved(value === true)} />
        I confirm plan edits — no automatic execution
      </label>

      <Button size="sm" className="mt-3" disabled={saving} onClick={() => void save()}>
        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
        Save plan
      </Button>

      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
    </GrowthCollapsibleEngineCard>
  )
}
