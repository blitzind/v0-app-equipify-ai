"use client"

import type { ReactNode } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEngineHonestEmptyState } from "@/components/growth/growth-engine-honest-empty-state"
import { GrowthInboxCompactPanelState } from "@/components/growth/inbox/growth-inbox-compact-panel-state"
import { sanitizeGrowthAdminUiError } from "@/lib/growth/admin-route-runtime-types"
import { GROWTH_ENGINE_HARDENING_QA_MARKER } from "@/lib/growth/e2e/growth-engine-hardening-types"
import type { GrowthEngineEmptyStateKind } from "@/lib/growth/e2e/growth-engine-hardening-types"

type GrowthEnginePanelResilienceProps = {
  qaMarker?: string
  loading: boolean
  error?: string | null
  isEmpty: boolean
  emptyKind: GrowthEngineEmptyStateKind
  emptyTitle?: string
  emptyMessage?: string
  onRetry: () => void
  refreshing?: boolean
  partialData?: boolean
  /** Phase 8A.2 — compact 80–120px operator panel states. */
  compact?: boolean
  compactTitle?: string
  children: ReactNode
}

export function GrowthEnginePanelResilience({
  qaMarker = GROWTH_ENGINE_HARDENING_QA_MARKER,
  loading,
  error = null,
  isEmpty,
  emptyKind,
  emptyTitle,
  emptyMessage,
  onRetry,
  refreshing = false,
  partialData = false,
  compact = false,
  compactTitle,
  children,
}: GrowthEnginePanelResilienceProps) {
  if (compact) {
    const title = compactTitle ?? "Panel"
    if (loading && !partialData) {
      return <GrowthInboxCompactPanelState title={title} state="loading" />
    }
    if (error && !partialData) {
      return (
        <GrowthInboxCompactPanelState
          title={title}
          state="error"
          message={sanitizeGrowthAdminUiError(error)}
          onRetry={onRetry}
        />
      )
    }
    if (isEmpty && !partialData) {
      return (
        <GrowthInboxCompactPanelState
          title={title}
          state="empty"
          message={emptyMessage ?? emptyTitle ?? "Unavailable."}
          onRetry={onRetry}
        />
      )
    }
  }

  if (loading && !partialData) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-qa-marker={qaMarker}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }

  if (error && !partialData) {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
        data-qa-marker={qaMarker}
      >
        <p className="font-medium">Unable to load panel data</p>
        <p className="mt-1 text-xs opacity-90">{sanitizeGrowthAdminUiError(error)}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void onRetry()}>
          <RefreshCw className="mr-2 size-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  if (isEmpty && !partialData) {
    return (
      <GrowthEngineHonestEmptyState kind={emptyKind} title={emptyTitle} message={emptyMessage} />
    )
  }

  return (
    <div data-qa-marker={qaMarker} className="space-y-3">
      {refreshing ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Refreshing…
        </div>
      ) : null}
      {error && partialData ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
          Partial data shown — {sanitizeGrowthAdminUiError(error)}
          <Button type="button" variant="ghost" size="sm" className="ml-2 h-7 px-2" onClick={() => void onRetry()}>
            <RefreshCw className="mr-1 size-3 h-3" />
            Retry
          </Button>
        </div>
      ) : null}
      {children}
    </div>
  )
}
