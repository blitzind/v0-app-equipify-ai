"use client"

import { useCallback, useState } from "react"
import { Check, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_AVA_ACTIVATION_API_PATH,
  GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
  GROWTH_AVA_ACTIVATION_CTA,
  GROWTH_AVA_ACTIVATION_OUTBOUND_NOTE,
  GROWTH_AVA_ACTIVATION_SCREEN_INTRO,
  GROWTH_AVA_ACTIVATION_SCREEN_PROMISES,
  GROWTH_AVA_ACTIVATION_SCREEN_TITLE,
  type GrowthAvaActivationApiResponse,
  type GrowthAvaActivationState,
} from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"

type Props = {
  activation: GrowthAvaActivationState
  onActivated?: () => void
}

export function GrowthHomeAvaActivationSection({ activation, onActivated }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [immediateLines, setImmediateLines] = useState<string[] | null>(null)

  const activate = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(GROWTH_AVA_ACTIVATION_API_PATH, { method: "POST" })
      const payload = (await response.json()) as GrowthAvaActivationApiResponse
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Activation failed. Try again in a moment.")
      }
      if (payload.immediateTick?.operatorLines?.length) {
        setImmediateLines(payload.immediateTick.operatorLines)
      }
      onActivated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed.")
    } finally {
      setBusy(false)
    }
  }, [onActivated])

  if (!activation.readiness.ready || activation.activated) return null

  return (
    <section
      data-qa-section="home-ava-activation"
      data-qa-marker-launch-1c={GROWTH_AVA_ACTIVATION_1C_QA_MARKER}
      className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 via-card to-card p-6 shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/30"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-indigo-100 p-2 dark:bg-indigo-900/50">
          <Sparkles className="size-5 text-indigo-700 dark:text-indigo-300" aria-hidden />
        </div>
        <div className="space-y-4 flex-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              {GROWTH_AVA_ACTIVATION_SCREEN_TITLE}
            </p>
            <p className="mt-2 text-base text-foreground">{GROWTH_AVA_ACTIVATION_SCREEN_INTRO}</p>
            <p className="mt-3 text-sm text-muted-foreground">When you activate me I will:</p>
            <ul className="mt-2 space-y-2">
              {GROWTH_AVA_ACTIVATION_SCREEN_PROMISES.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">{GROWTH_AVA_ACTIVATION_OUTBOUND_NOTE}</p>
          </div>

          {activation.readiness.blockers.length > 0 ? (
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-sm font-medium text-foreground">Before I can start:</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {activation.readiness.blockers.map((blocker) => (
                  <li key={blocker.id}>{blocker.summary}</li>
                ))}
              </ul>
            </div>
          ) : (
            <Button type="button" size="lg" disabled={busy} onClick={() => void activate()}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {GROWTH_AVA_ACTIVATION_CTA}
            </Button>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {immediateLines && immediateLines.length > 0 ? (
            <div
              data-qa-section="home-ava-activation-immediate-tick"
              className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                What happened next
              </p>
              <ol className="mt-2 space-y-1.5">
                {immediateLines.map((line) => (
                  <li key={line} className="text-sm text-foreground">
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
