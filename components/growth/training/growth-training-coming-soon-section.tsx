"use client"

import { Sparkles } from "lucide-react"
import { GrowthTrainingSectionCard } from "@/components/growth/training/growth-training-section-card"

type Props = {
  title: string
  description: string
  qaSection: string
}

export function GrowthTrainingComingSoonSection({ title, description, qaSection }: Props) {
  return (
    <GrowthTrainingSectionCard title={title} description={description} qaSection={qaSection}>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        <Sparkles className="size-4 shrink-0" aria-hidden />
        Coming soon
      </div>
    </GrowthTrainingSectionCard>
  )
}
