"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { GrowthAiTeammateProfile } from "@/components/growth/ai-teammate/growth-ai-teammate-profile"
import { Button } from "@/components/ui/button"
import type { GrowthHomeCheckIn } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { isGrowthHomeServiceOperatorVisible } from "@/lib/workspace/ai-os-v1-product-alignment"

type Props = {
  checkIn: GrowthHomeCheckIn
  lastUpdateLabel?: string | null
}

export function GrowthHomeCheckInSection({ checkIn, lastUpdateLabel = null }: Props) {
  const teammate = resolveAiTeammatePresentation(checkIn.teammateName)
  const showDeliveryIntelligence = isGrowthHomeServiceOperatorVisible()

  return (
    <section
      data-qa-section="home-ai-employee-check-in"
      className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-background to-background p-6 sm:p-8 lg:p-10 shadow-sm space-y-6"
    >
      <GrowthAiTeammateProfile
        teammate={teammate}
        statusLabel={checkIn.status.label}
        activityLabel={checkIn.status.activityLabel}
        lastUpdateLabel={lastUpdateLabel}
        className="border-0 bg-transparent p-0 shadow-none"
      />

      <div className="max-w-3xl space-y-8">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{checkIn.greeting}</p>
        </div>

        <div className="space-y-3">
          {checkIn.operatorMissionSummary ? (
            <p className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">{checkIn.operatorMissionSummary}</p>
          ) : null}
          {checkIn.marketingOperatorSummary ? (
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{checkIn.marketingOperatorSummary}</p>
          ) : null}
          {checkIn.marketingVoiceLines.length > 0 ? (
            <ul className="space-y-2">
              {checkIn.marketingVoiceLines.map((line) => (
                <li key={line} className="flex items-start gap-3 text-base leading-relaxed text-muted-foreground">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          {checkIn.customerSuccessOperatorSummary ? (
            <p className="text-lg font-semibold text-violet-700 dark:text-violet-300">{checkIn.customerSuccessOperatorSummary}</p>
          ) : null}
          {checkIn.customerSuccessVoiceLines.length > 0 ? (
            <ul className="space-y-2">
              {checkIn.customerSuccessVoiceLines.map((line) => (
                <li key={line} className="flex items-start gap-3 text-base leading-relaxed text-muted-foreground">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          {showDeliveryIntelligence && checkIn.serviceOperatorSummary ? (
            <p className="text-lg font-semibold text-sky-700 dark:text-sky-300">{checkIn.serviceOperatorSummary}</p>
          ) : null}
          {showDeliveryIntelligence && checkIn.serviceVoiceLines.length > 0 ? (
            <ul className="space-y-2">
              {checkIn.serviceVoiceLines.map((line) => (
                <li key={line} className="flex items-start gap-3 text-base leading-relaxed text-muted-foreground">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          {checkIn.hasContinuity && checkIn.continuityIntro ? (
            <>
              <p className="text-base font-medium text-foreground">{checkIn.continuityIntro}</p>
              <ul className="space-y-2.5">
                {checkIn.continuityBullets.map((line) => (
                  <li key={line} className="flex items-start gap-3 text-base leading-relaxed text-foreground">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="text-base font-medium text-foreground">{checkIn.foundIntro}</p>
              <ul className="space-y-2.5">
                {checkIn.foundObservations.map((line) => (
                  <li key={line} className="flex items-start gap-3 text-base leading-relaxed text-foreground">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </>
          )}
          {checkIn.calmLine ? (
            <p className="text-base font-medium text-emerald-700 dark:text-emerald-400">{checkIn.calmLine}</p>
          ) : (
            <p className="text-base font-medium text-foreground">{checkIn.needsReviewLine}</p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-base font-medium text-foreground">{checkIn.focusIntro}</p>
          <ul className="space-y-2">
            {checkIn.focusingOn.map((line) => (
              <li key={line} className="flex items-start gap-3 text-base leading-relaxed text-muted-foreground">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border/60 pt-6">
          <Button asChild size="lg" className="h-11">
            <Link href={checkIn.primaryCta.href}>
              {checkIn.primaryCta.label}
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11">
            <Link href={checkIn.secondaryCta.href}>{checkIn.secondaryCta.label}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
