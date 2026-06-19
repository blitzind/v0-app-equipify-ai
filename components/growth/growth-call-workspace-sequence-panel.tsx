"use client"

import { useCallback, useEffect, useState } from "react"
import { GitBranch, Loader2, Pause, Play, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_CALL_WORKSPACE_OPS_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-operator-types"
import {
  formatSequencePatternTitleFromPattern,
  formatSequenceUserMessage,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-ui"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"

type SequencePayload = {
  sequence?: {
    recommendedPatternId: string | null
    recommendedReason: string | null
    recommendedConfidence: number | null
    activeEnrollmentId: string | null
    fatigueRisk: string | null
  }
  enrollment?: { id: string; status: string } | null
}

export function GrowthCallWorkspaceSequencePanel({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<SequencePayload | null>(null)
  const [patternTitle, setPatternTitle] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [enrollmentRes, patternsRes] = await Promise.all([
        fetch(`/api/platform/growth/leads/${leadId}/sequence-enrollments`, { cache: "no-store" }),
        fetch("/api/platform/growth/sequences/patterns", { cache: "no-store" }),
      ])
      const enrollmentData = (await enrollmentRes.json().catch(() => ({}))) as SequencePayload & {
        ok?: boolean
        message?: string
      }
      const patternsData = (await patternsRes.json().catch(() => ({}))) as {
        patterns?: GrowthSequencePattern[]
      }
      if (!enrollmentRes.ok) throw new Error(enrollmentData.message ?? "Could not load sequence state.")
      setPayload(enrollmentData)
      const pattern = patternsData.patterns?.find(
        (entry) => entry.id === enrollmentData.sequence?.recommendedPatternId,
      )
      setPatternTitle(pattern ? formatSequencePatternTitleFromPattern(pattern) : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sequences.")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  async function postEnrollment(path: string, body?: Record<string, unknown>) {
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${leadId}${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || data.ok === false) {
        throw new Error(formatSequenceUserMessage({ code: data.error, message: data.message }))
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sequence action failed.")
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/50 p-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading sequence intelligence…
      </div>
    )
  }

  const sequence = payload?.sequence
  const enrollment = payload?.enrollment

  return (
    <section
      className="space-y-3 rounded-xl border border-border/60 bg-card/80 p-3 dark:border-white/5"
      data-growth-call-workspace-ops-marker={GROWTH_CALL_WORKSPACE_OPS_QA_MARKER}
      data-qa-action="call-workspace-sequence-panel"
    >
      <div className="flex items-center gap-2">
        <GitBranch className="size-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Recommended sequences</h4>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {sequence?.recommendedPatternId ? (
        <div className="rounded-lg border border-border/50 px-3 py-2 dark:border-white/5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Sparkles className="size-3.5 text-emerald-600" />
            <p className="text-sm font-medium">{patternTitle ?? "Recommended sequence"}</p>
            {sequence.recommendedConfidence != null ? (
              <GrowthBadge label={`${sequence.recommendedConfidence}% confidence`} tone="healthy" />
            ) : null}
          </div>
          {sequence.recommendedReason ? (
            <p className="text-xs text-muted-foreground">{sequence.recommendedReason}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No sequence recommendation yet for this lead.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {!enrollment && sequence?.recommendedPatternId ? (
          <Button
            type="button"
            size="sm"
            disabled={acting}
            onClick={() => void postEnrollment("/sequence-enrollments", { patternId: sequence.recommendedPatternId })}
          >
            Enroll
          </Button>
        ) : null}
        {enrollment?.status === "active" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={acting}
            onClick={() => void postEnrollment(`/sequence-enrollments/${enrollment.id}/pause`, { reason: "call_workspace" })}
          >
            <Pause className="mr-1.5 size-3.5" />
            Pause
          </Button>
        ) : null}
        {enrollment?.status === "paused" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={acting}
            onClick={() => void postEnrollment(`/sequence-enrollments/${enrollment.id}/resume`)}
          >
            <Play className="mr-1.5 size-3.5" />
            Resume
          </Button>
        ) : null}
      </div>
    </section>
  )
}
