"use client"

import { useEffect, useMemo, useState } from "react"
import {
  buildAvaWhatsChanged,
  captureAvaVisitSnapshot,
  type BuildAvaCognitiveProjectionInput,
} from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers"
import type { GrowthAvaVisitSnapshot } from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

const STORAGE_PREFIX = "ava-cognitive-visit-snapshot:"

function readPrevious(leadId: string): GrowthAvaVisitSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${leadId}`)
    if (!raw) return null
    return JSON.parse(raw) as GrowthAvaVisitSnapshot
  } catch {
    return null
  }
}

function writeSnapshot(leadId: string, snapshot: GrowthAvaVisitSnapshot) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${leadId}`, JSON.stringify(snapshot))
  } catch {
    // ignore quota / private mode
  }
}

type Props = {
  projectionInput: BuildAvaCognitiveProjectionInput
}

export function GrowthAvaWhatsChangedPanel({ projectionInput }: Props) {
  const leadId = projectionInput.lead.id
  const current = useMemo(() => captureAvaVisitSnapshot(projectionInput), [projectionInput])
  const [previous, setPrevious] = useState<GrowthAvaVisitSnapshot | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setPrevious(readPrevious(leadId))
    setHydrated(true)
  }, [leadId])

  useEffect(() => {
    if (!hydrated) return
    writeSnapshot(leadId, current)
  }, [hydrated, leadId, current])

  const changed = useMemo(() => {
    if (!hydrated) {
      return {
        bullets: ["Loading briefing…"],
        isFirstVisit: true,
        nextResearchLabel: null,
      }
    }
    return buildAvaWhatsChanged({
      current,
      previous,
      followUpAt: projectionInput.lead.followUpAt,
      lastProspectResearchedAt: projectionInput.lead.lastProspectResearchedAt,
    })
  }, [
    hydrated,
    current,
    previous,
    projectionInput.lead.followUpAt,
    projectionInput.lead.lastProspectResearchedAt,
  ])

  return (
    <div className="space-y-2" data-qa-marker="ge-aios-25b-whats-changed">
      <ul className="space-y-1 text-sm">
        {changed.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/70" aria-hidden />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      {changed.isFirstVisit ? (
        <p className="text-[11px] text-muted-foreground">Baseline saved for your next visit.</p>
      ) : null}
    </div>
  )
}
