"use client"

import { useSearchParams } from "next/navigation"
import { GrowthAiPersonalizationDashboardView } from "@/components/growth/growth-ai-personalization-dashboard"

export function GrowthPersonalizationPageClient() {
  const searchParams = useSearchParams()
  const initialLeadId = searchParams.get("leadId")
  const initialGenerationId = searchParams.get("generationId")

  return (
    <GrowthAiPersonalizationDashboardView
      initialLeadId={initialLeadId}
      initialGenerationId={initialGenerationId}
    />
  )
}
