"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { GrowthVideoPublicPage } from "@/lib/growth/videos/growth-video-types"

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `vs_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

async function trackEvent(input: {
  slug: string
  sessionId: string
  eventType: string
  metadata?: Record<string, unknown>
}) {
  await fetch("/api/growth/videos/page-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: input.slug,
      event_type: input.eventType,
      session_id: input.sessionId,
      metadata: input.metadata ?? {},
    }),
  }).catch(() => undefined)
}

export function GrowthVideoPublicPageView({ page }: { page: GrowthVideoPublicPage }) {
  const sessionId = useMemo(() => createSessionId(), [])
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [progressSent, setProgressSent] = useState(false)
  const [completeSent, setCompleteSent] = useState(false)

  const primaryColor = page.branding.primaryColor ?? "#2563eb"
  const ctaLabel = page.branding.buttonLabelOverride ?? page.ctaLabel

  useEffect(() => {
    void trackEvent({ slug: page.slug, sessionId, eventType: "page_view" })
  }, [page.slug, sessionId])

  function handlePlay() {
    void trackEvent({ slug: page.slug, sessionId, eventType: "video_play" })
  }

  function handleTimeUpdate() {
    const video = videoRef.current
    if (!video || !video.duration) return
    const pct = (video.currentTime / video.duration) * 100
    if (!progressSent && pct >= 25) {
      setProgressSent(true)
      void trackEvent({
        slug: page.slug,
        sessionId,
        eventType: "video_progress",
        metadata: { percent: Math.round(pct) },
      })
    }
    if (!completeSent && pct >= 90) {
      setCompleteSent(true)
      void trackEvent({
        slug: page.slug,
        sessionId,
        eventType: "video_complete",
        metadata: { percent: Math.round(pct) },
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8 flex items-center gap-4">
          {page.branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.branding.logoUrl} alt="" className="h-10 w-auto object-contain" />
          ) : (
            <div className="text-sm font-semibold tracking-wide text-slate-300">Equipify</div>
          )}
        </header>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
          {page.playbackUrl ? (
            <video
              ref={videoRef}
              className="aspect-video w-full bg-black"
              controls
              playsInline
              src={page.playbackUrl}
              onPlay={handlePlay}
              onTimeUpdate={handleTimeUpdate}
            />
          ) : (
            <div className="aspect-video flex items-center justify-center text-sm text-slate-400">
              Video unavailable
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
          {page.description ? <p className="text-slate-300">{page.description}</p> : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {ctaLabel && page.ctaUrl ? (
            <a
              href={page.ctaUrl}
              className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium text-white"
              style={{ backgroundColor: primaryColor }}
              onClick={() => void trackEvent({ slug: page.slug, sessionId, eventType: "cta_click" })}
            >
              {ctaLabel}
            </a>
          ) : null}
          {page.calendarUrl ? (
            <a
              href={page.calendarUrl}
              className="inline-flex items-center rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10"
              onClick={() => void trackEvent({ slug: page.slug, sessionId, eventType: "calendar_click" })}
            >
              Schedule a meeting
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
