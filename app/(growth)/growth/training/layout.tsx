"use client"

import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthTrainingShell } from "@/components/growth/training/growth-training-shell"
import type { ReactNode } from "react"

export default function GrowthTrainingLayout({ children }: { children: ReactNode }) {
  return (
    <GrowthWorkspacePageContent>
      <GrowthTrainingShell>{children}</GrowthTrainingShell>
    </GrowthWorkspacePageContent>
  )
}
