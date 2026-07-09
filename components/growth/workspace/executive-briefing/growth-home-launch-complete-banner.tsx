"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { GROWTH_HOME_STARTUP_STEP_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import {
  dismissGrowthLaunchCompleteBanner,
  GROWTH_CUSTOMER_LAUNCH_COMPLETE_BODY,
  GROWTH_CUSTOMER_LAUNCH_COMPLETE_HEADLINE,
  GROWTH_CUSTOMER_LAUNCH_COMPLETE_NEXT_STEPS,
  GROWTH_ZERO_ASSISTANCE_ADOPTION_19C_4A_QA_MARKER,
  readGrowthLaunchCompleteBannerDismissed,
} from "@/lib/growth/customer-experience/growth-zero-assistance-adoption-19c-4a"
import { GROWTH_SALES_OPERATIONS_CENTER_ROUTE } from "@/lib/growth/operations-center/growth-sales-operations-center-types"
import { GROWTH_TRAINING_WORKSPACE_ROUTE } from "@/lib/growth/training/growth-training-workspace-types"

type Props = {
  setupIncomplete: boolean
}

export function GrowthHomeLaunchCompleteBanner({ setupIncomplete }: Props) {
  const { onboardingCompleted, teammate } = useAiTeammateIdentity()
  const [dismissed, setDismissed] = useState(true)

  const launchReady = onboardingCompleted && !setupIncomplete

  useEffect(() => {
    if (!launchReady) {
      setDismissed(true)
      return
    }
    setDismissed(readGrowthLaunchCompleteBannerDismissed())
  }, [launchReady])

  if (!launchReady || dismissed) return null

  function handleDismiss() {
    dismissGrowthLaunchCompleteBanner()
    setDismissed(true)
  }

  return (
    <section
      data-qa-section="home-launch-complete-banner"
      data-qa-marker-19c-4a={GROWTH_ZERO_ASSISTANCE_ADOPTION_19C_4A_QA_MARKER}
      className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-background to-background p-5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div className="min-w-0 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">{GROWTH_CUSTOMER_LAUNCH_COMPLETE_HEADLINE}</h2>
            <p className="text-sm text-muted-foreground">
              {teammate.name} {GROWTH_CUSTOMER_LAUNCH_COMPLETE_BODY}
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {GROWTH_CUSTOMER_LAUNCH_COMPLETE_NEXT_STEPS.map((step) => (
                <li key={step} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm">
                <Link href={GROWTH_HOME_STARTUP_STEP_PATHS.approvals}>Open Approvals</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={GROWTH_SALES_OPERATIONS_CENTER_ROUTE}>Operations</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={GROWTH_TRAINING_WORKSPACE_ROUTE}>Training</Link>
              </Button>
            </div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={handleDismiss}>
          <X className="size-4" aria-hidden />
          <span className="sr-only">Dismiss launch message</span>
        </Button>
      </div>
    </section>
  )
}
