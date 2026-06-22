"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { AlertTriangle, ChevronDown, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEngineCard, GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_DELIVERABILITY_DEGRADED_MODE_QA_MARKER,
  GROWTH_DELIVERABILITY_WIDGET_FALLBACK_QA_MARKER,
  type GrowthDeliverabilityModuleResult,
  type GrowthDeliverabilityProtectionModuleId,
} from "@/lib/growth/deliverability/deliverability-protection-console-types"
import { emptyModuleStatusLabel } from "@/lib/growth/deliverability/deliverability-console-state"

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function moduleStatusTone(
  status: GrowthDeliverabilityModuleResult<unknown>["status"],
): "healthy" | "attention" | "critical" | "neutral" {
  switch (status) {
    case "ok":
      return "healthy"
    case "empty":
      return "attention"
    case "degraded":
      return "attention"
    case "error":
      return "critical"
    default:
      return "neutral"
  }
}

export function useDeliverabilityModule<T>(moduleId: GrowthDeliverabilityProtectionModuleId) {
  const [loading, setLoading] = useState(true)
  const [module, setModule] = useState<GrowthDeliverabilityModuleResult<T> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/platform/growth/deliverability/protection/modules/${moduleId}`,
        { cache: "no-store" },
      )
      const payload = (await response.json()) as {
        ok?: boolean
        module?: GrowthDeliverabilityModuleResult<T>
        message?: string
      }
      if (payload.module) {
        setModule(payload.module)
        return
      }
      setModule({
        module_id: moduleId,
        status: "error",
        qa_marker: GROWTH_DELIVERABILITY_WIDGET_FALLBACK_QA_MARKER,
        data: null,
        error: {
          code: "fetch_failed",
          message: payload.message ?? "Module request failed.",
          impact: "This widget could not refresh.",
          remediation: "Retry or check platform access.",
          retryable: true,
        },
        last_success_at: null,
        fetched_at: new Date().toISOString(),
        still_available: [],
      })
    } catch (error) {
      setModule({
        module_id: moduleId,
        status: "error",
        qa_marker: GROWTH_DELIVERABILITY_WIDGET_FALLBACK_QA_MARKER,
        data: null,
        error: {
          code: "network_error",
          message: error instanceof Error ? error.message : "Network error.",
          impact: "This widget could not refresh.",
          remediation: "Retry when connectivity is restored.",
          retryable: true,
        },
        last_success_at: null,
        fetched_at: new Date().toISOString(),
        still_available: [],
      })
    } finally {
      setLoading(false)
    }
  }, [moduleId])

  useEffect(() => {
    void load()
  }, [load])

  return { loading, module, reload: load }
}

export function DeliverabilityModuleShell({
  moduleId,
  title,
  description,
  qaMarker,
  loading,
  module,
  onRetry,
  children,
  emptyContent,
}: {
  moduleId: GrowthDeliverabilityProtectionModuleId
  title: string
  description: string
  qaMarker: string
  loading: boolean
  module: GrowthDeliverabilityModuleResult<unknown> | null
  onRetry: () => void
  children: ReactNode
  emptyContent?: ReactNode
}) {
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  return (
    <GrowthEngineCard
      id={moduleId.replace(/_/g, "-")}
      title={title}
      className="h-full"
    >
      <div
        className="space-y-3"
        data-qa-marker={qaMarker}
        data-module-id={moduleId}
        data-widget-fallback={GROWTH_DELIVERABILITY_WIDGET_FALLBACK_QA_MARKER}
      >
        <p className="text-xs text-muted-foreground">{description}</p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {module ? (
            <GrowthBadge
              label={
                module.status === "empty"
                  ? emptyModuleStatusLabel(moduleId)
                  : module.status.replace(/_/g, " ")
              }
              tone={moduleStatusTone(module.status)}
            />
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => void onRetry()} disabled={loading}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Retry
          </Button>
        </div>

        {loading && !module?.data ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading {title.toLowerCase()}…
          </div>
        ) : null}

        {module?.status === "error" && module.error ? (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
            data-degraded={GROWTH_DELIVERABILITY_DEGRADED_MODE_QA_MARKER}
          >
            <p className="font-medium text-destructive">{module.error.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{module.error.impact}</p>
            <p className="mt-1 text-xs">{module.error.remediation}</p>
            {module.still_available.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Still active: {module.still_available.join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {module?.status === "empty" ? (
          <div
            className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground"
            data-setup-state={emptyModuleStatusLabel(moduleId)}
          >
            {emptyContent ?? module.error?.message ?? "No live data connected for this module."}
          </div>
        ) : null}

        {module?.data && module.status !== "error" ? children : null}

        {module ? (
          <div className="border-t border-border/60 pt-2">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowDiagnostics((value) => !value)}
            >
              <ChevronDown className={`size-3 transition-transform ${showDiagnostics ? "rotate-180" : ""}`} />
              Diagnostics
            </button>
            {showDiagnostics ? (
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>Last refresh: {formatWhen(module.fetched_at)}</p>
                <p>Last success: {formatWhen(module.last_success_at)}</p>
                {module.error ? <p className="flex items-start gap-1"><AlertTriangle className="mt-0.5 size-3" />{module.error.code}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </GrowthEngineCard>
  )
}
