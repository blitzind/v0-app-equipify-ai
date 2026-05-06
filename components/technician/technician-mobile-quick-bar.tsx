"use client"

import { useRef } from "react"
import {
  Phone,
  MessageSquare,
  Navigation,
  Camera,
  CheckCircle2,
  PenLine,
  StickyNote,
  FileBadge2,
  WifiOff,
} from "lucide-react"
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
  /** Jump to customer signature (parent switches tab + scrolls). */
  onSignature?: () => void
  /** Jump to technician notes tab + section. */
  onTechnicianNotes?: () => void
  /** Jump to certificates tab (e.g. calibration workflow). */
  onCertificates?: () => void
  /** Show certificates shortcut (hide when no cert workflow). */
  showCertificatesShortcut?: boolean
  /** Extra bottom inset when fixed above the mobile bottom nav (full-page WO only) */
  fixedAboveMobileNav?: boolean
  /** Pin to bottom of viewport inside scroll parents (drawer body). */
  stickyDock?: boolean
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
  onSignature,
  onTechnicianNotes,
  onCertificates,
  showCertificatesShortcut,
  fixedAboveMobileNav,
  stickyDock,
  className,
  disabled,
}: TechnicianMobileQuickBarProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const tel = phone?.trim() ? telHref(phone.trim()) : null
  const sms = phone?.trim() ? smsHref(phone.trim()) : null
  const maps = navigateQuery?.trim() ? mapsSearchUrl(navigateQuery.trim()) : null

  const btnClass =
    "h-11 min-w-[2.75rem] px-1.5 sm:px-2 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-border bg-card text-[10px] font-medium text-foreground shadow-sm active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none touch-manipulation"

  const wrapClass = cn(
    "lg:hidden border-t border-border bg-background/95 backdrop-blur-md",
    stickyDock && "sticky bottom-0 z-[88] shrink-0",
    fixedAboveMobileNav
      ? "fixed left-0 right-0 z-[85] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
      : !stickyDock && "shrink-0 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-2",
    className,
  )

  return (
    <div className={wrapClass} role="toolbar" aria-label="Field technician quick actions">
      <p className="mx-auto max-w-lg px-2 pb-1.5 text-center text-[10px] leading-snug text-muted-foreground flex items-start justify-center gap-1.5">
        <WifiOff className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-70" aria-hidden />
        <span>
          Photos and signatures upload when you&apos;re online. If signal drops, reopen this job and retry any failed save.
        </span>
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = e.target.files
          if (files?.length) onPhotoFiles?.(files)
          e.target.value = ""
        }}
      />
      <div className="mx-auto flex max-w-lg flex-col gap-2">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
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

          <button
            type="button"
            className={cn(btnClass, "hover:bg-muted/80")}
            disabled={disabled || !onSignature}
            onClick={() => onSignature?.()}
          >
            <PenLine className="h-5 w-5 text-primary" aria-hidden />
            Sign
          </button>
          <button
            type="button"
            className={cn(btnClass, "hover:bg-muted/80")}
            disabled={disabled || !onTechnicianNotes}
            onClick={() => onTechnicianNotes?.()}
          >
            <StickyNote className="h-5 w-5 text-primary" aria-hidden />
            Notes
          </button>
          {showCertificatesShortcut ? (
            <button
              type="button"
              className={cn(btnClass, "hover:bg-muted/80")}
              disabled={disabled || !onCertificates}
              onClick={() => onCertificates?.()}
            >
              <FileBadge2 className="h-5 w-5 text-primary" aria-hidden />
              Cert
            </button>
          ) : (
            <span className={cn(btnClass, "text-muted-foreground")} aria-disabled title="No certificate steps for this job">
              <FileBadge2 className="h-5 w-5 opacity-40" aria-hidden />
              Cert
            </span>
          )}
        </div>

        {showComplete && onComplete ? (
          <Button
            type="button"
            variant="default"
            className="h-12 w-full gap-2 rounded-xl text-sm font-semibold shadow-md touch-manipulation"
            disabled={disabled}
            onClick={() => onComplete()}
          >
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            Complete job
          </Button>
        ) : (
          <div className="flex h-11 items-center justify-center rounded-xl border border-dashed border-border text-[11px] text-muted-foreground">
            <CheckCircle2 className="mr-2 h-4 w-4 opacity-40" aria-hidden />
            Job completed or closed — no complete action
          </div>
        )}
      </div>
    </div>
  )
}
