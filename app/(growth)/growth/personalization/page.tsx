"use client"

import { Suspense } from "react"
import { GrowthPersonalizationPageClient } from "@/components/growth/personalization/growth-personalization-page-client"
import { GROWTH_PERSONALIZATION_WORKSPACE_QA_MARKER } from "@/lib/growth/personalization/personalization-generation-ux"

export default function GrowthPersonalizationWorkspacePage() {
  return (
    <div className="min-w-0 px-4 py-4 lg:px-6 lg:py-5" data-qa={GROWTH_PERSONALIZATION_WORKSPACE_QA_MARKER}>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading personalization workspace…</p>}>
        <GrowthPersonalizationPageClient />
      </Suspense>
    </div>
  )
}
