"use client"

import { useMemo, useRef, useState } from "react"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import {
  PROSPECT_SEARCH_VIRTUALIZATION_WINDOW,
  GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER,
  sliceProspectSearchVirtualWindow,
} from "@/lib/growth/prospect-search/prospect-search-scalable-pagination"

const ROW_HEIGHT = 56

export function ProspectSearchVirtualizedPeopleList({
  rows,
  renderRow,
}: {
  rows: GrowthProspectSearchPeopleResultRow[]
  renderRow: (row: GrowthProspectSearchPeopleResultRow, index: number) => React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const viewportHeight = PROSPECT_SEARCH_VIRTUALIZATION_WINDOW * ROW_HEIGHT

  const windowSlice = useMemo(
    () =>
      sliceProspectSearchVirtualWindow(rows, scrollTop, ROW_HEIGHT, viewportHeight),
    [rows, scrollTop, viewportHeight],
  )

  if (rows.length <= PROSPECT_SEARCH_VIRTUALIZATION_WINDOW) {
    return (
      <div data-scalable-prospect-search-marker={GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER}>
        {rows.map((row, index) => renderRow(row, index))}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-xl border border-border"
      style={{ maxHeight: viewportHeight }}
      data-scalable-prospect-search-marker={GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER}
      data-virtualization-layer="v1"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: rows.length * ROW_HEIGHT, position: "relative" }}>
        <div style={{ transform: `translateY(${windowSlice.offsetY}px)` }}>
          {windowSlice.visible.map((row, index) => renderRow(row, windowSlice.start + index))}
        </div>
      </div>
    </div>
  )
}
