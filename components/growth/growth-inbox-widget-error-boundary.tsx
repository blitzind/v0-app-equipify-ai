"use client"

import React from "react"
import { GROWTH_INBOX_NO_RUNTIME_ERRORS_QA_MARKER } from "@/lib/growth/inbox/inbox-runtime-types"

type Props = {
  label: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

type State = { error: Error | null }

export class GrowthInboxWidgetErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[${GROWTH_INBOX_NO_RUNTIME_ERRORS_QA_MARKER}] ${this.props.label}`, error, info.componentStack)
  }

  render(): React.ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950"
          data-equipify-qa-marker={GROWTH_INBOX_NO_RUNTIME_ERRORS_QA_MARKER}
        >
          <p className="font-medium">{this.props.label} unavailable</p>
          <p className="mt-1 text-xs opacity-90">
            This section failed to render safely. Refresh the page or continue with other inbox panels.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
