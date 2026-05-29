"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { normalizeOptionalEquipmentDateInput } from "@/lib/equipment/equipment-date-fields"

type EquipmentDateInputProps = {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  disabled?: boolean
  "aria-invalid"?: boolean
  onBlur?: () => void
}

/** Native date field — calendar picker + manual entry; stored as YYYY-MM-DD for Postgres. */
export function EquipmentDateInput({
  value,
  onChange,
  id,
  className,
  disabled,
  "aria-invalid": ariaInvalid,
  onBlur,
}: EquipmentDateInputProps) {
  const normalized = value.trim() ? normalizeOptionalEquipmentDateInput(value) ?? "" : ""

  return (
    <Input
      id={id}
      type="date"
      autoComplete="off"
      value={normalized}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={cn("text-sm tabular-nums", className)}
    />
  )
}
