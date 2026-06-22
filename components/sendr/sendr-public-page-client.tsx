"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { PresentationPageShell } from "@/components/growth/sendr/presentation/presentation-page-shell"
import { PresentationThemeProvider } from "@/components/growth/sendr/presentation/presentation-section"
import { SendrPublicPresentationLayout } from "@/components/growth/sendr/presentation/sendr-public-presentation-layout"
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

function getVisitorAttributionFromUrl(): { leadId?: string; token?: string } {
  if (typeof window === "undefined") return {}
  const params = new URLSearchParams(window.location.search)
  const leadId = params.get("leadId")?.trim()
  const token = params.get("token")?.trim()
  return {
    ...(leadId ? { leadId } : {}),
    ...(token ? { token } : {}),
  }
}

async function trackEvents(
  slug: string,
  sessionId: string,
  events: Array<{ eventType: string; eventValue?: Record<string, unknown> }>,
) {
  const attribution = getVisitorAttributionFromUrl()
  await fetch("/api/public/sendr/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      sessionId,
      pageUrl: window.location.href,
      ...attribution,
      events,
    }),
  }).catch(() => undefined)
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

  const onTrack = useCallback(
    (events: Array<{ eventType: string; eventValue?: Record<string, unknown> }>) => {
      void trackEvents(slug, sessionId, events)
    },
    [slug, sessionId],
  )

  const sendScroll = useCallback(() => {
    if (scrollSent.current) return
    const depth = Math.round(
      ((window.scrollY + window.innerHeight) / Math.max(document.body.scrollHeight, 1)) * 100,
    )
    if (depth >= 50) {
      scrollSent.current = true
      onTrack([{ eventType: "scroll", eventValue: { scrollDepthPct: depth } }])
    }
  }, [onTrack])

  useEffect(() => {
    onTrack([{ eventType: "page_view" }])
    const params = new URLSearchParams(window.location.search)
    if (params.get("booking") === "completed") {
      onTrack([{ eventType: "booking_completed" }])
    }
    window.addEventListener("scroll", sendScroll, { passive: true })
    return () => window.removeEventListener("scroll", sendScroll)
  }, [onTrack, sendScroll])

  return (
    <PresentationThemeProvider theme={page.theme}>
      <PresentationPageShell>
        <SendrPublicPresentationLayout page={page} onTrack={onTrack} />
      </PresentationPageShell>
    </PresentationThemeProvider>
  )
}
