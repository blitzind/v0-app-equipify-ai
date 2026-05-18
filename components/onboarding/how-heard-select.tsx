"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { ChevronDown, Search } from "lucide-react"
import {
  HOW_HEARD_ABOUT_EQUIPIFY_OPTIONS,
  HOW_HEARD_ABOUT_EQUIPIFY_OTHER_VALUE,
  type HowHeardAboutEquipifyValue,
} from "@/lib/onboarding/how-heard-about-equipify"

type HowHeardSelectProps = {
  value: HowHeardAboutEquipifyValue | ""
  otherValue: string
  onValueChange: (value: HowHeardAboutEquipifyValue | "") => void
  onOtherChange: (value: string) => void
  otherError?: string | null
  disabled?: boolean
}

export function HowHeardSelect({
  value,
  otherValue,
  onValueChange,
  onOtherChange,
  otherError,
  disabled = false,
}: HowHeardSelectProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selectedLabel = useMemo(() => {
    if (!value) return ""
    return HOW_HEARD_ABOUT_EQUIPIFY_OPTIONS.find((o) => o.value === value)?.label ?? ""
  }, [value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return HOW_HEARD_ABOUT_EQUIPIFY_OPTIONS
    return HOW_HEARD_ABOUT_EQUIPIFY_OPTIONS.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.includes(q),
    )
  }, [query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
  }, [])

  useEffect(() => {
    if (!open) return
    function onDocPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener("mousedown", onDocPointer)
    return () => document.removeEventListener("mousedown", onDocPointer)
  }, [open, close])

  function pick(next: HowHeardAboutEquipifyValue) {
    onValueChange(next)
    if (next !== HOW_HEARD_ABOUT_EQUIPIFY_OTHER_VALUE) {
      onOtherChange("")
    }
    close()
  }

  return (
    <div ref={rootRef} className="space-y-3">
      <div className="relative">
        <label id={`${listboxId}-label`} className="block text-sm font-medium text-gray-700 mb-1.5">
          How did you hear about Equipify?
          <span className="text-gray-400 font-normal ml-1">(optional)</span>
        </label>
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${listboxId}-label`}
          onClick={() => {
            if (disabled) return
            setOpen((o) => !o)
          }}
          className="portal-select w-full flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className={selectedLabel ? "text-gray-900" : "text-gray-400"}>
            {selectedLabel || "Select an option…"}
          </span>
          <ChevronDown size={16} className="shrink-0 text-gray-400" aria-hidden />
        </button>

        {open ? (
          <div
            className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg"
            style={{ borderColor: "#e5e7eb" }}
          >
            <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "#e5e7eb" }}>
              <Search size={14} className="text-gray-400 shrink-0" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search options…"
                className="w-full border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                autoComplete="off"
                aria-label="Search how you heard about Equipify"
              />
            </div>
            <ul
              id={listboxId}
              role="listbox"
              aria-labelledby={`${listboxId}-label`}
              className="max-h-52 overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500">No matches.</li>
              ) : (
                filtered.map((opt) => {
                  const selected = value === opt.value
                  return (
                    <li key={opt.value} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => pick(opt.value)}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                          selected ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {value === HOW_HEARD_ABOUT_EQUIPIFY_OTHER_VALUE ? (
        <div>
          <label htmlFor={`${listboxId}-other`} className="block text-sm font-medium text-gray-700 mb-1.5">
            Please tell us how you found us
            <span className="text-red-500 ml-0.5" aria-hidden>
              *
            </span>
          </label>
          <input
            id={`${listboxId}-other`}
            type="text"
            value={otherValue}
            onChange={(e) => onOtherChange(e.target.value)}
            className="portal-input"
            placeholder="e.g. industry newsletter, friend at another shop…"
            maxLength={200}
            aria-invalid={Boolean(otherError)}
            aria-describedby={otherError ? `${listboxId}-other-error` : undefined}
            disabled={disabled}
          />
          {otherError ? (
            <p id={`${listboxId}-other-error`} className="mt-1.5 text-xs text-red-600" role="alert">
              {otherError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
