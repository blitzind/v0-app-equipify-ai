"use client"

import type { ReactNode } from "react"
import { GripVertical, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { GrowthSendrLandingPageSection } from "@/lib/growth/sendr/growth-sendr-types"
import {
  getGrowthSendrBuilderSectionDisplayLabel,
  getGrowthSendrBuilderSectionMeta,
  summarizeGrowthSendrSection,
} from "@/lib/growth/sendr/growth-sendr-builder-section-meta"
import { cn } from "@/lib/utils"

type Props = {
  section: GrowthSendrLandingPageSection
  index: number
  disabled?: boolean
  onRemove: () => void
  children?: ReactNode
  className?: string
}

export function GrowthSendrBuilderSectionCard({
  section,
  index,
  disabled,
  onRemove,
  children,
  className,
}: Props) {
  const meta = getGrowthSendrBuilderSectionMeta(section.sectionType)
  const Icon = meta.icon
  const displayLabel = getGrowthSendrBuilderSectionDisplayLabel(section)
  const summary = summarizeGrowthSendrSection(section)

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span
          className="mt-0.5 flex cursor-grab items-center text-slate-300 opacity-60 transition-opacity group-hover:opacity-100 dark:text-slate-600"
          title="Section order"
          aria-hidden
        >
          <GripVertical className="size-4" />
        </span>

        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", meta.accentClass)}>
          <Icon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900 dark:text-slate-50">{displayLabel}</p>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {meta.label}
            </Badge>
            <span className="text-xs text-slate-400">#{index + 1}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{summary}</p>
          <p className="mt-1 text-xs text-slate-400">{meta.description}</p>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 text-slate-400 hover:text-destructive"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Remove ${displayLabel} section`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {children ? <div className="border-t border-slate-200/80 px-4 pb-4 pt-0 dark:border-slate-800 sm:px-5">{children}</div> : null}
    </div>
  )
}
