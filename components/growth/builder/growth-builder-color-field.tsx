"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function GrowthBuilderColorField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-md border border-border bg-background p-1"
          aria-label={`Pick ${label}`}
        />
        <Input id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}
