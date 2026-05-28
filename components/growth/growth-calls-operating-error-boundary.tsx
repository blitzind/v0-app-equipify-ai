"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER,
  logGrowthCallsRuntimeIssue,
} from "@/lib/growth/navigation/growth-workspace-consolidation"

type GrowthCallsOperatingErrorBoundaryProps = {
  children: ReactNode
  surface: "workspace" | "live" | "overview"
}

type GrowthCallsOperatingErrorBoundaryState = {
  hasError: boolean
  message: string | null
}

export class GrowthCallsOperatingErrorBoundary extends Component<
  GrowthCallsOperatingErrorBoundaryProps,
  GrowthCallsOperatingErrorBoundaryState
> {
  state: GrowthCallsOperatingErrorBoundaryState = { hasError: false, message: null }

  static getDerivedStateFromError(error: unknown): GrowthCallsOperatingErrorBoundaryState {
    const message = error instanceof Error ? error.message : "Unexpected calls workspace error."
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    logGrowthCallsRuntimeIssue("render_error", {
      surface: this.props.surface,
      message: error instanceof Error ? error.message : "unknown",
      componentStack: info.componentStack?.split("\n")[0]?.trim() ?? null,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          data-growth-calls-runtime-hardening-marker={GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER}
        >
          <p className="font-medium text-destructive">Calls workspace could not render this view.</p>
          <p className="mt-1 text-muted-foreground">
            {this.state.message ?? "An unexpected error occurred. Try refreshing or switch to Operate."}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => this.setState({ hasError: false, message: null })}
          >
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
