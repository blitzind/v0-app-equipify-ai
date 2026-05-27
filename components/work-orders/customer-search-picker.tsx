"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export type CustomerSearchOption = {
  id: string
  company_name: string
  hint?: string | null
}

type Props = {
  customers: CustomerSearchOption[]
  value: string
  onValueChange: (customerId: string) => void
  search: string
  onSearchChange: (query: string) => void
  loading?: boolean
  id?: string
  label?: React.ReactNode
  placeholder?: string
  required?: boolean
  qaMarker?: string
  className?: string
}

export function CustomerSearchPicker({
  customers,
  value,
  onValueChange,
  search,
  onSearchChange,
  loading = false,
  id = "customer-search",
  label,
  placeholder = "Search customers…",
  required = false,
  qaMarker,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? customers.filter((c) => c.company_name.toLowerCase().includes(q))
      : customers
    return list.slice(0, 80)
  }, [customers, search])

  const exactMatch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    const hits = customers.filter((c) => c.company_name.toLowerCase() === q)
    return hits.length === 1 ? hits[0]! : null
  }, [customers, search])

  const selected = customers.find((c) => c.id === value) ?? null

  useEffect(() => {
    if (search.trim() && filtered.length > 0) setOpen(true)
  }, [search, filtered.length])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  return (
    <div ref={rootRef} className={cn("relative flex flex-col gap-1.5", className)} data-qa-marker={qaMarker}>
      {label ? (
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
      ) : null}
      <Input
        id={id}
        value={search}
        onChange={(e) => {
          onSearchChange(e.target.value)
          if (!e.target.value.trim()) onValueChange("")
        }}
        onFocus={() => {
          if (filtered.length > 0) setOpen(true)
        }}
        placeholder={loading ? "Loading customers…" : placeholder}
        className="h-9 text-sm"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        role="combobox"
      />
      {selected && !open ? (
        <p className="text-[11px] text-muted-foreground truncate">
          Selected: <span className="font-medium text-foreground">{selected.company_name}</span>
        </p>
      ) : null}
      {open && filtered.length > 0 ? (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md"
        >
          {filtered.map((c) => {
            const isExact = exactMatch?.id === c.id
            const isSelected = value === c.id
            return (
              <li key={c.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-muted/80",
                    (isExact || isSelected) && "bg-primary/10 font-medium text-foreground",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onValueChange(c.id)
                    onSearchChange(c.company_name)
                    setOpen(false)
                  }}
                >
                  {c.company_name}
                  {c.hint ? <span className="text-muted-foreground"> {c.hint}</span> : null}
                  {isExact && !isSelected ? (
                    <span className="ml-1 text-[10px] text-primary">· exact match</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      {open && search.trim() && filtered.length === 0 && !loading ? (
        <p className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
          No customers match your search.
        </p>
      ) : null}
    </div>
  )
}
