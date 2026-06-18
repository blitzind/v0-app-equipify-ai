"use client"

import { GrowthEngineHonestEmptyState } from "@/components/growth/growth-engine-honest-empty-state"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"

export function GrowthVideoTemplatesShell() {
  return (
    <GrowthVideoWorkspaceShell
      title="Video Templates"
      description="Reusable layouts for personalized video pages and recording defaults."
    >
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8">
        <GrowthEngineHonestEmptyState
          kind="no_data"
          title="No video templates yet"
          message="Template authoring ships after the recording pipeline. This shell validates navigation and persistence boundaries."
        />
      </div>
    </GrowthVideoWorkspaceShell>
  )
}
