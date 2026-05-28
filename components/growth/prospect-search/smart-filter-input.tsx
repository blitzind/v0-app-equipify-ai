"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { buildFilterRecommendations } from "@/components/growth/prospect-search/search-recommendation-engine"
import { APP_Z_FILTER_SUGGESTION } from "@/lib/layout/app-z-layers"
import { logProspectSearchFilterUxIssue } from "@/lib/growth/prospect-search/prospect-search-filter-ux"
import { cn } from "@/lib/utils"

type SuggestionPanelProps = {
  anchorRect: DOMRect
  recommendations: Array<{ id: string; label: string; value: string }>
  onPick: (value: string) => void
}

function FilterSuggestionPanel({ anchorRect, recommendations, onPick }: SuggestionPanelProps) {
  if (typeof document === "undefined") return null

  return createPortal(
    <ul
      role="listbox"
      className={cn(
        APP_Z_FILTER_SUGGESTION,
        "fixed max-h-48 overflow-auto rounded-lg border border-border bg-popover py-1 shadow-md",
      )}
      style={{
        top: anchorRect.bottom + 4,
        left: anchorRect.left,
        width: anchorRect.width,
      }}
    >
      {recommendations.map((rec) => (
        <li key={rec.id} role="option">
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(rec.value)
            }}
          >
            {rec.label}
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  )
}

export function SmartFilterInput({
  label,
  value,
  onChange,
  field,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  field: "industry" | "location" | "technology" | "role"
  placeholder?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const recommendations = useMemo(() => {
    try {
      return buildFilterRecommendations({
        field,
        query: value,
        limit: 6,
      })
    } catch (error) {
      logProspectSearchFilterUxIssue("filter_suggestion_fetch_failed", {
        field,
        message: error instanceof Error ? error.message : "unknown",
      })
      return []
    }
  }, [field, value])

  const showPanel = focused && value.trim().length > 0 && recommendations.length > 0

  const syncAnchor = useCallback(() => {
    const el = inputRef.current
    if (!el) {
      setAnchorRect(null)
      return
    }
    setAnchorRect(el.getBoundingClientRect())
  }, [])

  useLayoutEffect(() => {
    if (!showPanel) {
      setAnchorRect(null)
      return
    }
    syncAnchor()
  }, [showPanel, syncAnchor, value, recommendations.length])

  useEffect(() => {
    if (!showPanel) return
    const handleReposition = () => syncAnchor()
    window.addEventListener("resize", handleReposition)
    window.addEventListener("scroll", handleReposition, true)
    return () => {
      window.removeEventListener("resize", handleReposition)
      window.removeEventListener("scroll", handleReposition, true)
    }
  }, [showPanel, syncAnchor])

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        className="h-9"
        autoComplete="off"
        aria-autocomplete="list"
      />
      {showPanel && anchorRect ? (
        <FilterSuggestionPanel
          anchorRect={anchorRect}
          recommendations={recommendations}
          onPick={(next) => {
            onChange(next)
            setFocused(false)
          }}
        />
      ) : null}
    </div>
  )
}
