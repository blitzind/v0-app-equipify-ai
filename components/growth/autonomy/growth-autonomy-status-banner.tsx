"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Gauge, Lock, PauseCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { GrowthAutonomyStatusSummary } from "@/lib/growth/autonomy/growth-autonomy-settings-service"

type AutonomyStatusResponse = {
  ok: boolean
  viewModel?: {
    status: GrowthAutonomyStatusSummary
  }
}

export function GrowthAutonomyStatusBanner({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<GrowthAutonomyStatusSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/growth/workspace/settings/autonomy", { cache: "no-store" })
      const body = (await response.json()) as AutonomyStatusResponse
      if (!response.ok || !body.ok || !body.viewModel?.status) {
        throw new Error("Autonomy status unavailable.")
      }
      setStatus(body.viewModel.status)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Autonomy status unavailable.")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (error || !status) return null

  const showWarning = status.autonomyPaused || status.masterMode === "manual"

  return (
    <div
      className={
        compact
          ? "rounded-lg border bg-card p-4"
          : "rounded-lg border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900/40 dark:bg-violet-950/20"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Gauge className="h-4 w-4 text-violet-600" />
            <p className="font-medium">Growth Autonomy</p>
            <Badge variant="secondary">{status.masterModeLabel}</Badge>
            {status.autonomyPaused ? (
              <Badge variant="destructive" className="gap-1">
                <PauseCircle className="h-3 w-3" />
                Paused
              </Badge>
            ) : null}
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" />
              Outbound locked
            </Badge>
          </div>
          {!compact ? (
            <p className="text-sm text-muted-foreground">
              {status.enabledCapabilities.length > 0
                ? `Enabled: ${status.enabledCapabilities.join(", ")}`
                : "No autonomous capabilities enabled."}
            </p>
          ) : null}
          {showWarning ? (
            <p className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {status.autonomyPaused
                ? "Autonomy is paused — only manual operator actions run."
                : "Manual mode — autonomous internal actions remain off until you raise the mode and enable capabilities."}
            </p>
          ) : null}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/growth/settings/autonomy">Autonomy settings</Link>
        </Button>
      </div>
      {!compact && status.remainingBudgets.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {status.remainingBudgets.map((budget) => (
            <div key={budget.id} className="rounded-md border bg-background/80 px-3 py-2 text-sm">
              <p className="font-medium">{budget.label}</p>
              <p className="tabular-nums text-muted-foreground">
                {budget.remaining} / {budget.cap} remaining today
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
