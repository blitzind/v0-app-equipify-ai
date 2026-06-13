"use client"

import Link from "next/link"
import { Bot, ChevronRight, ExternalLink } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import {
  AIDEN_APOLLO_PILOT_CHECKLIST,
  AIDEN_BLOCKER_PLAYBOOK,
  AIDEN_COACH_TIPS,
  AIDEN_DAILY_ROUTINE,
  AIDEN_DAILY_SALES_WORKFLOW,
  AIDEN_GUIDE_SECTIONS,
  AIDEN_METRICS_GUIDE,
  AIDEN_OPERATOR_GUIDE_QA_MARKER,
  AIDEN_REPLY_HANDLING,
  AIDEN_STATUS_DICTIONARY,
  type AidenBlockerEntry,
  type AidenGuideLink,
} from "@/lib/growth/aiden/operator-guide"
import { cn } from "@/lib/utils"

function GuideLinks({ links }: { links?: AidenGuideLink[] }) {
  if (!links?.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:underline"
        >
          {link.label}
          <ExternalLink className="size-3 opacity-60" />
        </Link>
      ))}
    </div>
  )
}

function severityTone(severity: AidenBlockerEntry["severity"]): "healthy" | "attention" | "medium" | "neutral" {
  if (severity === "critical") return "attention"
  if (severity === "high") return "attention"
  if (severity === "medium") return "medium"
  return "neutral"
}

type AidenOperatorGuidePanelProps = {
  className?: string
  /** When true, render without outer collapsible card (for dedicated page). */
  embedded?: boolean
}

export function AidenOperatorGuidePanel({ className, embedded = false }: AidenOperatorGuidePanelProps) {
  const body = (
    <div
      className="space-y-4"
      data-aiden-operator-guide={AIDEN_OPERATOR_GUIDE_QA_MARKER}
      id="aiden-guide"
    >
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/30">
        <p className="text-sm font-medium text-foreground">Aiden — your Growth Engine operator coach</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Plainspoken guidance only. Nothing here sends email or changes data. Follow the steps; approve manually.{" "}
          <Link href="/admin/growth/aiden" className="font-medium text-indigo-600 hover:underline">
            Open full guide page
          </Link>
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick tips</p>
        <ul className="space-y-2">
          {AIDEN_COACH_TIPS.map((tip) => (
            <li
              key={tip.id}
              className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm leading-snug"
            >
              <span className="font-medium text-foreground">&ldquo;{tip.message}&rdquo;</span>
              <span className="mt-1 block text-xs text-muted-foreground">{tip.when}</span>
            </li>
          ))}
        </ul>
      </div>

      <Accordion type="multiple" defaultValue={["today", "pilot-checklist"]} className="w-full space-y-1">
        <AccordionItem value="today" className="rounded-lg border border-border px-3">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            {AIDEN_GUIDE_SECTIONS.find((s) => s.id === "today")?.title}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ol className="space-y-3">
              {AIDEN_DAILY_ROUTINE.map((step) => (
                <li key={step.order} className="flex gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    {step.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{step.title}</p>
                    <p className="mt-0.5 text-muted-foreground">{step.detail}</p>
                    <GuideLinks links={step.links} />
                  </div>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pilot-checklist" className="rounded-lg border border-border px-3">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            {AIDEN_GUIDE_SECTIONS.find((s) => s.id === "pilot-checklist")?.title}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ul className="space-y-4">
              {AIDEN_APOLLO_PILOT_CHECKLIST.map((item) => (
                <li key={item.id} className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
                  <p className="font-medium">{item.title}</p>
                  <dl className="mt-2 space-y-1.5 text-xs">
                    <div>
                      <dt className="font-semibold text-muted-foreground">Where</dt>
                      <dd>{item.where}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-emerald-700 dark:text-emerald-400">Expected</dt>
                      <dd>{item.expectedStatus}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-rose-700 dark:text-rose-400">Do not</dt>
                      <dd>{item.doNot}</dd>
                    </div>
                  </dl>
                  <GuideLinks links={item.links} />
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="status-dictionary" className="rounded-lg border border-border px-3">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            {AIDEN_GUIDE_SECTIONS.find((s) => s.id === "status-dictionary")?.title}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Meaning</th>
                    <th className="py-2 font-semibold">What to do</th>
                  </tr>
                </thead>
                <tbody>
                  {AIDEN_STATUS_DICTIONARY.map((row) => (
                    <tr key={row.status} className="border-b border-border/50 align-top">
                      <td className="py-2 pr-3 font-mono text-[11px]">{row.status}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.meaning}</td>
                      <td className="py-2">{row.operatorAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="blocker-playbook" className="rounded-lg border border-border px-3">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            {AIDEN_GUIDE_SECTIONS.find((s) => s.id === "blocker-playbook")?.title}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ul className="space-y-3">
              {AIDEN_BLOCKER_PLAYBOOK.map((blocker) => (
                <li key={blocker.code} className="rounded-lg border border-border/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{blocker.code}</span>
                    <GrowthBadge label={blocker.severity} tone={severityTone(blocker.severity)} />
                    {blocker.engineeringNeeded ? (
                      <GrowthBadge label="Engineering may be needed" tone="attention" />
                    ) : (
                      <GrowthBadge label="Operator fix" tone="healthy" />
                    )}
                  </div>
                  <p className="mt-2 text-muted-foreground">{blocker.meaning}</p>
                  <p className="mt-2">
                    <span className="font-semibold">Action: </span>
                    {blocker.operatorAction}
                  </p>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="daily-sales" className="rounded-lg border border-border px-3">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            {AIDEN_GUIDE_SECTIONS.find((s) => s.id === "daily-sales")?.title}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["Morning", AIDEN_DAILY_SALES_WORKFLOW.morning],
                  ["Midday", AIDEN_DAILY_SALES_WORKFLOW.midday],
                  ["End of day", AIDEN_DAILY_SALES_WORKFLOW.endOfDay],
                ] as const
              ).map(([label, items]) => (
                <div key={label} className="rounded-lg border border-border/60 bg-muted/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {items.map((item) => (
                      <li key={item} className="flex gap-1.5">
                        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-indigo-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="reply-handling" className="rounded-lg border border-border px-3">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            {AIDEN_GUIDE_SECTIONS.find((s) => s.id === "reply-handling")?.title}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ul className="space-y-3">
              {AIDEN_REPLY_HANDLING.map((reply) => (
                <li key={reply.type} className="rounded-lg border border-border/60 p-3 text-sm">
                  <p className="font-medium capitalize">{reply.type}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-semibold">Where: </span>
                    {reply.where}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold">Action: </span>
                    {reply.action}
                  </p>
                  {reply.opportunityHint ? (
                    <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">{reply.opportunityHint}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            <GuideLinks
              links={[
                { label: "Unified inbox", href: "/admin/growth/inbox" },
                { label: "Reply drafts", href: "/admin/growth/copilot/reply-drafts" },
              ]}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="metrics" className="rounded-lg border border-border px-3">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            {AIDEN_GUIDE_SECTIONS.find((s) => s.id === "metrics")?.title}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ul className="space-y-3">
              {AIDEN_METRICS_GUIDE.map((metric) => (
                <li key={metric.metric} className="text-sm">
                  <p className="font-medium">{metric.metric}</p>
                  <p className="text-muted-foreground">{metric.meaning}</p>
                  <p className="mt-1 text-xs">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Healthy: </span>
                    {metric.healthySignal}
                  </p>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )

  if (embedded) {
    return <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>{body}</div>
  }

  return (
    <GrowthCollapsibleEngineCard
      title="Aiden Guide"
      icon={<Bot className="size-4 text-indigo-600" />}
      className={className}
      defaultOpen
      persistKey="aiden-operator-guide"
      headerAside={<GrowthBadge label={AIDEN_OPERATOR_GUIDE_QA_MARKER} tone="neutral" />}
    >
      {body}
    </GrowthCollapsibleEngineCard>
  )
}
