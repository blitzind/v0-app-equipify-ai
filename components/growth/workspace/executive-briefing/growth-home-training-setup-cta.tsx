"use client"

import Link from "next/link"
import { GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NARRATIVE_INTELLIGENCE_SETUP_INCOMPLETE_MESSAGE } from "@/lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"
import { GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER } from "@/lib/growth/home/growth-home-cleanup-19c-2g"
import { GROWTH_TRAINING_WORKSPACE_ROUTE } from "@/lib/growth/training/growth-training-workspace-types"

type Props = {
  setupIncomplete: boolean
  setupMessage?: string | null
}

export function GrowthHomeTrainingSetupCta({ setupIncomplete, setupMessage }: Props) {
  if (!setupIncomplete) return null

  return (
    <section
      data-qa-section="home-training-setup-cta"
      data-qa-marker-19c-2g={GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER}
      className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-background to-background p-4 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <GraduationCap className="mt-0.5 size-5 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-semibold text-foreground">I still need training before I can work fully</h2>
            <p className="text-sm text-muted-foreground">
              {setupMessage?.trim() || NARRATIVE_INTELLIGENCE_SETUP_INCOMPLETE_MESSAGE}
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={GROWTH_TRAINING_WORKSPACE_ROUTE}>Continue in Training</Link>
        </Button>
      </div>
    </section>
  )
}
