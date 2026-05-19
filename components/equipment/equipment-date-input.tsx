"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { EQUIPMENT_DATE_PLACEHOLDER } from "@/lib/equipment/equipment-date-fields"

type EquipmentDateInputProps = {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  disabled?: boolean
  "aria-invalid"?: boolean
  onBlur?: () => void
}

/** Text date field — faster keyboard entry than calendar-only pickers; accepts YYYY-MM-DD. */
export function EquipmentDateInput({
  value,
  onChange,
  id,
  className,
  disabled,
  "aria-invalid": ariaInvalid,
  onBlur,
}: EquipmentDateInputProps) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder={EQUIPMENT_DATE_PLACEHOLDER}
      value={value}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={cn("font-mono text-sm tabular-nums", className)}
    />
  )
}
