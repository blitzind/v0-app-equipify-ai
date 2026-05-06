"use client"

import { useRef } from "react"
import { Phone, MessageSquare, Navigation, Camera, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function mapsSearchUrl(query: string) {
  const q = query.trim()
  if (!q) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "")
  return digits ? `tel:${digits}` : null
}

function smsHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "")
  return digits ? `sms:${digits}` : null
}

export type TechnicianMobileQuickBarProps = {
  /** Primary customer phone (E.164 or local); enables Call / Text */
  phone?: string | null
  /** Free-text destination for Maps (customer + job site, etc.) */
  navigateQuery?: string | null
  showComplete?: boolean
  onComplete?: () => void
  onPhotoFiles?: (files: FileList) => void
  /** Extra bottom inset when fixed above the mobile bottom nav (full-page WO only) */
  fixedAboveMobileNav?: boolean
  className?: string
  disabled?: boolean
}

/**
 * Thumb-sized quick actions for field technicians (mobile / small tablets).
 * Hidden at lg+ — desktop workflows unchanged.
 */
export function TechnicianMobileQuickBar({
  phone,
  navigateQuery,
  showComplete,
  onComplete,
  onPhotoFiles,
  fixedAboveMobileNav,
  className,
  disabled,
}: TechnicianMobileQuickBarProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const tel = phone?.trim() ? telHref(phone.trim()) : null
  const sms = phone?.trim() ? smsHref(phone.trim()) : null
  const maps = navigateQuery?.trim() ? mapsSearchUrl(navigateQuery.trim()) : null

  const btnClass =
    "h-12 min-w-[3rem] px-2 sm:px-3 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-border bg-card text-[10px] font-medium text-foreground shadow-sm active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none"

  const wrapClass = cn(
    "lg:hidden border-t border-border bg-background/95 backdrop-blur-md",
    fixedAboveMobileNav
      ? "fixed left-0 right-0 z-[85] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
      : "shrink-0 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-2",
    className,
  )

  return (
    <div className={wrapClass} role="toolbar" aria-label="Field technician quick actions">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = e.target.files
          if (files?.length) onPhotoFiles?.(files)
          e.target.value = ""
        }}
      />
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1 sm:gap-2">
        {tel ? (
          <a href={tel} className={cn(btnClass, "hover:bg-muted/80")}>
            <Phone className="h-5 w-5 text-primary" aria-hidden />
            Call
          </a>
        ) : (
          <span className={cn(btnClass, "text-muted-foreground")} aria-disabled title="No primary phone on file">
            <Phone className="h-5 w-5 opacity-40" aria-hidden />
            Call
          </span>
        )}
        {sms ? (
          <a href={sms} className={cn(btnClass, "hover:bg-muted/80")}>
            <MessageSquare className="h-5 w-5 text-primary" aria-hidden />
            Text
          </a>
        ) : (
          <span className={cn(btnClass, "text-muted-foreground")} aria-disabled title="No primary phone on file">
            <MessageSquare className="h-5 w-5 opacity-40" aria-hidden />
            Text
          </span>
        )}
        {maps ? (
          <a href={maps} target="_blank" rel="noopener noreferrer" className={cn(btnClass, "hover:bg-muted/80")}>
            <Navigation className="h-5 w-5 text-primary" aria-hidden />
            Navigate
          </a>
        ) : (
          <span className={cn(btnClass, "text-muted-foreground")} aria-disabled title="Add a job location to navigate">
            <Navigation className="h-5 w-5 opacity-40" aria-hidden />
            Navigate
          </span>
        )}
        <button
          type="button"
          className={cn(btnClass, "hover:bg-muted/80")}
          disabled={disabled || !onPhotoFiles}
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="h-5 w-5 text-primary" aria-hidden />
          Photo
        </button>
        {showComplete && onComplete ? (
          <Button
            type="button"
            variant="default"
            className="h-12 min-w-[5.5rem] flex-col gap-0 rounded-xl px-2 text-[10px] font-semibold shadow-sm"
            disabled={disabled}
            onClick={() => onComplete()}
          >
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            Complete
          </Button>
        ) : (
          <span className={cn(btnClass, "text-muted-foreground")} aria-disabled>
            <CheckCircle2 className="h-5 w-5 opacity-40" aria-hidden />
            Done
          </span>
        )}
      </div>
    </div>
  )
}
