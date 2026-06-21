"use client"

import { ArrowUpRight, FileText } from "lucide-react"
import type { PresentationResourceItem } from "@/lib/growth/sendr/growth-sendr-presentation-content"
import { PresentationCtaButton } from "@/components/growth/sendr/presentation/presentation-cta-button"
import { cn } from "@/lib/utils"

export function PresentationResourceCard({
  item,
  className,
  onActionClick,
}: {
  item: PresentationResourceItem
  className?: string
  onActionClick?: () => void
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 transition-shadow hover:shadow-md sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
        <FileText className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900 dark:text-slate-50">{item.title}</p>
        {item.description ? (
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.description}</p>
        ) : null}
      </div>
      {item.href ? (
        <PresentationCtaButton
          href={item.href}
          onClick={onActionClick}
          variant="secondary"
          size="default"
          className="shrink-0 sm:w-auto"
        >
          {item.actionLabel ?? "Open"}
          <ArrowUpRight className="ml-1.5 size-4" />
        </PresentationCtaButton>
      ) : null}
    </div>
  )
}
