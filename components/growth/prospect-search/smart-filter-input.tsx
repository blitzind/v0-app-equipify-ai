"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { buildFilterRecommendations } from "@/components/growth/prospect-search/search-recommendation-engine"
import { cn } from "@/lib/utils"

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
  const [focused, setFocused] = useState(false)
  const recommendations = useMemo(
    () =>
      buildFilterRecommendations({
        field,
        query: value,
        limit: 6,
      }),
    [field, value],
  )

  const showPanel = focused && value.trim().length > 0 && recommendations.length > 0

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        className="h-9"
      />
      {showPanel ? (
        <ul
          className={cn(
            "absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-popover py-1 shadow-md",
          )}
        >
          {recommendations.map((rec) => (
            <li key={rec.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(rec.value)
                  setFocused(false)
                }}
              >
                {rec.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
