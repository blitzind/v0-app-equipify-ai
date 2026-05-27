"use client"

import { useMemo, useState } from "react"
import { suggestTitles } from "@/lib/growth/prospect-search/title-suggestion-engine"
import { cn } from "@/lib/utils"

export function TitleAutocomplete({
  value,
  onChange,
  onCommit,
  onBackspaceEmpty,
  industry,
  selectedTitles,
  placeholder = "Type a title — e.g. oper, bio, Director",
}: {
  value: string
  onChange: (value: string) => void
  onCommit: (title: string) => void
  onBackspaceEmpty: () => void
  industry?: string | null
  selectedTitles: string[]
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)

  const suggestions = useMemo(
    () =>
      suggestTitles({
        query: value,
        industry,
        selected: selectedTitles,
        limit: 8,
      }),
    [value, industry, selectedTitles],
  )

  const showPanel = focused && value.trim().length > 0 && suggestions.length > 0
  const activeSuggestion = suggestions[highlightIndex]

  function commit(title: string) {
    const cleaned = title.trim()
    if (!cleaned) return
    onCommit(cleaned)
    onChange("")
    setHighlightIndex(0)
  }

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        Title targeting
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setHighlightIndex(0)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1))
            return
          }
          if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlightIndex((i) => Math.max(i - 1, 0))
            return
          }
          if (e.key === "Enter") {
            e.preventDefault()
            if (activeSuggestion) commit(activeSuggestion.title)
            else if (value.trim()) commit(value)
            return
          }
          if (e.key === "Backspace" && !value.trim()) {
            e.preventDefault()
            onBackspaceEmpty()
          }
        }}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      />
      {showPanel ? (
        <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-border bg-popover py-1 shadow-md">
          {suggestions.map((row, index) => (
            <li key={row.title}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted",
                  index === highlightIndex && "bg-muted",
                )}
                onMouseDown={(event) => {
                  event.preventDefault()
                  commit(row.title)
                }}
              >
                <span>{row.title}</span>
                {row.group ? (
                  <span className="text-[10px] text-muted-foreground">{row.group}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
