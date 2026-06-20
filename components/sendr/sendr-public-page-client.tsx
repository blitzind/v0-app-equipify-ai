"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { GrowthSendrPublicPagePayload } from "@/lib/growth/sendr/growth-sendr-types"

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server"
  const key = "sendr_session_id"
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const next = crypto.randomUUID()
  sessionStorage.setItem(key, next)
  return next
}

async function trackEvents(
  slug: string,
  sessionId: string,
  events: Array<{ eventType: string; eventValue?: Record<string, unknown> }>,
) {
  await fetch("/api/public/sendr/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      sessionId,
      pageUrl: window.location.href,
      events,
    }),
  }).catch(() => undefined)
}

function SectionBlock({
  section,
  slug,
  sessionId,
  video,
  booking,
}: {
  section: GrowthSendrPublicPagePayload["sections"][number]
  slug: string
  sessionId: string
  video: GrowthSendrPublicPagePayload["video"]
  booking: GrowthSendrPublicPagePayload["booking"]
}) {
  const videoStarted = useRef(false)
  const content = section.content

  if (section.type === "hero" || section.type === "text") {
    return (
      <section className="space-y-2">
        {typeof content.headline === "string" ? (
          <h2 className="text-2xl font-semibold">{content.headline}</h2>
        ) : null}
        {typeof content.body === "string" ? (
          <p className="text-muted-foreground whitespace-pre-wrap">{content.body}</p>
        ) : null}
      </section>
    )
  }

  if (section.type === "video" && video) {
    return (
      <section className="space-y-3">
        <h3 className="text-lg font-medium">Video</h3>
        {video.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.posterUrl} alt="" className="max-h-64 rounded-md object-cover" />
        ) : null}
        {video.sourceUrl ? (
          <video
            controls
            className="w-full max-w-2xl rounded-md"
            poster={video.posterUrl ?? undefined}
            onPlay={() => {
              if (videoStarted.current) return
              videoStarted.current = true
              void trackEvents(slug, sessionId, [{ eventType: "video_start" }])
            }}
            onEnded={() => void trackEvents(slug, sessionId, [{ eventType: "video_complete" }])}
            onTimeUpdate={(e) => {
              const el = e.currentTarget
              if (!el.duration) return
              const pct = Math.round((el.currentTime / el.duration) * 100)
              if (pct % 25 === 0 && pct > 0) {
                void trackEvents(slug, sessionId, [
                  { eventType: "video_progress", eventValue: { progressPct: pct } },
                ])
              }
            }}
          >
            <source src={video.sourceUrl} />
          </video>
        ) : (
          <p className="text-sm text-muted-foreground">Video metadata registered — no source URL.</p>
        )}
        {video.durationSeconds ? (
          <p className="text-xs text-muted-foreground">Duration: {video.durationSeconds}s</p>
        ) : null}
      </section>
    )
  }

  if (section.type === "calendar" || section.type === "cta") {
    const label =
      typeof content.label === "string"
        ? content.label
        : section.type === "calendar"
          ? "Book a meeting"
          : "Get started"
    const href =
      typeof content.href === "string"
        ? content.href
        : booking?.meetingLink ?? undefined

    return (
      <section>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              const events = [{ eventType: "cta_click", eventValue: { label } }]
              if (section.type === "calendar" || booking?.meetingLink) {
                events.push({ eventType: "calendar_open" }, { eventType: "booking_started" })
              }
              void trackEvents(slug, sessionId, events)
            }}
          >
            {label}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">CTA configured — no link attached.</p>
        )}
      </section>
    )
  }

  if (section.type === "faq") {
    const items = Array.isArray(content.items) ? content.items : []
    return (
      <section className="space-y-3">
        <h3 className="text-lg font-medium">FAQ</h3>
        {items.map((item, index) => {
          const row = item as Record<string, unknown>
          return (
            <div key={index} className="rounded-md border p-3">
              <p className="font-medium">{String(row.question ?? "")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{String(row.answer ?? "")}</p>
            </div>
          )
        })}
      </section>
    )
  }

  if (section.type === "custom_html" && typeof content.html === "string") {
    return (
      <section
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: content.html }}
      />
    )
  }

  return null
}

export function SendrPublicPageClient({
  slug,
  page,
}: {
  slug: string
  page: GrowthSendrPublicPagePayload
}) {
  const sessionId = useMemo(() => getOrCreateSessionId(), [])
  const scrollSent = useRef(false)

  const sendScroll = useCallback(() => {
    if (scrollSent.current) return
    const depth = Math.round(
      ((window.scrollY + window.innerHeight) / Math.max(document.body.scrollHeight, 1)) * 100,
    )
    if (depth >= 50) {
      scrollSent.current = true
      void trackEvents(slug, sessionId, [{ eventType: "scroll", eventValue: { scrollDepthPct: depth } }])
    }
  }, [slug, sessionId])

  useEffect(() => {
    void trackEvents(slug, sessionId, [{ eventType: "page_view" }])
    const params = new URLSearchParams(window.location.search)
    if (params.get("booking") === "completed") {
      void trackEvents(slug, sessionId, [{ eventType: "booking_completed" }])
    }
    window.addEventListener("scroll", sendScroll, { passive: true })
    return () => window.removeEventListener("scroll", sendScroll)
  }, [slug, sessionId, sendScroll])

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <header className="space-y-1 border-b pb-6">
          <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
          <p className="text-xs text-muted-foreground">
            Published v{page.publishedVersion} · {new Date(page.publishedAt).toLocaleDateString()}
          </p>
        </header>

        {page.sections.map((section, index) => (
          <SectionBlock
            key={`${section.type}-${section.sortOrder}-${index}`}
            section={section}
            slug={slug}
            sessionId={sessionId}
            video={page.video}
            booking={page.booking}
          />
        ))}
      </main>
    </div>
  )
}
