"use client"

import React from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_ADMIN_ROUTE_RUNTIME_STABLE_QA_MARKER,
  sanitizeGrowthAdminUiError,
} from "@/lib/growth/admin-route-runtime-types"

type Props = {
  label: string
  qaMarker: string
  children: React.ReactNode
  onRetry?: () => void
}

type State = { hasError: boolean; errorMessage: string | null }

export class GrowthAdminWidgetErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, errorMessage: null }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message?.trim() || "Unknown render error",
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[${this.props.qaMarker}] ${this.props.label} render failed`, {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      reactComponentStack: info.componentStack,
    })
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: null })
    this.props.onRetry?.()
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
          data-qa={GROWTH_ADMIN_ROUTE_RUNTIME_STABLE_QA_MARKER}
          data-qa-marker={this.props.qaMarker}
        >
          <p className="font-semibold">{this.props.label} unavailable</p>
          <p className="mt-1 text-xs opacity-90">
            {sanitizeGrowthAdminUiError(this.state.errorMessage)}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={this.handleRetry}>
            <RefreshCw className="mr-2 size-3.5" />
            Retry panel
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
