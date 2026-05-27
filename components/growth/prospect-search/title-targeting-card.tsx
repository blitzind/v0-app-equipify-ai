"use client"

import { useMemo, useState } from "react"
import { TitleAutocomplete } from "@/components/growth/prospect-search/title-autocomplete"
import { TitlePillGroup } from "@/components/growth/prospect-search/title-pill-group"
import { TitleRecommendations } from "@/components/growth/prospect-search/title-recommendations"
import { GROWTH_TITLE_TARGETING_SMART_QA_MARKER } from "@/lib/growth/prospect-search/title-industry-mapping"
import {
  parseTitleChips,
  serializeTitleChips,
} from "@/lib/growth/prospect-search/title-suggestion-engine"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"

export function TitleTargetingCard({
  filters,
  onChange,
}: {
  filters: GrowthProspectSearchFilters
  onChange: (filters: GrowthProspectSearchFilters) => void
}) {
  const [draft, setDraft] = useState("")

  const selectedTitles = useMemo(
    () =>
      parseTitleChips(filters.title_contains ?? filters.decision_maker_role ?? null),
    [filters.title_contains, filters.decision_maker_role],
  )

  function applyTitles(nextTitles: string[]) {
    const unique = nextTitles.filter(
      (title, index, arr) =>
        arr.findIndex((t) => t.toLowerCase() === title.toLowerCase()) === index,
    )
    onChange({
      ...filters,
      ...serializeTitleChips(unique),
    })
  }

  function addTitle(title: string) {
    const cleaned = title.trim()
    if (!cleaned) return
    if (selectedTitles.some((t) => t.toLowerCase() === cleaned.toLowerCase())) return
    applyTitles([...selectedTitles, cleaned])
  }

  function removeTitle(title: string) {
    applyTitles(selectedTitles.filter((t) => t !== title))
  }

  function removeLastTitle() {
    if (!selectedTitles.length) return
    applyTitles(selectedTitles.slice(0, -1))
  }

  return (
    <div className="space-y-3" data-qa-marker={GROWTH_TITLE_TARGETING_SMART_QA_MARKER}>
      <TitlePillGroup titles={selectedTitles} onRemove={removeTitle} />
      <TitleAutocomplete
        value={draft}
        onChange={setDraft}
        onCommit={addTitle}
        onBackspaceEmpty={removeLastTitle}
        industry={filters.industry}
        selectedTitles={selectedTitles}
      />
      <TitleRecommendations
        industry={filters.industry}
        selectedTitles={selectedTitles}
        onPick={addTitle}
      />
      <p className="text-[10px] text-muted-foreground">
        Enter to add a title chip · Backspace removes the last chip · Matches existing title filter
        fields
      </p>
    </div>
  )
}
