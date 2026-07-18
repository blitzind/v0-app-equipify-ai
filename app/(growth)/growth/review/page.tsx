"use client"

import { Suspense } from "react"
import { GrowthReviewHumanDecisionQueuePage } from "@/components/growth/workspace/ux-1a/review/growth-review-human-decision-queue-page"

function ReviewFallback() {
  return <p className="text-sm text-muted-foreground">Loading review queue…</p>
}

export default function GrowthReviewPage() {
  return (
    <Suspense fallback={<ReviewFallback />}>
      <GrowthReviewHumanDecisionQueuePage />
    </Suspense>
  )
}
