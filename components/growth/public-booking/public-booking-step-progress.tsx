"use client"

import { cn } from "@/lib/utils"

type BookingStep = "date" | "time" | "details"

const STEPS: { id: BookingStep; label: string }[] = [
  { id: "date", label: "Date" },
  { id: "time", label: "Time" },
  { id: "details", label: "Details" },
]

export function PublicBookingStepProgress({ step, accentColor }: { step: BookingStep; accentColor: string }) {
  const activeIndex = STEPS.findIndex((item) => item.id === step)

  return (
    <ol className="mb-8 flex items-center justify-center gap-0 sm:justify-start" aria-label="Booking progress">
      {STEPS.map((item, index) => {
        const isComplete = index < activeIndex
        const isActive = index === activeIndex
        const isUpcoming = index > activeIndex

        return (
          <li key={item.id} className="flex items-center">
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
              <div
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 motion-reduce:transition-none",
                  isComplete && "text-white shadow-md",
                  isActive && "scale-110 text-white shadow-lg ring-4 motion-reduce:scale-100",
                  isUpcoming && "border-2 border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500",
                )}
                style={
                  isComplete || isActive
                    ? {
                        background: isActive
                          ? `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 75%, #1e3a8a))`
                          : accentColor,
                        ...(isActive ? { boxShadow: `0 8px 24px ${accentColor}44` } : {}),
                      }
                    : undefined
                }
              >
                {isComplete ? "✓" : index + 1}
              </div>
              <span
                className={cn(
                  "hidden text-sm font-semibold sm:inline",
                  isActive && "text-foreground",
                  isComplete && "text-muted-foreground",
                  isUpcoming && "text-muted-foreground/60",
                )}
              >
                {item.label}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <div
                className={cn(
                  "mx-2 h-0.5 w-8 rounded-full transition-colors duration-500 sm:mx-4 sm:w-16 md:w-24 motion-reduce:transition-none",
                  index < activeIndex ? "opacity-100" : "bg-slate-200 dark:bg-slate-800",
                )}
                style={index < activeIndex ? { backgroundColor: accentColor } : undefined}
                aria-hidden
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export type { BookingStep }
