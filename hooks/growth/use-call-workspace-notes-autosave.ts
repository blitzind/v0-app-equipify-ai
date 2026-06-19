"use client"

import { useEffect, useRef } from "react"

export function useCallWorkspaceNotesAutosave(input: {
  sessionId: string | null | undefined
  notesDraft: string
  enabled: boolean
  onSaved?: (notesDraft: string) => void
}) {
  const { sessionId, notesDraft, enabled, onSaved } = input
  const lastSavedRef = useRef(notesDraft)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    lastSavedRef.current = notesDraft
  }, [sessionId])

  useEffect(() => {
    if (!enabled || !sessionId) return
    if (notesDraft === lastSavedRef.current) return

    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      void fetch(`/api/platform/growth/calls/sessions/${sessionId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notesDraft }),
      })
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; session?: { notesDraft?: string } }
          if (!res.ok || !data.ok) return
          lastSavedRef.current = notesDraft
          onSaved?.(data.session?.notesDraft ?? notesDraft)
        })
        .catch(() => undefined)
    }, 1000)

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [enabled, notesDraft, onSaved, sessionId])
}
