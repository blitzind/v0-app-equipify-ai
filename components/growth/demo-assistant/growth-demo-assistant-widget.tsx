"use client"

import { Loader2, MessageSquare, Send, Sparkles } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { GE_V1_4_DEFAULT_BOOKING_PATH } from "@/lib/growth/demo-assistant/ge-v1-4-types"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  role: "assistant" | "user"
  content: string
}

type GrowthDemoAssistantWidgetProps = {
  slug: string
  publicSessionId: string
  bookingUrl?: string | null
  previewMode?: boolean
  onTrack?: (
    events: Array<{ eventType: string; eventValue?: Record<string, unknown> }>,
  ) => void
}

function getAttributionFromUrl(): { leadId?: string; token?: string } {
  if (typeof window === "undefined") return {}
  const params = new URLSearchParams(window.location.search)
  const leadId = params.get("leadId")?.trim()
  const token = params.get("token")?.trim()
  return {
    ...(leadId ? { leadId } : {}),
    ...(token ? { token } : {}),
  }
}

function resolveBookingHref(bookingUrl?: string | null): string {
  const trimmed = bookingUrl?.trim()
  if (!trimmed) return GE_V1_4_DEFAULT_BOOKING_PATH
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  if (trimmed.startsWith("/")) return trimmed
  return `/${trimmed}`
}

export function GrowthDemoAssistantWidget({
  slug,
  publicSessionId,
  bookingUrl,
  previewMode = false,
  onTrack,
}: GrowthDemoAssistantWidgetProps) {
  const inputId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [demoSessionId, setDemoSessionId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeBookingUrl, setActiveBookingUrl] = useState<string | null>(
    bookingUrl ?? null,
  )

  const scrollToBottom = useCallback(() => {
    const node = listRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (demoSessionId) return demoSessionId
    if (previewMode) return "preview-session"

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/public/demo-assistant/${encodeURIComponent(slug)}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicSessionId,
          ...getAttributionFromUrl(),
        }),
      })
      const payload = (await response.json()) as {
        ok?: boolean
        sessionId?: string
        bookingUrl?: string | null
        error?: string
      }
      if (!response.ok || !payload.ok || !payload.sessionId) {
        throw new Error(payload.error ?? "session_failed")
      }
      setDemoSessionId(payload.sessionId)
      if (payload.bookingUrl) setActiveBookingUrl(payload.bookingUrl)
      return payload.sessionId
    } catch {
      setError("The demo assistant is temporarily unavailable. You can still book a demo below.")
      return null
    } finally {
      setLoading(false)
    }
  }, [demoSessionId, previewMode, publicSessionId, slug])

  const openWidget = useCallback(async () => {
    setOpen(true)
    if (messages.length > 0) return

    if (previewMode) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "Hi — I'm the Equipify Demo Assistant. Ask about work orders, scheduling, QuickBooks, or how a demo works.",
        },
      ])
      return
    }

    const sessionId = await ensureSession()
    if (!sessionId) return

    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hi — I'm the Equipify Demo Assistant. Ask me anything about how Equipify helps field service teams.",
      },
    ])
  }, [ensureSession, messages.length, previewMode])

  const sendQuestion = useCallback(async () => {
    const question = input.trim()
    if (!question || loading) return

    if (previewMode) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: question },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Preview mode — live answers appear on published personalized pages when the demo assistant is enabled.",
        },
      ])
      setInput("")
      return
    }

    setLoading(true)
    setError(null)
    setInput("")

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: question }])

    try {
      const sessionId = await ensureSession()
      if (!sessionId) return

      const response = await fetch(`/api/public/demo-assistant/${encodeURIComponent(slug)}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demoSessionId: sessionId,
          publicSessionId,
          question,
          ...getAttributionFromUrl(),
        }),
      })

      const payload = (await response.json()) as {
        ok?: boolean
        answer?: string
        bookingOffered?: boolean
        bookingUrl?: string | null
        error?: string
      }

      if (!response.ok || !payload.ok || !payload.answer) {
        throw new Error(payload.error ?? "ask_failed")
      }

      if (payload.bookingUrl) setActiveBookingUrl(payload.bookingUrl)

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: payload.answer ?? "" },
      ])
    } catch {
      setError("Sorry — I couldn't answer that right now. Try again or book a demo directly.")
    } finally {
      setLoading(false)
    }
  }, [ensureSession, input, loading, previewMode, publicSessionId, slug])

  const handleBookDemo = useCallback(() => {
    const href = resolveBookingHref(activeBookingUrl)
    onTrack?.([
      { eventType: "booking_started", eventValue: { source: "demo_assistant" } },
      { eventType: "cta_click", eventValue: { label: "Book Demo" } },
    ])

    if (!previewMode && demoSessionId) {
      void fetch(`/api/public/demo-assistant/${encodeURIComponent(slug)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demoSessionId,
          publicSessionId,
          bookingStarted: true,
          ...getAttributionFromUrl(),
        }),
      }).catch(() => undefined)
    }
  }, [activeBookingUrl, demoSessionId, onTrack, previewMode, publicSessionId, slug])

  useEffect(() => {
    if (previewMode || !demoSessionId) return

    const completeSession = () => {
      void fetch(`/api/public/demo-assistant/${encodeURIComponent(slug)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demoSessionId,
          publicSessionId,
          ...getAttributionFromUrl(),
        }),
      }).catch(() => undefined)
    }

    window.addEventListener("beforeunload", completeSession)
    return () => {
      window.removeEventListener("beforeunload", completeSession)
      completeSession()
    }
  }, [demoSessionId, previewMode, publicSessionId, slug])

  const bookHref = resolveBookingHref(activeBookingUrl)

  return (
    <section
      className="rounded-2xl border p-5 sm:p-6"
      style={{
        borderColor: "color-mix(in srgb, var(--sendr-page-text) 12%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--sendr-page-surface) 88%, transparent)",
      }}
      aria-label="Equipify demo assistant"
    >
      {!open ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: "color-mix(in srgb, var(--sendr-page-accent) 18%, transparent)",
                color: "var(--sendr-page-accent)",
              }}
            >
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--sendr-page-text)" }}>
                Questions?
              </p>
              <p
                className="mt-1 text-sm"
                style={{ color: "color-mix(in srgb, var(--sendr-page-text) 70%, transparent)" }}
              >
                Ask Equipify AI about features, integrations, and booking a demo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void openWidget()}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--sendr-page-button-bg)",
              color: "var(--sendr-page-button-text)",
            }}
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Ask Equipify AI
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: "var(--sendr-page-accent)" }} aria-hidden="true" />
              <h3 className="text-sm font-semibold" style={{ color: "var(--sendr-page-text)" }}>
                Equipify Demo Assistant
              </h3>
            </div>
            <button
              type="button"
              className="text-xs underline-offset-2 hover:underline"
              style={{ color: "color-mix(in srgb, var(--sendr-page-text) 65%, transparent)" }}
              onClick={() => setOpen(false)}
            >
              Minimize
            </button>
          </div>

          <div
            ref={listRef}
            className="max-h-72 space-y-3 overflow-y-auto rounded-xl p-3"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            style={{
              backgroundColor: "color-mix(in srgb, var(--sendr-page-bg) 65%, transparent)",
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  message.role === "user" ? "ml-auto text-right" : "mr-auto text-left",
                )}
                style={
                  message.role === "user"
                    ? {
                        backgroundColor: "var(--sendr-page-accent)",
                        color: "var(--sendr-page-button-text)",
                      }
                    : {
                        backgroundColor: "color-mix(in srgb, var(--sendr-page-surface) 92%, white)",
                        color: "var(--sendr-page-text)",
                      }
                }
              >
                {message.content}
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--sendr-page-text)" }}>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Thinking…</span>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              void sendQuestion()
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Ask a question about Equipify
            </label>
            <input
              id={inputId}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="e.g. Does Equipify integrate with QuickBooks?"
              disabled={loading}
              className="min-h-11 flex-1 rounded-full border px-4 text-sm outline-none focus:ring-2"
              style={{
                borderColor: "color-mix(in srgb, var(--sendr-page-text) 15%, transparent)",
                backgroundColor: "var(--sendr-page-bg)",
                color: "var(--sendr-page-text)",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium disabled:opacity-50"
              style={{
                backgroundColor: "var(--sendr-page-button-bg)",
                color: "var(--sendr-page-button-text)",
              }}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send
            </button>
          </form>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p
              className="text-xs"
              style={{ color: "color-mix(in srgb, var(--sendr-page-text) 55%, transparent)" }}
            >
              Answers are guidance only — book a demo for pricing and tailored recommendations.
            </p>
            <a
              href={bookHref}
              onClick={handleBookDemo}
              className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium"
              style={{
                borderColor: "color-mix(in srgb, var(--sendr-page-accent) 40%, transparent)",
                color: "var(--sendr-page-accent)",
              }}
            >
              Book Demo
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
