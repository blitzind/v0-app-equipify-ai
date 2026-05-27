"use client"

import { Radar, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type {
  IntentSignalSampleRow,
  IntentSignalTableColumn,
} from "@/components/growth/intent-signals/intent-signals-ux-constants"
import { cn } from "@/lib/utils"

export function IntentSignalsPreviewState({
  columns,
  sampleRows,
  title,
  description,
  ctaLabel,
  onCtaClick,
  showCta = true,
  ctaSoonBadge = true,
}: {
  columns: readonly IntentSignalTableColumn[]
  sampleRows: readonly IntentSignalSampleRow[]
  title: string
  description: string
  ctaLabel: string
  onCtaClick?: () => void
  showCta?: boolean
  ctaSoonBadge?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto blur-[2px] select-none" aria-hidden="true">
        <table className="w-full min-w-[720px] text-left text-sm opacity-60">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-2">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sampleRows.map((row, idx) => (
              <tr key={idx} className="border-b border-border/60">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-muted-foreground">
                    {row[col.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/75 px-6 py-10 text-center",
        )}
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-violet-50 text-violet-600">
          <Radar className="size-7" />
        </div>
        <div className="max-w-md space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {showCta ? (
          <Button
            type="button"
            className="gap-2"
            onClick={onCtaClick}
            disabled={!onCtaClick}
          >
            <Sparkles className="size-4" />
            {ctaLabel}
            {ctaSoonBadge ? (
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-900 hover:bg-amber-100">
                Soon
              </Badge>
            ) : null}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
