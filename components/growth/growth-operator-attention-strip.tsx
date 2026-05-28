"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, ArrowRight } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_ATTENTION_ACTIONABLE_ONLY_QA_MARKER,
  GROWTH_ATTENTION_QUIET_HEALTHY_QA_MARKER,
  hasActionableOperatorAttention,
} from "@/lib/growth/operator-ux/operator-attention-utils"
import {
  GROWTH_OPERATOR_UX_H3_QA_MARKER,
  type GrowthOperatorAttentionStrip,
} from "@/lib/growth/operator-ux/operator-ux-h3-types"
import { cn } from "@/lib/utils"

function severityTone(severity: string): "critical" | "high" | "attention" | "neutral" {
  if (severity === "critical") return "critical"
  if (severity === "high") return "high"
  if (severity === "medium") return "attention"
  return "neutral"
}

export function GrowthOperatorAttentionStrip({ compact = false }: { compact?: boolean }) {
  const [strip, setStrip] = useState<GrowthOperatorAttentionStrip | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/growth/operator/attention-strip", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        strip?: GrowthOperatorAttentionStrip
      }
      if (res.ok && data.ok && data.strip) setStrip(data.strip)
      else setStrip(null)
    } catch {
      setStrip(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!hasActionableOperatorAttention(strip)) {
    return (
      <span
        className="sr-only"
        data-qa={GROWTH_ATTENTION_QUIET_HEALTHY_QA_MARKER}
        data-qa-marker={GROWTH_ATTENTION_ACTIONABLE_ONLY_QA_MARKER}
      />
    )
  }

  return (
    <div
      id="operator-attention"
      className={cn(
        "rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/80 to-background px-4 py-3 dark:border-amber-900/40 dark:from-amber-950/20",
        compact && "py-2.5",
      )}
      data-qa={GROWTH_OPERATOR_UX_H3_QA_MARKER}
      data-qa-marker={GROWTH_ATTENTION_ACTIONABLE_ONLY_QA_MARKER}
      data-attention-quiet-qa={GROWTH_ATTENTION_QUIET_HEALTHY_QA_MARKER}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 text-amber-700 dark:text-amber-300" />
          <p className="text-sm font-semibold">Operator attention</p>
          <GrowthBadge label={`${strip!.total_attention} items`} tone="attention" />
        </div>
        <Link href="/admin/growth/command#operator-attention" className="text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-300">
          Open command center
        </Link>
      </div>
      <div className={cn("grid gap-2", compact ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4")}>
        {strip!.items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group flex items-start justify-between gap-2 rounded-lg border border-border/70 bg-background/80 px-3 py-2 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">{item.label}</span>
                <GrowthBadge label={String(item.count)} tone={severityTone(item.severity)} />
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
            </div>
            <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  )
}
