"use client"

import { useSearchParams } from "next/navigation"
import { GrowthPersonalizationWorkspace } from "@/components/growth/personalization/growth-personalization-workspace"

export function GrowthPersonalizationPageClient() {
  const searchParams = useSearchParams()
  const initialLeadId = searchParams.get("leadId")
  const initialGenerationId = searchParams.get("generationId")

  return (
    <GrowthPersonalizationWorkspace
      initialLeadId={initialLeadId}
      initialGenerationId={initialGenerationId}
    />
  )
}
