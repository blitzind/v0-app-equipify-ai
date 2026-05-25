"use client"

import { type InputHTMLAttributes, type ReactNode, useId, useState } from "react"
import { cn } from "@/lib/utils"

type FloatingFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export function FloatingInput({ label, className, id, value, onFocus, onBlur, ...props }: FloatingFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const [focused, setFocused] = useState(false)
  const hasValue = String(value ?? "").length > 0

  return (
    <div className="relative">
      <input
        {...props}
        id={fieldId}
        value={value}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        placeholder=" "
        className={cn(
          "peer h-14 w-full rounded-xl border border-slate-200 bg-white px-4 pt-5 pb-2 text-sm shadow-sm outline-none transition-all",
          "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10",
          "dark:border-slate-700 dark:bg-slate-900 dark:focus:border-blue-400 dark:focus:ring-blue-400/10",
          className,
        )}
      />
      <label
        htmlFor={fieldId}
        className={cn(
          "pointer-events-none absolute left-4 text-muted-foreground transition-all duration-200",
          focused || hasValue ? "top-2 text-[11px] font-semibold uppercase tracking-wide" : "top-1/2 -translate-y-1/2 text-sm",
          focused && "text-blue-600 dark:text-blue-400",
        )}
      >
        {label}
      </label>
    </div>
  )
}

export function FloatingTextarea({
  label,
  className,
  id,
  value,
  rows = 3,
  onFocus,
  onBlur,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const [focused, setFocused] = useState(false)
  const hasValue = String(value ?? "").length > 0

  return (
    <div className="relative">
      <textarea
        {...props}
        id={fieldId}
        rows={rows}
        value={value}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        placeholder=" "
        className={cn(
          "peer w-full rounded-xl border border-slate-200 bg-white px-4 pt-6 pb-3 text-sm shadow-sm outline-none transition-all",
          "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10",
          "dark:border-slate-700 dark:bg-slate-900 dark:focus:border-blue-400 dark:focus:ring-blue-400/10",
          className,
        )}
      />
      <label
        htmlFor={fieldId}
        className={cn(
          "pointer-events-none absolute left-4 text-muted-foreground transition-all duration-200",
          focused || hasValue ? "top-2 text-[11px] font-semibold uppercase tracking-wide" : "top-4 text-sm",
          focused && "text-blue-600 dark:text-blue-400",
        )}
      >
        {label}
      </label>
    </div>
  )
}

export function BookingSummaryCard({
  accentColor,
  children,
}: {
  accentColor: string
  children: ReactNode
}) {
  return (
    <div
      className="rounded-2xl border p-5 shadow-sm dark:border-slate-700/80"
      style={{
        borderColor: `${accentColor}33`,
        background: `linear-gradient(135deg, ${accentColor}08 0%, transparent 100%)`,
      }}
    >
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Booking summary</p>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  )
}
