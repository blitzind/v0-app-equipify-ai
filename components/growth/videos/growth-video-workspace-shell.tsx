"use client"

import type { ReactNode } from "react"
import { GrowthVideoWorkspaceTabs } from "@/components/growth/videos/growth-video-workspace-tabs"
import { GROWTH_VIDEO_FOUNDATION_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

export function GrowthVideoWorkspaceShell({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-6" data-qa-marker={GROWTH_VIDEO_FOUNDATION_QA_MARKER}>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        <p className="text-xs text-muted-foreground">
          Human-supervised workspace — recording placeholders only. No autonomous outreach or enrollment.
        </p>
      </div>
      <GrowthVideoWorkspaceTabs />
      {children}
    </div>
  )
}
