"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { GROWTH_SHARE_PAGE_EVENT_TYPES, type GrowthSharePageEventType } from "@/lib/growth/share-pages/share-page-types"

const SESSION_STORAGE_KEY = "growth_share_page_session"
const HEARTBEAT_MS = 15_000
const SCROLL_MILESTONES = [25, 50, 75, 100] as const

type StoredSession = {
  sessionKey: string
  sharePageViewId: string | null
}

type SharePageTrackerContextValue = {
  trackEvent: (
    eventType: GrowthSharePageEventType,
    input?: {
      eventLabel?: string
      metadata?: Record<string, unknown>
    },
  ) => Promise<void>
}

const SharePageTrackerContext = createContext<SharePageTrackerContextValue | null>(null)

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed.sessionKey) return null
    return parsed
  } catch {
    return null
  }
}

function writeStoredSession(session: StoredSession): void {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

function createSessionKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `sp_${crypto.randomUUID()}`
  }
  return `sp_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function computeScrollDepthPct(): number {
  if (typeof document === "undefined") return 0
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const viewport = window.innerHeight || document.documentElement.clientHeight
  const fullHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 1)
  return Math.min(100, Math.round(((scrollTop + viewport) / fullHeight) * 100))
}

async function postSharePageEvent(
  publicToken: string,
  body: Record<string, unknown>,
  keepalive = false,
): Promise<{ sharePageViewId?: string } | null> {
  const response = await fetch(`/api/growth/share-pages/${encodeURIComponent(publicToken)}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
  })

  if (!response.ok) return null
  const json = (await response.json().catch(() => null)) as { sharePageViewId?: string } | null
  return json
}

export function useSharePageTracker(): SharePageTrackerContextValue {
  const context = useContext(SharePageTrackerContext)
  if (!context) {
    throw new Error("useSharePageTracker must be used within SharePageTracker")
  }
  return context
}

export function SharePageTracker({
  publicToken,
  children,
}: {
  publicToken: string
  children: ReactNode
}) {
  const [session] = useState<StoredSession>(() => readStoredSession() ?? { sessionKey: createSessionKey(), sharePageViewId: null })
  const sharePageViewIdRef = useRef<string | null>(session.sharePageViewId)
  const startedAtRef = useRef<number>(Date.now())
  const activeMsRef = useRef<number>(0)
  const lastActiveAtRef = useRef<number>(Date.now())
  const visibleRef = useRef<boolean>(true)
  const firedMilestonesRef = useRef<Set<number>>(new Set())
  const initializedRef = useRef(false)

  const buildPayload = useCallback(
    (eventType: GrowthSharePageEventType, input?: { eventLabel?: string; metadata?: Record<string, unknown> }) => {
      const now = Date.now()
      if (visibleRef.current) {
        activeMsRef.current += now - lastActiveAtRef.current
      }
      lastActiveAtRef.current = now

      return {
        eventType,
        sessionKey: session.sessionKey,
        sharePageViewId: sharePageViewIdRef.current,
        durationMs: activeMsRef.current,
        scrollDepthPct: computeScrollDepthPct(),
        eventLabel: input?.eventLabel,
        metadata: input?.metadata,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
        deviceMetadata: {
          viewport_width: typeof window !== "undefined" ? window.innerWidth : null,
          viewport_height: typeof window !== "undefined" ? window.innerHeight : null,
        },
      }
    },
    [session.sessionKey],
  )

  const trackEvent = useCallback(
    async (
      eventType: GrowthSharePageEventType,
      input?: { eventLabel?: string; metadata?: Record<string, unknown> },
    ) => {
      if (!(GROWTH_SHARE_PAGE_EVENT_TYPES as readonly string[]).includes(eventType)) return
      const result = await postSharePageEvent(publicToken, buildPayload(eventType, input))
      if (result?.sharePageViewId) {
        sharePageViewIdRef.current = result.sharePageViewId
        writeStoredSession({ sessionKey: session.sessionKey, sharePageViewId: result.sharePageViewId })
      }
    },
    [buildPayload, publicToken, session.sessionKey],
  )

  useEffect(() => {
    writeStoredSession({ sessionKey: session.sessionKey, sharePageViewId: sharePageViewIdRef.current })
  }, [session.sessionKey])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    void (async () => {
      await trackEvent("SHARE_PAGE_SESSION_STARTED")
      await trackEvent("SHARE_PAGE_VIEWED")
    })()
  }, [trackEvent])

  useEffect(() => {
    const onScroll = () => {
      const depth = computeScrollDepthPct()
      for (const milestone of SCROLL_MILESTONES) {
        if (depth >= milestone && !firedMilestonesRef.current.has(milestone)) {
          firedMilestonesRef.current.add(milestone)
          const eventType = `SHARE_PAGE_SCROLL_${milestone}` as GrowthSharePageEventType
          void trackEvent(eventType, { metadata: { scroll_depth_pct: milestone } })
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [trackEvent])

  useEffect(() => {
    const onVisibility = () => {
      const now = Date.now()
      if (document.visibilityState === "hidden") {
        if (visibleRef.current) {
          activeMsRef.current += now - lastActiveAtRef.current
        }
        visibleRef.current = false
      } else {
        visibleRef.current = true
        lastActiveAtRef.current = now
      }
    }

    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      void postSharePageEvent(publicToken, buildPayload("SHARE_PAGE_VIEWED", { metadata: { heartbeat: true } }))
    }, HEARTBEAT_MS)

    return () => window.clearInterval(heartbeat)
  }, [buildPayload, publicToken])

  useEffect(() => {
    const flush = () => {
      const payload = buildPayload("SHARE_PAGE_VIEWED", { metadata: { unload: true } })
      void postSharePageEvent(publicToken, payload, true)
    }

    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [buildPayload, publicToken])

  const value = useMemo(() => ({ trackEvent }), [trackEvent])

  return <SharePageTrackerContext.Provider value={value}>{children}</SharePageTrackerContext.Provider>
}
