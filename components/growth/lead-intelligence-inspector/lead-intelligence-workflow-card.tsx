"use client"

import Link from "next/link"
import { ArrowRight, Workflow } from "lucide-react"
import { LEAD_INTELLIGENCE_OPERATOR_WORKFLOW_STEPS } from "@/lib/growth/lead-engine/lead-intelligence-inspector-types"
import { cn } from "@/lib/utils"

export function LeadIntelligenceWorkflowCard({ className }: { className?: string }) {
  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}
      data-qa-marker="lead-intelligence-workflow"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <Workflow size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Operator workflow</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Prospect discovery through outreach — use this inspector after pushing a lead to the inbox.
          </p>
          <ol className="mt-4 flex flex-wrap items-center gap-2">
            {LEAD_INTELLIGENCE_OPERATOR_WORKFLOW_STEPS.map((step, index) => (
              <li key={step.id} className="flex items-center gap-2">
                <Link
                  href={step.href}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted",
                    step.id === "lead_engine" && "border-violet-300 bg-violet-50 text-violet-900",
                  )}
                >
                  {step.label}
                </Link>
                {index < LEAD_INTELLIGENCE_OPERATOR_WORKFLOW_STEPS.length - 1 ? (
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
