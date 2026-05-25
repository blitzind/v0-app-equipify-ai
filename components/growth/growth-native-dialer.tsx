"use client"

import { useMemo, useState } from "react"
import { Delete, Phone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  appendDialPhoneKey,
  backspaceDialPhone,
  formatDisplayPhone,
  hasDialablePhone,
  normalizeDialPhoneDigits,
} from "@/lib/growth/native-dialer/native-dialer-workspace-ui"

type GrowthNativeDialerProps = {
  phone: string
  onPhoneChange: (value: string) => void
  onStartCall: () => void
  disabled?: boolean
  loading?: boolean
}

const KEYPAD = [
  { key: "1", sub: "" },
  { key: "2", sub: "ABC" },
  { key: "3", sub: "DEF" },
  { key: "4", sub: "GHI" },
  { key: "5", sub: "JKL" },
  { key: "6", sub: "MNO" },
  { key: "7", sub: "PQRS" },
  { key: "8", sub: "TUV" },
  { key: "9", sub: "WXYZ" },
  { key: "*", sub: "" },
  { key: "0", sub: "+" },
  { key: "#", sub: "" },
]

export function GrowthNativeDialer({
  phone,
  onPhoneChange,
  onStartCall,
  disabled,
  loading,
}: GrowthNativeDialerProps) {
  const [search, setSearch] = useState("")

  const filteredHint = useMemo(() => {
    if (!search.trim()) return null
    return `Search: ${search.trim()} — select a lead from queue or paste a number`
  }, [search])

  const dialDigits = normalizeDialPhoneDigits(phone)
  const displayPhone = dialDigits ? formatDisplayPhone(dialDigits) : ""
  const canDial = hasDialablePhone(phone)

  function appendKey(key: string) {
    onPhoneChange(appendDialPhoneKey(phone, key))
  }

  function backspace() {
    onPhoneChange(backspaceDialPhone(phone))
  }

  function clearPhone() {
    onPhoneChange("")
  }

  return (
    <div className="space-y-3" data-qa-marker="growth-native-dialer-controls">
      <Input
        placeholder="Search lead, contact, or company..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9"
      />
      {filteredHint ? <p className="text-xs text-muted-foreground">{filteredHint}</p> : null}

      <div className="relative">
        <Input
          value={displayPhone}
          onChange={(e) => onPhoneChange(normalizeDialPhoneDigits(e.target.value))}
          placeholder="Enter phone number"
          className="h-14 border-0 bg-muted/30 pr-10 text-center font-mono text-3xl tracking-wide shadow-none focus-visible:ring-1 dark:bg-white/5"
          inputMode="tel"
        />
        {dialDigits ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-muted-foreground"
            disabled={disabled}
            onClick={clearPhone}
            aria-label="Clear phone number"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYPAD.map(({ key, sub }) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            className="h-14 w-full flex-col gap-0 rounded-xl py-2"
            disabled={disabled}
            onClick={() => appendKey(key)}
          >
            <span className="text-xl font-semibold leading-none">{key}</span>
            {sub ? <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{sub}</span> : null}
          </Button>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          className="h-12 flex-1 rounded-xl"
          disabled={disabled}
          onClick={backspace}
        >
          <Delete className="mr-2 size-4" />
          Backspace
        </Button>
        <Button
          type="button"
          data-qa-action="native-dialer-start-call"
          className={cn(
            "h-12 flex-[1.4] rounded-xl font-semibold text-white",
            "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600",
          )}
          disabled={disabled || !canDial || loading}
          onClick={onStartCall}
        >
          {loading ? "Starting…" : (
            <>
              <Phone className="mr-2 size-4" />
              Call
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
