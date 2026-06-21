"use client"

import { useRef } from "react"
import { Clock, Play, Sparkles } from "lucide-react"
import { PresentationCard } from "@/components/growth/sendr/presentation/presentation-card"
import { formatWalkthroughDuration } from "@/lib/growth/sendr/growth-sendr-presentation-content"
import { cn } from "@/lib/utils"

export type PresentationVideoPlayback = {
  sourceUrl: string | null
  posterUrl?: string | null
  durationSeconds?: number | null
  videoAssetId?: string | null
}

type Props = {
  title?: string
  subtitle?: string
  preparedFor?: string | null
  personalized?: boolean
  playback: PresentationVideoPlayback
  onVideoStart?: () => void
  onVideoProgress?: (progressPct: number) => void
  onVideoComplete?: () => void
  className?: string
}

function formatDurationBadge(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds <= 0) return null
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0 && secs > 0) return `${mins}m ${secs}s`
  if (mins > 0) return `${mins} min`
  return `${secs}s`
}

export function PresentationVideoHero({
  title,
  subtitle,
  preparedFor,
  personalized = false,
  playback,
  onVideoStart,
  onVideoProgress,
  onVideoComplete,
  className,
}: Props) {
  const started = useRef(false)
  const durationBadge = formatDurationBadge(playback.durationSeconds)
  const walkthroughLabel = formatWalkthroughDuration(playback.durationSeconds)

  return (
    <PresentationCard variant="elevated" className={cn("overflow-hidden p-0", className)}>
      <div className="border-b border-slate-200/80 px-5 py-5 dark:border-slate-800 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                Personalized video
              </p>
              {personalized ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  <Sparkles className="size-3" />
                  For your team
                </span>
              ) : null}
            </div>
            {title ? (
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                {title}
              </h2>
            ) : null}
            {preparedFor ? (
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Prepared exclusively for {preparedFor}
              </p>
            ) : subtitle ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">{subtitle}</p>
            ) : null}
          </div>
          {durationBadge ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Clock className="size-3.5" />
              {durationBadge}
            </span>
          ) : null}
        </div>
      </div>

      <div className="bg-black">
        {playback.sourceUrl ? (
          <video
            controls
            playsInline
            className="aspect-video w-full bg-black lg:min-h-[420px] lg:object-cover"
            poster={playback.posterUrl ?? undefined}
            onPlay={() => {
              if (started.current) return
              started.current = true
              onVideoStart?.()
            }}
            onEnded={() => onVideoComplete?.()}
            onTimeUpdate={(e) => {
              const el = e.currentTarget
              if (!el.duration) return
              const pct = Math.round((el.currentTime / el.duration) * 100)
              if (pct % 25 === 0 && pct > 0) onVideoProgress?.(pct)
            }}
          >
            <source src={playback.sourceUrl} />
          </video>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400 lg:min-h-[420px]">
            <span className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Play className="size-7" />
            </span>
            <p className="text-sm">Video will appear here once attached.</p>
          </div>
        )}
      </div>

      {playback.sourceUrl && (walkthroughLabel || personalized) ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200/80 px-5 py-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400 sm:px-8">
          {walkthroughLabel ? <span>{walkthroughLabel}</span> : null}
          {personalized ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <Sparkles className="size-3.5 text-blue-500" />
              Prepared for your team
            </span>
          ) : null}
        </div>
      ) : null}
    </PresentationCard>
  )
}
