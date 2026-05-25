"use client"

import { useMemo, useState } from "react"
import { Delete, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type GrowthNativeDialerProps = {
  phone: string
  onPhoneChange: (value: string) => void
  onDial: () => void
  disabled?: boolean
  loading?: boolean
}

const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

export function GrowthNativeDialer({
  phone,
  onPhoneChange,
  onDial,
  disabled,
  loading,
}: GrowthNativeDialerProps) {
  const [search, setSearch] = useState("")

  const filteredHint = useMemo(() => {
    if (!search.trim()) return null
    return `Search: ${search.trim()} — select a lead from queue or paste a number`
  }, [search])

  function appendKey(key: string) {
    onPhoneChange(`${phone}${key}`)
  }

  function backspace() {
    onPhoneChange(phone.slice(0, -1))
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search lead, contact, or company…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filteredHint ? <p className="text-xs text-muted-foreground">{filteredHint}</p> : null}

      <Input
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        placeholder="Enter phone number"
        className="h-14 border-0 bg-muted/40 text-center font-mono text-3xl tracking-wide shadow-none focus-visible:ring-1"
      />

      <div className="grid grid-cols-3 gap-2">
        {KEYPAD.map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            className="h-16 w-full rounded-xl text-2xl font-semibold"
            disabled={disabled}
            onClick={() => appendKey(key)}
          >
            {key}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-16 flex-1 rounded-xl" disabled={disabled} onClick={backspace}>
          <Delete className="mr-2 size-5" />
          Back
        </Button>
        <Button
          type="button"
          className={cn("h-16 flex-[2] rounded-xl font-semibold", "bg-emerald-600 hover:bg-emerald-700")}
          disabled={disabled || !phone.trim() || loading}
          onClick={onDial}
        >
          {loading ? "Starting…" : (
            <>
              <Phone className="mr-2 size-5" />
              Call
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
