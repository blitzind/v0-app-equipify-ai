"use client"

import Link from "next/link"
import { ChevronRight, ExternalLink } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"
import {
  AIDEN_GUIDED_WORKFLOWS_QA_MARKER,
  buildAidenGuidedWorkflowCards,
  type AidenWorkflowStatusTone,
} from "@/lib/growth/aiden/aiden-guided-workflows"
import { cn } from "@/lib/utils"

type AidenGuidedWorkflowsPanelProps = {
  briefing: AidenDailyBriefing | null
  className?: string
}

function statusToneBadge(tone: AidenWorkflowStatusTone): "healthy" | "attention" | "blocked" | "neutral" {
  if (tone === "ready") return "healthy"
  if (tone === "attention") return "attention"
  if (tone === "blocked") return "blocked"
  return "neutral"
}

export function AidenGuidedWorkflowsPanel({ briefing, className }: AidenGuidedWorkflowsPanelProps) {
  if (!briefing) return null

  const cards = buildAidenGuidedWorkflowCards({
    mailbox: briefing.mailbox,
    inbox: briefing.inbox,
    approval_queue: briefing.approval_queue,
    meetings: briefing.meetings,
    revenue: briefing.revenue,
  })

  return (
    <section
      className={cn("space-y-3", className)}
      data-aiden-guided-workflows={AIDEN_GUIDED_WORKFLOWS_QA_MARKER}
    >
      <div>
        <p className="text-sm font-semibold">Guided workflows</p>
        <p className="text-xs text-muted-foreground">
          Live status from your briefing — read-only coaching with deep links. Nothing here sends or approves.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {cards.map((card) => (
          <div key={card.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{card.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.summary}</p>
              </div>
              <GrowthBadge label={card.statusLabel} tone={statusToneBadge(card.statusTone)} />
            </div>

            <Accordion type="single" collapsible className="mt-3">
              <AccordionItem value="steps" className="border-none">
                <AccordionTrigger className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline">
                  Step-by-step
                </AccordionTrigger>
                <AccordionContent className="pb-1">
                  <ol className="space-y-2">
                    {card.steps.map((step) => (
                      <li key={`${card.id}-${step.order}`} className="flex gap-2 text-sm">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                          {step.order}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium">{step.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
                          {step.links?.length ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {step.links.map((link) => (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                                >
                                  {link.label}
                                  <ExternalLink className="size-3 opacity-60" />
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
              {card.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted/40"
                >
                  {link.label}
                  <ChevronRight className="size-3" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
