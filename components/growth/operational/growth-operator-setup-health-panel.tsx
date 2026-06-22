"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowRight, Loader2, RefreshCw } from "lucide-react"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { Button } from "@/components/ui/button"
import {
  GE_V1_2_OPERATOR_SETUP_HEALTH_QA_MARKER,
  type GrowthOperatorSetupHealthPayload,
} from "@/lib/growth/operational/ge-v1-2-operator-setup-health-types"
import { cn } from "@/lib/utils"

const STATUS_TONE = {
  ok: "healthy",
  warn: "attention",
  error: "critical",
  neutral: "neutral",
} as const

export function GrowthOperatorSetupHealthPanel({ compact = false }: { compact?: boolean }) {
  const [health, setHealth] = useState<GrowthOperatorSetupHealthPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/operator-setup-health", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        health?: GrowthOperatorSetupHealthPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.health) {
        throw new Error(data.message ?? "Could not load setup health.")
      }
      setHealth(data.health)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load setup health.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !health) {
    return (
      <GrowthEngineCard title="Setup health">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading setup health…
        </div>
      </GrowthEngineCard>
    )
  }

  if (!health) return null

  return (
    <GrowthEngineCard
      title="Setup health"
      data-section="setup-health"
      data-qa-marker={GE_V1_2_OPERATOR_SETUP_HEALTH_QA_MARKER}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {health.blockerCount > 0
            ? `${health.blockerCount} blocker(s) need attention before launch.`
            : health.warningCount > 0
              ? `${health.warningCount} setup item(s) need review.`
              : "Core operator setup looks ready."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-1 size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/growth/runbook">Launch runbook</Link>
          </Button>
        </div>
      </div>

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      <div className={cn("grid gap-2", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {health.items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="rounded-lg border border-border/80 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-muted/20"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold text-foreground">{item.value}</p>
                {item.detail ? <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p> : null}
              </div>
              <GrowthBadge label={item.status} tone={STATUS_TONE[item.status]} />
            </div>
          </Link>
        ))}
      </div>
    </GrowthEngineCard>
  )
}
