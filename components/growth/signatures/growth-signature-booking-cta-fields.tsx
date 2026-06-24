"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  GROWTH_SIGNATURE_BOOKING_OPTIONS_QA_MARKER,
  type GrowthSignatureBookingOption,
  resolveSignatureBookingSourceFromUrl,
} from "@/lib/growth/booking/booking-page-signature-options-types"
import { GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL } from "@/lib/growth/signatures/signature-profile-defaults"

type BookingSource = "manual" | "existing"

type Props = {
  bookingUrl: string
  bookingLabel: string
  showBookingCta: boolean
  disabled?: boolean
  onBookingUrlChange: (value: string) => void
  onBookingLabelChange: (value: string) => void
  onShowBookingCtaChange: (checked: boolean) => void
}

function ToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

export function GrowthSignatureBookingCtaFields({
  bookingUrl,
  bookingLabel,
  showBookingCta,
  disabled,
  onBookingUrlChange,
  onBookingLabelChange,
  onShowBookingCtaChange,
}: Props) {
  const [source, setSource] = useState<BookingSource>("manual")
  const [selectedOptionId, setSelectedOptionId] = useState<string>("")
  const [useCustomUrl, setUseCustomUrl] = useState(false)
  const [options, setOptions] = useState<GrowthSignatureBookingOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true)
    try {
      const res = await fetch("/api/platform/growth/booking-pages/options", { cache: "no-store" })
      const data = (await res.json()) as { ok?: boolean; options?: GrowthSignatureBookingOption[] }
      setOptions(data.options ?? [])
    } finally {
      setLoadingOptions(false)
    }
  }, [])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  useEffect(() => {
    if (options.length === 0) return
    const resolved = resolveSignatureBookingSourceFromUrl(bookingUrl, options)
    if (resolved.source === "existing" && resolved.pageId) {
      setSource("existing")
      setSelectedOptionId(resolved.pageId)
      setUseCustomUrl(resolved.customUrl)
      return
    }
    if (bookingUrl.trim()) {
      setSource("manual")
      setSelectedOptionId("")
      setUseCustomUrl(false)
    }
  }, [bookingUrl, options])

  function selectExistingOption(optionId: string) {
    const option = options.find((entry) => entry.id === optionId)
    if (!option) return
    setSelectedOptionId(optionId)
    setUseCustomUrl(false)
    onBookingUrlChange(option.url)
    onBookingLabelChange(GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL)
  }

  function handleSourceChange(next: BookingSource) {
    setSource(next)
    if (next === "manual") {
      setSelectedOptionId("")
      setUseCustomUrl(false)
      return
    }
    const first = options.find((entry) => entry.type === "booking_page")
    if (first) selectExistingOption(first.id)
  }

  const selectedOption = options.find((entry) => entry.id === selectedOptionId) ?? null
  const urlReadOnly = source === "existing" && !useCustomUrl

  return (
    <div
      className="grid gap-3 sm:grid-cols-2"
      data-qa="growth-signature-booking-cta"
      data-qa-marker={GROWTH_SIGNATURE_BOOKING_OPTIONS_QA_MARKER}
    >
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Booking source</Label>
        <Select
          value={source}
          disabled={disabled}
          onValueChange={(value) => handleSourceChange(value as BookingSource)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual URL</SelectItem>
            <SelectItem value="existing">Existing booking page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {source === "existing" ? (
        <>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Booking page</Label>
            {loadingOptions ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading booking pages…
              </p>
            ) : options.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <p>No booking pages yet. Create one in Growth settings or switch to Manual URL.</p>
                <Button size="sm" variant="outline" className="mt-3" asChild>
                  <Link href="/settings/growth-engine/booking-pages">Create booking page</Link>
                </Button>
              </div>
            ) : (
              <Select
                value={selectedOptionId || undefined}
                disabled={disabled}
                onValueChange={selectExistingOption}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select booking page" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Booking URL</Label>
            <Input
              value={bookingUrl}
              readOnly={urlReadOnly}
              disabled={disabled || !selectedOption}
              onChange={(event) => onBookingUrlChange(event.target.value)}
              placeholder="https://app.equipify.ai/book/demo"
              inputMode="url"
            />
            {source === "existing" && selectedOption && !useCustomUrl ? (
              <button
                type="button"
                className="text-xs text-primary underline-offset-4 hover:underline"
                disabled={disabled}
                onClick={() => setUseCustomUrl(true)}
              >
                Use custom URL instead
              </button>
            ) : null}
            {source === "existing" && selectedOption && useCustomUrl ? (
              <button
                type="button"
                className="text-xs text-primary underline-offset-4 hover:underline"
                disabled={disabled}
                onClick={() => {
                  setUseCustomUrl(false)
                  onBookingUrlChange(selectedOption.url)
                }}
              >
                Use selected booking page URL
              </button>
            ) : null}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Booking label</Label>
            <Input
              value={bookingLabel}
              disabled={disabled}
              onChange={(event) => onBookingLabelChange(event.target.value)}
              placeholder={GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL}
            />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Booking URL</Label>
            <Input
              value={bookingUrl}
              disabled={disabled}
              onChange={(event) => onBookingUrlChange(event.target.value)}
              placeholder="https://equipify.ai/demo"
              inputMode="url"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Booking label</Label>
            <Input
              value={bookingLabel}
              disabled={disabled}
              onChange={(event) => onBookingLabelChange(event.target.value)}
              placeholder={GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL}
            />
          </div>
        </>
      )}

      <div className="sm:col-span-2">
        <ToggleRow
          id="show-booking-cta"
          label="Show booking CTA in signature"
          checked={showBookingCta}
          onCheckedChange={onShowBookingCtaChange}
        />
      </div>
    </div>
  )
}
